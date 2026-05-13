# Kye Domain — Plan v4

## Vision

Tout est un `Node` dans un graphe hiérarchique. Un document = une page dont le contenu est une liste ordonnée de nodes enfants. Une interface = un node dont le `KindDef` déclare un widget. Un diagramme MBSE = un canvas dont les enfants sont des states, ports et transitions. Le même graphe, des projections différentes.

---

## Décisions architecturales

| Décision | Choix | Raison |
|---|---|---|
| Identité sémantique | `Kind` = newtype sur `Arc<str>` | Extensible par lua/plugins sans recompiler |
| Toutes les mutations | Pattern `Command → Event` via `apply()` pure fn | Undo, sync, auditabilité sans infra extra |
| Contenu document | `children: Vec<NodeId>` natif dans `Node` | Hiérarchie réelle, pas un hack sur String |
| Texte riche | `RichText` comme variant de `Value` | Document-first feel sans parser du markdown à chaque rendu |
| Ordre des props | `IndexMap<PropKey, Value>` | Ordre d'insertion = ordre d'affichage dans l'UI |
| Timestamps | Dans `Node` struct (pas dans props) | Métadonnées système ≠ données utilisateur |
| Schema de database | `core.column` = nodes enfants | Schéma-as-graph : cohérent, pas de cas spécial |
| Vues filtrées | `core.query` = Node ordinaire | Pas de concept spécial, vit dans une page ou sur canvas |
| Backlinks | Index interne dans `Graph` | O(1) au lieu de O(n) scan |
| `apply()` | Prend `now: DateTime<Utc>` en paramètre | Vraiment pure → snapshot testing possible |
| Ordre de validation dans `apply()` | Intégrité structurelle **d'abord**, contraintes KindDef **ensuite** | Évite des messages d'erreur confus sur des nodes inexistants |
| Erreurs des ports | `RepositoryError` défini dans `ports.rs` (pas `anyhow`) | Ports 100% définis par le domain |
| `WorkspaceMeta` | Dans `models/workspace.rs` (pas dans `service.rs`) | Concept domain ≠ orchestration service |
| Graph en mémoire | Cache dans `InMemoryGraphRepository` (infra), pas dans le Service | Service stateless = hexagonale pure ; l'impl du port est swappable |
| Batch atomique | Snapshot `graph.clone()` avant batch, rollback si erreur | All-or-nothing — comportement attendu pour paste/import |
| Invalidation queries | GUI re-évalue ses queries actives sur chaque Event reçu | Graph en mémoire → query O(n) sans I/O, zéro couplage domain/GUI |

---

## Structure des modules

```
crates/domain/src/
│
│  ── Fondations ────────────────────────────────────
├── primitives.rs    NodeId, Kind, PropKey, kinds::*, props::*
├── value.rs         Value, RichText, Span, Mark, Color, Props, props!
├── node.rs          Node, NodeBuilder
├── workspace.rs     WorkspaceMeta
│
│  ── Graph & Opérations ────────────────────────────
├── graph.rs         Graph, GraphError
├── query.rs         QueryBuilder, Filter, SortDir
├── resolver.rs      SchemaResolver
│
│  ── Système de types ──────────────────────────────
├── schema.rs        KindDef, PropDef, ValueType, Constraint, ValidationError
├── view.rs          ViewDef, Layout, Direction, ActionDef
├── registry.rs      KindRegistry, CoreLibrary
│
│  ── Mutations ─────────────────────────────────────
├── command.rs       Command, Event, CommandError, apply()
│
│  ── Hexagonal ─────────────────────────────────────
├── ports.rs         GraphRepository, KindRepository, EventBus, RepositoryError
├── service.rs       Service, ServiceError
│
└── lib.rs           re-exports publics
```

**Règles** :
- Flat — un seul niveau, pas de sous-dossiers
- Chaque fichier ne dépend que des fichiers dans les couches au-dessus
- `resolver.rs` (pas `schema_resolver.rs`) — préfixe redondant supprimé

---

## `primitives.rs`

Trois newtypes fondamentaux dont tout le reste dépend.

**`NodeId`** : wrapper sur `Uuid`, `Copy` pour l'ergonomie — on le passe par valeur sans clone.

**`Kind`** : wrapper sur `Arc<str>`. String ouvert (pas un enum) — extensible sans recompiler. Namespaced : `"core.page"`, `"mbse.state"`, `"user.myType"`. Implémente `From<&str>` pour éviter le boilerplate. `Display` pour les logs lisibles.

**`PropKey`** : même approche que `Kind`.

Deux modules de constantes évitent les strings magiques dans le code Rust : `kinds::PAGE`, `kinds::FLASHCARD`, `kinds::REQUIREMENT`... et `props::TITLE`, `props::CHECKED`, `props::FROM`...

---

## `value.rs`

`Value` est l'union de toutes les données possibles dans une prop :
`Null | Bool | Int | Float | Text(Arc<str>) | Rich(RichText) | Ref(NodeId) | Array(Vec<Value>) | Date | DateTime | Color`

Points clés :
- **`Float`** implémente `Eq` via `to_bits()` — évite la dépendance `ordered_float`, `Value` devient `Eq` → utilisable dans `assert_eq!`
- **`Text` vs `Rich`** : `Text` pour les valeurs machine (titre, url, lang). `Rich` pour le contenu éditable avec formatting
- **`Ref(NodeId)`** est ce qui crée les liens du graphe — le backlink index est maintenu à partir de ces valeurs
- **`Formula`** est retiré — scope creep, commenté `// TODO: lua v2`

**`RichText`** : liste plate de `Span`. Chaque span a un texte et une `SmallVec<[Mark; 2]>` (Bold, Italic, Code, Link, Color...). Flat list comme ProseMirror — suffisant pour le formatting inline.

**`Props`** = `IndexMap<PropKey, Value>`. L'ordre d'insertion est préservé → l'ordre d'affichage dans l'UI est déterministe.

**`props!` macro** : sucre syntaxique pour créer une Props lisiblement.

---

## `node.rs`

Le Node a : `id`, `kind`, `parent`, `children` (ordonnés), `props`, `view_override`, `created_at`, `updated_at`.

`view_override: Option<ViewDef>` permet à un node de changer son rendu sans changer son Kind. Ex : une database affichée en Kanban plutôt qu'en Table — préférence de vue, pas changement de type.

**`NodeBuilder`** : pattern builder chaînable, infaillible. La validation se fait au niveau du Service, pas à la construction.

Accesseurs ergonomiques : `node.prop_text("title")`, `node.prop_bool("checked")`, `node.prop_ref("target")`, `node.title()`.

---

## `graph.rs`

Structure centrale. Deux invariants maintenus en permanence :
1. Si un node a `parent: Some(pid)`, alors ce pid a `node.id` dans ses `children` — et vice versa
2. Le backlink index est toujours synchronisé avec les `Value::Ref` dans les props

**Champs** : `HashMap<NodeId, Node>` + `Vec<NodeId>` pour les roots + `HashMap<NodeId, BTreeSet<NodeId>>` pour le backlink index.

**Mutations** — appelées par `apply()`, jamais directement par le Service :
- `insert_root`, `insert_child` : insèrent et maintiennent les liens parent/children
- `move_node` : détache, réattache, détecte les cycles (le nouveau parent ne doit pas être dans le sous-arbre du node)
- `remove_subtree` : suppression récursive, retourne tous les nodes supprimés (pour l'Event)
- `set_prop` / `delete_prop` : mettent à jour les props ET le backlink index si `Value::Ref`

**Lectures** : `children_of`, `ancestors_of`, `subtree_of` (itérateurs paresseux), `find_by_kind`, `nearest_ancestor_of_kind`, `backlinks(target)` (O(1) grâce à l'index).

---

## `resolver.rs`

Responsabilité unique : résoudre le schéma effectif d'un node en tenant compte de son contexte dans le graphe.

Prend `&Graph` et `&KindRegistry` en dépendances explicites — pas de couplage implicite.

- **`effective_columns(row_id)`** : si le node est un `core.row`, remonte au parent `core.database` et retourne ses enfants `core.column`. C'est le schéma hérité.
- **`validate_in_context(node_id)`** : combine validation KindDef (champs requis, types) + validation du schéma hérité (colonnes requises de la DB parente).

---

## `query.rs`

**`QueryBuilder`** : builder fluide qui s'exécute contre le `Graph` en mémoire.

Filtres : `kind`, `tag`, `prop_eq`, `prop_bool`, `prop_contains`, `ancestor` (limite à un sous-arbre).
Options : `sort_by(key, dir)`, `limit(n)`.

`execute()` retourne `Vec<NodeId>` — pas des `&Node`. Cela évite le borrow conflict classique où on voudrait muter le graph après la query. L'appelant fait `graph.get(id)` séparément.

**`evaluate_query_node(graph, node)`** : lit les props d'un `core.query` node (`kind_filter`, `tag_filter`, `limit`...) et les traduit en `QueryBuilder`. Permet aux vues sauvegardées d'être évaluées à la volée.

---

## `schema.rs`

**`KindDef`** décrit le contrat d'un Kind :
- `label`, `icon` : affichage UI
- `title_prop: PropKey` : quelle prop afficher comme titre dans les listes
- `props: IndexMap<PropKey, PropDef>` : l'ordre est l'ordre d'affichage
- `view: Option<ViewDef>` : comment rendre ce kind par défaut
- `constraints: Vec<Constraint>` : règles structurelles

**`Constraint`** : `AllowedChildKinds`, `AllowedParentKinds`, `ConnectionSourceKinds`, `ConnectionTargetKinds`, `MaxChildren`.

**`ValueType`** : type attendu pour une prop — `Bool`, `Int`, `Text`, `Rich`, `Ref`, `RefTo(Kind)`, `OneOf(Vec<str>)`, `Array(ValueType)`, `Optional(ValueType)`.

---

## `view.rs`

**`ViewDef`** : métadonnées de rendu. Attaché à un `KindDef` ou en override sur un `Node`.
- `layout` : comment organiser le node
- `bindings: IndexMap<str, PropKey>` : map slot → prop (dit au GUI quoi passer à quel slot)
- `actions` : boutons/toggles disponibles

**`Layout`** : `Document`, `Canvas`, `Grid { columns }`, `Stack { direction }`, `Gallery`, `Table`, `Kanban { group_by }`, `Widget { name }`.

`Widget { name }` délègue au renderer nommé côté GUI (`"flashcard"`, `"markdown"`, `"image"`, `"weather"`...). Le domain ne sait pas ce qu'est un flip de flashcard.

---

## `registry.rs`

**`KindRegistry`** : map `Kind → KindDef`. Méthodes : `register`, `get`, `check_child_allowed`, `validate`.

**`CoreLibrary`** enregistre les 25 kinds natifs :
- **Document** : page, paragraph, heading, task, image, code_block, quote, divider, callout, embed
- **Widgets** : flashcard, form, form_field
- **Database** : database, row, column
- **Vues** : query
- **Canvas** : canvas, frame, connection
- **Workflow** : inbox
- **MBSE** : state, port, transition, component, requirement, interface

---

## `command.rs`

**`Command`** décrit l'intention : `CreateNode`, `DeleteNode { cascade }`, `MoveNode`, `SetProp`, `DeleteProp`, `SetProps` (merge), `SetViewOverride`.

**`Event`** décrit ce qui s'est passé, avec assez d'info pour annuler. Contient les `old_value`, les nodes supprimés dans leur intégralité, les anciens et nouveaux index.

**`Event::inverse()`** dérive la `Command` qui annule l'effet → undo/redo sans infrastructure supplémentaire.

**`apply(graph, registry, cmd, now)`** est une pure function : `&mut Graph` + `&KindRegistry` + `Command` + `now: DateTime<Utc>`. Aucun I/O, aucun side-effect. Testable avec timestamp fixe.

Deux niveaux de validation **dans `apply()`** — ordre fixe, toujours le même :
1. **Intégrité structurelle** via le Graph — not found, cycle, index out of bounds. *En premier* : inutile de vérifier les contraintes KindDef d'un node qui n'existe pas.
2. **Contraintes KindDef** via `registry.check_command(graph, cmd)` — AllowedChildKinds, MaxChildren, etc. *En second* : seulement si la structure est saine.

Le Service n'a plus de `validate_constraints()`. Il passe juste le registry à `apply()`. L'orchestration reste dans le Service, la logique métier reste dans le domain.

---

## `ports.rs`

**`RepositoryError`** : type d'erreur défini **par le domain** (pas `anyhow`). Variantes : `NotFound`, `Corrupted(String)`, `Io(String)`. L'infra mappe ses erreurs concrètes vers ce type. Le domain ne dépend d'aucune crate externe pour ses interfaces.

**`GraphRepository`** — retourne `Result<_, RepositoryError>` :
- `load_meta()` / `save_meta()` : métadonnées workspace
- `load_graph()` : charge le graph complet en mémoire
- `apply_event(event)` : save granulaire — l'infra sait exactement quels nodes ont changé
- `save_all(graph)` : save complet (migration, backup)

**`KindRepository`** — retourne `Result<_, RepositoryError>` : load/save/delete des KindDef user-defined.

**`EventBus`** : publie les Events vers le GUI. Impl vide `()` disponible pour les tests.

---

## `models/workspace.rs`

**`WorkspaceMeta`** : struct `{ id: Uuid, name: String }` dans les **models du domain** — pas dans le service. C'est un concept métier (le workspace a une identité et un nom), pas une préoccupation d'orchestration.

---

## `service.rs`

Rôle pur d'**orchestration** — pas de business logic ici, pas d'état. Le Service appelle les ports, délègue à `apply()`, persiste, publie.

**`Service<R, K, E>`** : générique sur les trois ports. **Stateless** — aucun `Arc<RwLock<Graph>>` ici. Maintient uniquement :
- `Arc<RwLock<KindRegistry>>` — rechargé depuis `KindRepository` à chaque `execute()` pour les kinds lua à chaud

Le graph est obtenu via `repo.load_graph()` à chaque commande. Si le repo est `InMemoryGraphRepository`, cet appel est O(1) sans I/O — le Service ne sait pas et ne doit pas savoir.

**Pipeline `execute(cmd)`** — séquence d'orchestration pure :
1. `repo.load_graph()` — graph depuis le port (O(1) si cache infra)
2. Lire le registry (read lock)
3. `apply(&mut graph, &registry, cmd, Utc::now())` — toute la logique métier est ici
4. `repo.apply_event(&event)` — persist granulaire
5. `bus.publish(&event)` — notifier le GUI

**Pipeline `execute_batch(cmds)`** — all-or-nothing :
1. `repo.load_graph()` — graph depuis le port
2. `let snapshot = graph.clone()` — point de rollback
3. Pour chaque cmd : `apply(&mut graph, registry, cmd, now)?`
4. Si une erreur survient → rollback (le repo n'a pas encore été touché) puis retourner l'erreur
5. Si tout réussit → `repo.apply_event(Event::Batch(...))` + `bus.publish`

**`execute_query`** et **`evaluate_query_node`** : `repo.load_graph()` en lecture seule, sans mutation.

**`on_fs_changed()`** : débounce — notifie le repo (`repo.invalidate_cache()`) si le changement est externe, puis publie sur le bus pour que le GUI recharge.

**`ServiceError`** : `Command(CommandError) | Storage(RepositoryError) | NotFound(NodeId)` — plus d'`anyhow` dans le service non plus.

**Invalidation des queries (côté GUI)** : le GUI maintient une liste de queries actives. À chaque réception d'un `Event` via `EventBus`, il re-évalue toutes ses queries actives. Puisque le graph est en mémoire côté infra, chaque query est O(n) sans I/O — le coût est négligeable. Aucun couplage domain/queries nécessaire.

---

## Adaptateurs infra (hors domain)

Deux implémentations du port `GraphRepository` — **aucune ligne de domain ne change** pour passer de l'une à l'autre :

**`InMemoryGraphRepository`** (production) :
- Champ interne `Arc<RwLock<Graph>>` — le cache
- `load_graph()` → clone du graph en cache (O(1))
- `apply_event(event)` → applique l'Event sur le cache **puis** flush sur disk
- `invalidate_cache()` → recharge le graph depuis disk (appelé par `on_fs_changed`)

**`FileGraphRepository`** (tests, migration) :
- Pas de cache — lit et écrit sur disk à chaque appel
- Utile pour tester que la sérialisation/désérialisation est correcte
- Utile pour les outils CLI (migration, backup) qui n'ont pas besoin de perf

Le Service de test utilise `FileGraphRepository` + `()` comme EventBus → zéro infra nécessaire dans les tests du domain.

---

## Ce que ça permet

| Feature | Mécanisme |
|---|---|
| Document avec blocs riches | `core.page` + children ordonnés |
| Widgets interactifs | `KindDef.view = Layout::Widget { name }` |
| Vue filtrée cross-document | `core.query` + `QueryBuilder` |
| Database avec héritage schéma | `core.column` enfants + `SchemaResolver` |
| Undo/redo | `Event::inverse()` |
| Sync patches | `Command` sérialisable |
| MBSE avec contraintes | `Constraint::ConnectionSourceKinds` etc. |
| Lua plugins | Kind = string ouvert, KindRegistry injectable |
| Capture mobile | `core.inbox` |
| Multi-layout même data | `Node::view_override` |

---

## Vérification

```bash
cargo check -p domain   # compile seul, sans infra ni gui
cargo test -p domain
```

Tests clés : graph (insert/move/cycle/backlinks), schema_resolver (héritage colonnes), query (filtres cross-doc), command (apply déterministe, inverse), registry (validate, check constraints).

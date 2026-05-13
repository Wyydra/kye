# Plan d'Implémentation - Refonte Frontend Kye

## Constat et Problèmes de l'existant
1. **Désalignement de l'éditeur riche** : Le domaine modélise les blocs comme des nœuds (ex: `core.paragraph`, `core.heading`) avec une propriété `RichText` contenant des `Spans`. Le frontend actuel semble utiliser Tiptap pensé pour des documents entiers, alors que l'éditeur ne doit gérer qu'**un seul nœud (bloc) à la fois** et formater du texte inline.
2. **Gestion d'état brouillonne** : Le store Zustand mélange le cache du graphe, l'état UI (focus) et les réducteurs d'événements.
3. **Rendu rigide** : Le `LayoutRenderer` est rudimentaire et ne tire pas parti du système déclaratif du domaine (`ViewDef`, `Layout`, `Bindings`).

---

## Plan d'implémentation

### Phase 1 : Cœur et État (Core & State)
Refonte complète de la gestion d'état pour séparer les responsabilités.

* **1.1. Séparation des couches d'état** :
  * **Graph Store** (`store/graphStore.ts`) : Purement réactif et miroir du backend. Contient uniquement `nodes`, `roots`, `kinds` et l'écouteur IPC. Il reçoit les événements et met à jour le graphe immuablement.
  * **UI Store** (`store/uiStore.ts`) : Gère `activePageId`, `focusedNodeId`, `selection`, `theme`, le menu contextuel, etc.
  * **Command Bus** (`lib/commands.ts`) : Couche d'abstraction qui envoie les commandes `execute(...)` à Tauri (et peut implémenter de l'Optimistic UI).

* **1.2. Arbre des dépendances React** :
  * Utilisation de hooks ciblés : ex. `const node = useNode(id)` pour écouter uniquement les changements d'un nœud spécifique et éviter les re-rendus de la page entière.

### Phase 2 : Le moteur de rendu déclaratif (Renderer Engine)
Mise en place d'une Component Factory qui interprète les `ViewDef` et `Layout` du backend.

* **2.1. View Engine** :
  * `NodeRenderer` : Composant racine qui prend un `nodeId`. Il détermine le `ViewDef` (via `view_override` ou le `kindDef.view`), puis délègue à `LayoutRenderer`.
  * `LayoutRenderer` : Un switch exhaustif sur les layouts :
    * `Document` : Conteneur vertical (page), enfants rendus récursivement.
    * `Stack` : Flexbox basique.
    * `Widget` : Délégation aux composants métiers spécifiques (`ParagraphWidget`, `HeadingWidget`, `TaskWidget`, `KanbanWidget`).
* **2.2. Gestion du Focus et des Raccourcis (Block Editor)** :
  * Implémentation de la navigation entre blocs (Flèche haut/bas, Entrée, Retour arrière) au niveau du `Document Layout` ou via un context global `EditorContext`.
  * *Entrée* sur un paragraphe : Crée un nouveau nœud `core.paragraph` et déplace le curseur.
  * *Retour arrière* au début d'un paragraphe : Fusionne son contenu avec le nœud précédent, supprime le nœud actuel.

### Phase 3 : L'Éditeur Inline (Value::Rich)
Adaptation de l'éditeur de texte pour se conformer au modèle de blocs de Kye.

* **3.1. Mini-Éditeur Inline** :
  * Configuration de Tiptap/ProseMirror de façon ultra-restrictive (pas de blocs, uniquement du texte inline : gras, italique, lien, mention) ou création d'un composant `ContentEditable` customisé.
* **3.2. Mapping bidirectionnel** :
  * `RichText -> DOM` : Convertir les spans du domaine Rust en éléments React.
  * `DOM -> RichText` : Intercepter les changements, parser les spans et envoyer la commande `set_prop` au backend avec du debounce si nécessaire.

### Phase 4 : Interface Utilisateur Globale (Shell)
* **4.1. Layout Shell & Sidebar** :
  * Barre latérale avec une vue en arbre des nœuds racines (`core.page`).
  * Icônes (via `lucide-react`) pour identifier le type de document.
* **4.2. UI Kit & Block Shell** :
  * Création d'un `BlockWrapper` autour de chaque widget pour afficher des boutons au survol (poignée de drag/drop, menu contextuel pour changer le type ou supprimer).
  * Intégration d'un système de classes utilitaires propre (avec `clsx` et `tailwind-merge`).

### Phase 5 : "Slash Commands" et Raccourcis Markdown
* **5.1. Menu `/` (Slash Command)** :
  * Un popover flottant qui s'ouvre lorsqu'on tape `/` dans un bloc vide.
  * Permet de convertir le paragraphe actuel en Titre, Tâche, Image, etc.
* **5.2. Raccourcis Markdown** :
  * Interception dans le `RichTextEditor` : taper `# ` convertit en Heading 1, `[] ` en Task, etc.

### Phase 6 : Formatage RichText Complet (Terminé)
* **6.1. Barre d'outils flottante (Toolbar)** :
  * Apparaît au-dessus du texte lorsqu'une sélection est détectée.
  * Boutons pour le gras (B), l'italique (I), le barré (S) et le code (C).
* **6.2. Logique de formatage de la sélection** :
  * Extraction de la sélection native du navigateur (`window.getSelection()`).
  * Transformation de l'état local du `RichText` (découpage ou fusion de `Span` avec injection des `Marks`).
  * Envoi de la commande `set_prop` mise à jour au backend.

### Phase 7 : Optimisations (Terminé)
* **7.1. Debounce des Sauvegardes** : 
  * Ne pas envoyer la commande `set_prop` au backend à chaque frappe dans le `RichTextEditor`, mais après un délai ou lors de la perte de focus.
* **7.2. Optimistic UI** :
  * Mettre à jour le graphe côté React instantanément avant même le retour du backend pour une sensation de vitesse absolue.
* **7.3. Idempotence des événements** :
  * Garantie que les événements (surtout Drag & Drop) ne désynchronisent pas l'arbre en cas de double-application (optimiste + serveur).

### Phase 8 : Drag & Drop (Terminé)
* Implémenter l'API de Drag & Drop HTML5 native pour déplacer les blocs en glissant la poignée (Grip) et envoyer la commande `move_node` au backend.

### Phase 9 : Indentation et Hiérarchie (Terminé)

### Phase 10 : Unification du Registre d'Extensions (Terminé)
* **Problème** : La slash command, le menu "Turn into", la toolbar de formatage et les raccourcis Markdown étaient chacun hardcodés indépendamment.
* **Solution** : Création d'un registre central en 3 couches :
  * `extensions/registry.ts` — les types `BlockTypeSpec` et `MarkSpec`, + les helpers `convertBlockType` / `createBlockOfType`.
  * `extensions/coreBlocks.tsx` — les définitions concrètes (Paragraph, Heading 1/2/3, To-do, Marks Bold/Italic/…).
  * `context/EditorContext.tsx` — `EditorProvider` + `useEditor()` hook, qui injecte le registre dans tout l'arbre.
* **Hook partagé** : `hooks/useBlockKeyDown.ts` centralise la logique de navigation clavier (Enter, Backspace, Tab, ↑↓) commune à tous les widgets.
* **Résultat** : Ajouter un nouveau type de bloc = 1 objet `BlockTypeSpec` dans `coreBlocks.tsx`. Il apparaît automatiquement dans la slash command, le menu "Turn into" et répond aux raccourcis Markdown.
* Raccourci `Tab` pour indenter un bloc (le déplacer comme enfant du bloc précédent).
* Raccourci `Shift+Tab` pour désindenter un bloc (le déplacer au niveau de son grand-parent).

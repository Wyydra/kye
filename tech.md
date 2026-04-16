# 📑 Note Technique : Architecture "Semantic Git" (Kye Sync)

## 🎯 Vision

Remplacer la fusion automatique (CRDT) par une **réconciliation sémantique décentralisée**. Le fichier Markdown reste la seule source de vérité, et les modifications distantes sont traitées comme des propositions (Patches) à valider.

---

## 🏗️ 1. Les 3 États de la Donnée

Pour chaque client (Desktop, Mobile), la donnée existe sous trois formes :

1. **HEAD (Le Disque) :** Le fichier `.md` actuel. C'est la vérité absolue à l'instant T.
2. **INBOX (Zone de Transit) :** File d'attente des modifications reçues des autres clients (ou du mobile) non encore intégrées.
3. **SESSION (Mémoire) :** L'état actuel de l'application (Canevas chargé) avec les modifications non sauvegardées.

---

## 🛠️ 2. Le "Semantic Patch" (L'unité d'échange)

Au lieu d'envoyer le fichier, on envoie une **Action** atomique.

* **Structure d'un Patch :**
* `block_id` : L'ID UUID présent dans les métadonnées HTML du bloc.
* `action` : `MOVE`, `UPDATE_TEXT`, `UPDATE_META`, `DELETE`, `CREATE`.
* `payload` : Les nouvelles données (ex: nouvelles coordonnées X/Y).
* `parent_hash` : Le hash du bloc local au moment de la modif (pour détecter si le bloc a changé entre-temps).
* `author_id` & `timestamp`.



---

## 🔄 3. Cycle de Synchronisation (Le Workflow)

### Étape 1 : Émission (Capture)

* L'utilisateur déplace un bloc sur le Mobile.
* Le client génère un `KyePatch`.
* Le patch est diffusé au réseau P2P ou déposé dans un dossier partagé.

### Étape 2 : Réception (Inbox)

* Le Desktop reçoit le patch et le stocke dans son **Inbox**.
* L'UI affiche un indicateur visuel (ex: une pastille sur le bloc concerné ou une liste de changements).

### Étape 3 : Réconciliation (Review)

* **Cas A : Fast-Forward (Pas de conflit)**
* Le bloc n'a pas été modifié localement.
* *Action :* Intégration automatique (si option activée) ou clic unique pour valider.


* **Cas B : Conflit Sémantique**
* Le bloc a été modifié localement ET le patch distant arrive sur une ancienne version.
* *Action :* L'interface propose un choix : "Garder Local", "Accepter Distant", ou "Fusion Manuelle".



### Étape 4 : Commit (Écriture)

* Une fois validé, le moteur de rendu Markdown de Kye réécrit le fichier `.md` sur le disque en injectant les nouvelles valeurs dans les métadonnées ou le texte.

---

## 🛡️ 4. Gestion de la "Vérité" (Source of Truth)

* **Indépendance :** Aucun client n'est "maître". Si une "Remote" existe (serveur), elle ne sert que de relais de patches.
* **File Watching :** Si le fichier `.md` est modifié par un éditeur externe (ex: Obsidian), Kye recalcule les hashs des blocs, détecte le changement et génère un patch "interne" pour mettre à jour son propre état de session.

---

## 💡 Pourquoi ce modèle ?

1. **Fiabilité :** Aucune chance de corruption de fichier par un algorithme de fusion complexe.
2. **Clarté :** L'utilisateur sait exactement d'où vient une modification.
3. **Local-First :** Fonctionne à 100% hors-ligne ; les échanges de patches reprennent dès la connexion.
4. **Interopérabilité :** Le Markdown reste propre et lisible par l'humain.

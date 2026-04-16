# Kye
Un outil de modélisation de connaissances. local-first.
Un concept = Un fichier.

## Philosophie & Principes
- Markdown comme modèle, le fichier texte est la source de vérité, le modèle.
- Multi-vues: un meme jeu de données peut etre projeté de différente manière.
- Frictionless, local-first: La rapidité d'exécution prime sur la quantité de fonctionnalités. pas de base de données opaque, pas de cloud obligatoire.
- Interopérabilité : Modifiable dans n'importe quel éditeur de texte.
- Hackability: logique métier et automatisation extensibles via lua.

## Structure de données
L'unité universelle est le Bloc. Tout objet (Note, Composant, État, Port, Flèche) est techniquement identique dans le fichier .md

- Fichier (.md) : Le conteneur physique sur le disque. Il peut contenir un ou plusieurs Blocs, des concepts liés. groupement thématique
- Bloc: L'unité atomique de contenu. Chaque titre de niveau 2 (##) marque le début d'un nouveau bloc.
    + Un bloc inclut tout le texte jusqu'au prochain ## ou la fin du fichier.
- Sous-bloc (###, ####, etc.) : Structure interne d'un Bloc. Ils ne sont pas traités comme des entités indépendantes sur le canevas,
    mais servent au layout et à la hiérarchie du texte à l'intérieur d'un Bloc Visuel.
- Bloc visuel (block) : L'élément graphique sur le canevas. Un Bloc Visuel représente un ou plusieurs Blocs regroupés spatialement.
- Relation visuelles (link) : lien sémantique entre deux blocs visuels. c'est un bloc à part entière avec ses propres métadonnées (from to).
- L'Interface / Port (port) : Un bloc dont les métadonnées contiennent une référence parent (parent).

### Spécialisation par Métadonnées
Les métadonnées JSON sont cachées dans des commentaires HTML juste au-dessus du titre H2. C'est le Type et les Relations qui dictent l'interprétation visuelle :

- Bloc Standard : Pas de parent. Rendu comme une carte sur le canevas.
- Interface / Port (dans le type system?) : Possède une propriété "parent": "ID". Rendu comme un point d'ancrage sur le bord de la carte parente.
- Relation (Flèche) : Possède des propriétés "from": "ID" et "to": "ID".

système de base simplifié, mais rajouter un tag pour le type ou sous type c'est pas mal aussi je pense.

## Canva infini
- Canva infini : Zoom et déplacement fluides
- Relations : Création de flèches entre les Blocs Visuels. La flèche est elle-même un objet "note" qui porte l'information de relation.
- blocs ou flèches sont des bloc (des notes)

## Capture et Workflows
- Mode desktop: affichage canva par défaut. double clic n'importe où sur le canevas pour créer un bloc
- Mode Mobile: interface "inbox" par défaut pour la saisie rapide de texte et de photos; 
    Les éléments capturés apparaissent dans une file d'attente sur le desktop pour être intégrés spatialement plus tard.

## Format de fichier
Format : Markdown (.md) standard.
Métadonnées : Blocs de commentaires HTML placés immédiatement au-dessus de chaque titre (Bloc ou Sous-bloc).

## Modélisation
- système de type : chaque bloc peut etre typé (Component, requirement, state, action, ...)
- l'utilisateur peut définir des schémas (via lua ?) imposant des propriétés spécifiques selon le type
- interpretation dynamique : l'application adapte son interface selon le type du bloc :
    + un type `Task` affiche une checkbox
    + un type `State` affiche des points d'ancrage pour des transitions (ne pouvant etre relié qu'avec une relation du bon type )
  c'est interpretation dynamique peuvent custom et l'utilisateur peut ajouter les siennes

## Syncro
sous forme de patch git-like qui apparaissent dans l'inbox

## Scripting
Scripting Lua (ou ts?) :

Définit comment un type est dessiné (couleurs, formes, icônes).
Valide la cohérence du modèle (ex: "Interdire de relier un port Input à un autre port Input").
Automatise des tâches (ex: "Générer un fichier de config à partir du diagramme d'architecture").

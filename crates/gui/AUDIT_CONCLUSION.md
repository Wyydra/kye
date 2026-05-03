# Audit et Conclusion de l'Architecture

Ce document résume l'audit de l'architecture actuelle du projet et propose une solution finale pour résoudre les problèmes rencontrés.

## Objectif

L'objectif est de créer une application de type "canvas" (similaire à Obsidian Canvas) capable de gérer un grand nombre de nœuds, avec une expérience d'édition de texte fluide et stable à l'intérieur de ces nœuds.

## Analyse de la Solution Actuelle ("Maison")

Vous avez développé une solution "maison" pour la gestion du canvas, ce qui est une excellente initiative.

*   **Points forts :**
    *   **Contrôle total :** Vous avez un contrôle complet sur la logique de rendu, de déplacement (pan), de zoom, et de manipulation des nœuds.
    *   **Code Isolé :** Le moteur de canvas (`useCanvasEngine.ts`) est bien conçu et indépendant du reste de l'application.
    *   **Base Solide :** La gestion des interactions utilisateur (déplacement, redimensionnement des nœuds) est robuste.

*   **Point Faible Identifié (Le Problème Fondamental) :**
    *   L'architecture actuelle place l'éditeur de texte (`AceEditor`) **à l'intérieur** d'un composant (`KyeNodeContent`) qui est lui-même soumis à de multiples transformations CSS (`transform: scale(...)` pour le zoom, `transform: translate(...)` pour le pan et la position du nœud).
    *   **Cause du Bug :** Un éditeur de texte complexe ne peut pas fonctionner correctement dans un tel environnement. Il est incapable de calculer sa position et sa taille réelles, ce qui cause les bugs de "décalage" que nous avons observés. Tenter de corriger cela avec des `resize()` est un contournement, pas une solution.

## Verdict de l'Audit

La fondation de votre solution "maison" est solide. Le problème n'est pas la qualité de votre code, mais un principe d'architecture : **on ne peut pas de manière fiable imbriquer un composant HTML complexe (un éditeur) dans un monde SVG ou un monde de transformations CSS complexes.**

## Recommandation Finale : L'Architecture de l'Éditeur Flottant ("Decoupled Editor")

Pour garantir la stabilité et la propreté du code, il faut adopter l'architecture utilisée par la plupart des applications de ce type (Figma, tldraw, etc.).

**Le Principe :** Séparer l'affichage du graphe de l'édition du contenu.

1.  **Le Canvas ne fait qu'afficher :** Les nœuds sur le canvas affichent le contenu en lecture seule. Ils ne contiennent plus d'éditeur.
2.  **L'Éditeur est externe :** Quand un utilisateur veut éditer un nœud (ex: par un double-clic), on affiche un **composant d'édition unique et flottant** par-dessus l'interface.
3.  **Positionnement :** Ce composant est positionné de manière absolue sur l'écran, en se basant sur la position du nœud dans le canvas. Il n'est donc pas affecté par le zoom ou le pan.

**Avantages :**
*   **Correction Définitive du Bug :** Le problème de rendu et de positionnement est éliminé à la source.
*   **Performance :** Le canvas reste très performant, car il ne gère que des nœuds simples.
*   **Simplicité du Code :** Fini les "hacks". Chaque composant a une seule responsabilité.

## Plan d'Action Adapté

Le plan détaillé précédemment fourni reste valide et est encore plus simple à appliquer à votre nouvelle base de code :

1.  **Retirer** la logique d'édition de `KyeNodeContent.tsx`.
2.  **Créer** un composant `FloatingEditor.tsx`.
3.  **Modifier** `KyeCanvas.tsx` pour gérer l'affichage du `FloatingEditor` lorsqu'un nœud est sélectionné pour l'édition.
4.  **Intégrer** `AceEditor` dans `FloatingEditor.tsx`.
5.  **Gérer** la sauvegarde des données.

Cette approche est la garantie d'une solution propre, performante, et maintenable.

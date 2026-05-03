# Audit de Performance

Ce document se concentre sur l'analyse de la performance de l'architecture actuelle et propose des optimisations pour garantir que l'application puisse gérer des graphes de très grande taille (centaines ou milliers de nœuds).

## Analyse de la Performance de l'Architecture Actuelle

L'architecture "maison" actuelle est fonctionnelle, mais elle rencontrera des problèmes de performance significatifs à grande échelle.

#### **1. Goulot d'Étranglement : Le Rendu de Tous les Nœuds**

*   **Problème :** Le composant `KyeCanvas.tsx` effectue une boucle sur `workspace.blocks` et rend **tous** les composants `KyeNode` en même temps, qu'ils soient visibles à l'écran ou non.
*   **Impact :** Avec 1000 nœuds, React doit gérer 1000 composants et le navigateur doit gérer 1000 `div` dans le DOM. Le simple fait de déplacer le canvas ou de zoomer sera extrêmement lent, car cela forcera des calculs sur un très grand nombre d'éléments. La performance se dégradera de manière linéaire avec le nombre de nœuds.

#### **2. Mises à Jour d'État Coûteuses**

*   **Problème :** Le déplacement d'un nœud (`setPos` dans `KyeNode.tsx`) déclenche des mises à jour de l'état React à chaque mouvement de la souris.
*   **Impact :** Bien que React soit rapide, des milliers de mises à jour d'état par seconde lors du déplacement de plusieurs nœuds peuvent ralentir l'interface et la rendre moins réactive.

#### **3. Le Coût de l'Éditeur "Intégré"**

*   **Problème :** Si plusieurs éditeurs étaient ouverts en même temps, cela consommerait une quantité de mémoire considérable, chaque instance d'`AceEditor` étant une application complexe en soi.
*   **Impact :** Ralentissement général de l'application et consommation de mémoire élevée.

## Recommandations pour une Architecture Haute Performance

Pour atteindre le niveau de performance d'outils comme Obsidian Canvas ou Figma, il faut intégrer deux concepts clés : la **virtualisation** et la **séparation des composants lourds**.

#### **1. La Virtualisation du Canvas (L'Optimisation la Plus Importante)**

*   **Concept :** La "virtualisation" (ou "windowing") consiste à ne rendre que les éléments qui sont actuellement visibles dans le "viewport" (la partie visible du canvas). Si un nœud est en dehors de l'écran, on ne le rend tout simplement pas.
*   **Implémentation :**
    1.  Dans `KyeCanvas.tsx`, à chaque fois que le pan ou le zoom change, on calcule le rectangle visible du viewport.
    2.  On filtre la liste des `workspace.blocks` pour ne garder que ceux dont les coordonnées se trouvent à l'intérieur de ce rectangle.
    3.  On ne passe que cette liste filtrée de nœuds "visibles" au `map` pour le rendu.
*   **Impact :** Que vous ayez 100 ou 10 000 nœuds dans votre workspace, l'application ne rendra que les 10 ou 20 nœuds visibles à l'écran. La performance devient **constante**, quel que soit le nombre total de nœuds.

#### **2. L'Éditeur Flottant (Séparation des Composants Lourds)**

*   **Concept :** Comme détaillé dans l'audit précédent, on ne rend qu'une seule instance de l'éditeur, et seulement quand c'est nécessaire.
*   **Impact :**
    *   **Mémoire :** Consommation mémoire minimale, car un seul éditeur est actif à la fois.
    *   **Performance de Rendu :** Le canvas n'est pas ralenti par le rendu de l'éditeur, et l'éditeur n'est pas ralenti par les transformations du canvas. Les deux sont rapides et indépendants.

## Conclusion de l'Audit de Performance

L'architecture actuelle est une excellente base, mais elle n'est **pas scalable** en l'état.

Pour garantir une performance élevée, la meilleure architecture est la combinaison de :
1.  **Un Canvas Virtualisé :** Qui ne rend que les nœuds visibles.
2.  **Un Éditeur Flottant :** Qui n'est rendu qu'en cas de besoin et est découplé du canvas.

Cette combinaison vous donnera la performance et la fluidité nécessaires pour une application de canvas à grande échelle, tout en gardant un code propre et maintenable.

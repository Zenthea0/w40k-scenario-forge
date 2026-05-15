# W40K Scenario Forge

Outil de création de cartes de déploiement et de scénarios pour Warhammer 40,000.

## Fonctionnalités

### Éditeur de cartes
- Tables 60×44" et 44×30" en mode paysage
- Formes : droites, flèches (double), rectangles, triangles, cercles
- Marqueurs d'objectif (cercle 40mm + crâne)
- Texte configurable (noir/blanc, taille variable)
- Propriétés : couleur contour/remplissage, opacité, épaisseur, pointillé
- Arbre de construction avec gestion du z-order
- Grille 1" avec aimantation, affichable en premier plan
- Zoom (molette + pinch-to-zoom) et déplacement
- Saisie précise des coordonnées en pouces
- Export PNG à 200 DPI

### Éditeur de scénarios
- Titre, contexte narratif (texte riche)
- Association d'une carte de déploiement
- Règles spéciales structurées (nom + description)
- Objectifs primaires, secondaires et tertiaires
- Mise en forme : gras, italique, souligné, listes
- Aperçu A4 portrait adaptatif
- Export PDF

### Gestion de projets
- Jusqu'à 20 cartes et 20 scénarios
- Renommer, dupliquer, supprimer
- Sauvegarde automatique (localStorage)

## Installation

```bash
npm install
```

## Développement

```bash
npm run dev
```

## Déploiement sur GitHub Pages

1. Modifier `homepage` dans `package.json` avec votre username GitHub
2. Modifier `base` dans `vite.config.js` si le nom du repo change
3. Lancer :

```bash
npm run deploy
```

## Technologies

- React 19
- Vite 8
- SVG pour le rendu des cartes
- Aucune dépendance runtime externe

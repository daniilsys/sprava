# Direction Artistique - Sprava Landing

Ce document fixe la direction artistique de la landing Sprava pour la reutiliser dans l'app desktop.

## 1) Intent de marque

- Positionnement: plateforme community desktop-first, serieuse, rapide, technique.
- Ressenti recherche: precision, presence temps reel, confiance produit.
- Eviter: look marketing trop flashy, faux social proof, effets gratuits.

## 2) ADN visuel

- Base: dark UI profonde et sobre.
- Accent principal: amber chaud (signal/action).
- Accent secondaire: azure electrique (tech).
- Etat live: vert signal (presence instantanee).
- Contraste: texte clair net sur fond sombre, accent utilise avec parcimonie.

## 3) Palette officielle (tokens)

### Background

- `--color-bg`: `#08090C`
- `--color-surface`: `#0D0E15`
- `--color-elevated`: `#131420`
- `--color-elevated-2`: `#191A28`

### Borders

- `--color-border`: `#1E2030`
- `--color-border-subtle`: `#141520`
- `--color-border-strong`: `#2A2C40`

### Brand

- `--color-primary`: `#F0874C`
- `--color-primary-hover`: `#F59A62`
- `--color-primary-active`: `#E07640`
- `--color-secondary`: `#5B8EF4`
- `--color-live`: `#3EDBA8`

### Texte

- `--color-text-primary`: `#F0EEF9`
- `--color-text-secondary`: `#8A87A2`
- `--color-text-muted`: `#48465A`
- `--color-text-inverse`: `#08090C`

## 4) Typographie

- Display: `Syne` (headlines, impact, sections)
- Body: `Outfit` (texte courant, labels)
- Mono: `JetBrains Mono` (metadonnees, etats, tags techniques)

### Echelle

- Headline hero: `--text-7xl` max + tracking serre
- Titres de section: `--text-3xl` a `--text-5xl`
- Corps: `--text-base`/`--text-lg`
- Meta microcopy: `--text-xs`/`--text-sm`

## 5) Layout et rythme

- Largeur contenu: `--width-content` = `1180px`
- Espacement section: `--section-gap` (clamp)
- Pattern global: hero fort, sections centrees, grilles propres, densite controlee.
- Cartes: fond `surface`, bordure subtile, radius genereux (`xl`), hover discret.

## 6) Motion

- Courbes: `--ease-out` et `--ease-spring`
- Durees: 150ms (feedback), 250ms (hover), 600ms (entry)
- Animations permises:
  - reveal `fadeUp`/`fadeIn`
  - pulsation live (dot)
  - glow subtil sur CTA principal
- Regle: motion informative, jamais decorative uniquement.

## 7) Composants clefs a conserver

- CTA principal: amber plein, texte sombre, glow maitrise.
- CTA secondaire: surface sombre, bordure visible, etat hover plus eleve.
- Tags/pills: fond surface + border + mono/text-sm.
- Stat cards: valeur forte + label + sous-label discret.
- Sections: tete avec label, titre en 2 temps, accent gradient sur mot-cle.

## 8) Ton editorial

- Ton: clair, direct, technique, sans hype vide.
- Lexique: latence, presence, controle, desktop natif, fiabilite.
- Interdit: faux chiffres, faux avis, claims non verifies.
- Regle produit: afficher "Bientot" tant qu'une metrique n'est pas reellement mesuree.

## 9) Regles UX

- Focus visible obligatoire (`outline` amber).
- Contraste eleve sur tous les textes fonctionnels.
- Etats interactifs explicites (hover/active/focus).
- Scrollbar fine et discrete en desktop.

## 10) Transposition vers l'app desktop

Objectif: garder la meme identite, mais avec une densite et des patterns "outil".

### Mapping propose

- Sidebar app -> tons `elevated`, labels mono, etat actif avec `primary-subtle`.
- Zone contenu -> `surface` avec separation par bordures subtiles.
- Actions critiques -> primary amber uniquement pour CTA majeurs.
- Etat de presence/connecte -> live green reserve aux signaux temps reel.

### Grammaire desktop

- Nav laterale qui s'affiche quand on colle la souris à gauche (comme le navigateur Arc).
- Header compact par vue (titre + contexte + actions).
- Cartes utilitaires avec information hierarchisee (titre, meta, action).
- Modales: fond `surface`, overlay sombre, focus lock.

## 11) Do / Don't

### Do

- Garder les tokens existants comme source unique.
- Prioriser lisibilite et hiarchie avant l'effet visuel.
- Utiliser le gradient surtout sur titres hero/sections, pas partout.

### Don't

- Ne pas introduire une 4e couleur forte.
- Ne pas utiliser de glow permanent agressif.
- Ne pas ajouter de social proof non verifie.
- Ne pas surcharger en animations simultanees.

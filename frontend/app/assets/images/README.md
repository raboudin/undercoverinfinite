# Visuels des modes et des thèmes

Dépose les fichiers ici, il n'y a rien à déclarer dans le code :
`app/utils/gameArt.ts` les découvre au build. Tant qu'une image manque,
l'interface affiche un cartouche texte à sa place — aucune requête n'est faite,
et rien ne casse.

| Usage                                  | Chemin                                  | Taille      | Ratio |
| -------------------------------------- | --------------------------------------- | ----------- | ----- |
| Thème — fiche plein écran du carrousel | `themes/<id>.webp`                      | 1080 × 1350 | 4:5   |
| Thème — vignette du bouton thématique  | `themes/thumbs/<id>.webp`               | 192 × 192   | 1:1   |
| Mode — bandeau de la carte du menu     | `modes/<id>.webp`                       | 720 × 405   | 16:9  |

Les tailles visent un affichage ×3 (écrans Retina de téléphone) : la fiche
occupe au plus 360 pt de large, la vignette 64 pt, le bandeau 240 pt. Cadre au
centre, l'affichage est en `object-cover` et rogne les bords selon la hauteur
d'écran.

`.webp` est conseillé ; `.png`, `.jpg` et `.avif` fonctionnent aussi.

## Identifiants attendus

Ce sont ceux que sert l'API (`GET /packs`), pas des noms libres.

- **Modes** (`modes/`) : `classique`, `chrono`, `hot`, `defi`, `teams`, `pari`, `diy`
- **Thèmes** (`themes/` et `themes/thumbs/`) : `general`, `culture`, `nature`,
  `technologie`, `personnalites`, `pop-culture`, `football`, `pays-etats`,
  `histoire-arts`

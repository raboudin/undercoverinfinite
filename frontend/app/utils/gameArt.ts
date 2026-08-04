/**
 * Visuels des modes et des thèmes.
 *
 * Les fichiers sont **découverts au build** (`import.meta.glob`), pas devinés :
 * déposer une image dans le bon dossier suffit à l'afficher, et tant qu'elle
 * n'est pas là, `ArtSlot` montre un cartouche texte sans que le navigateur
 * n'aille chercher un fichier absent. Une URL construite à la main ferait un
 * 404 par visuel manquant, à chaque rendu.
 *
 * Où déposer quoi, et à quelle taille :
 *
 * | Usage                                   | Dossier                                    | Taille        | Ratio |
 * | --------------------------------------- | ------------------------------------------ | ------------- | ----- |
 * | Thème — fiche plein écran du carrousel  | `app/assets/images/themes/<id>.webp`       | 1080 × 1350   | 4:5   |
 * | Thème — vignette du bouton thématique   | `app/assets/images/themes/thumbs/<id>.webp`| 192 × 192     | 1:1   |
 * | Mode — bandeau de la carte du menu      | `app/assets/images/modes/<id>.webp`        | 720 × 405     | 16:9  |
 *
 * `<id>` est l'identifiant servi par l'API (`general`, `pop-culture`,
 * `classique`, `pari`…). Les tailles visent un affichage ×3 (écrans Retina de
 * téléphone) : la fiche occupe au plus 360 pt de large, la vignette 64 pt, le
 * bandeau 240 pt. Cadrer au centre — l'affichage est en `object-cover`.
 *
 * `.webp` est le format conseillé ; `.png`, `.jpg` et `.avif` marchent aussi,
 * il n'y a rien à changer ici pour en changer.
 */

export const THEME_HERO_SIZE = { width: 1080, height: 1350 } as const
export const THEME_THUMB_SIZE = { width: 192, height: 192 } as const
export const MODE_ART_SIZE = { width: 720, height: 405 } as const

type ArtModules = Record<string, string>

// Les options de `import.meta.glob` doivent être un littéral : Vite lit l'appel
// à la compilation, il ne peut pas suivre une constante.
const themeHeroes = import.meta.glob(
  '../assets/images/themes/*.{webp,png,jpg,jpeg,avif}',
  { eager: true, import: 'default', query: '?url' }
) as ArtModules
const themeThumbs = import.meta.glob(
  '../assets/images/themes/thumbs/*.{webp,png,jpg,jpeg,avif}',
  { eager: true, import: 'default', query: '?url' }
) as ArtModules
const modeArts = import.meta.glob(
  '../assets/images/modes/*.{webp,png,jpg,jpeg,avif}',
  { eager: true, import: 'default', query: '?url' }
) as ArtModules

/** Indexe les visuels trouvés par nom de fichier, extension retirée. */
function byId(modules: ArtModules): Record<string, string> {
  const index: Record<string, string> = {}
  for (const [path, url] of Object.entries(modules)) {
    const file = path.split('/').pop()
    if (!file) continue
    index[file.replace(/\.[^.]+$/, '')] = url
  }
  return index
}

const HEROES = byId(themeHeroes)
const THUMBS = byId(themeThumbs)
const MODES = byId(modeArts)

/** Fiche plein écran d'un thème, ou `null` tant que le visuel n'existe pas. */
export function themeHero(theme: string): string | null {
  return HEROES[theme] ?? null
}

/** Vignette carrée d'un thème, sur le bouton du menu. */
export function themeThumb(theme: string): string | null {
  return THUMBS[theme] ?? null
}

/** Bandeau d'un mode, sur sa carte du menu principal. */
export function modeArt(mode: string): string | null {
  return MODES[mode] ?? null
}

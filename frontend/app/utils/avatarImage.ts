/**
 * Réduction d'une photo choisie par l'agent en vignette carrée, dans le
 * navigateur, avant tout envoi.
 *
 * C'est le client qui redimensionne, et non l'API : une photo de téléphone
 * pèse plusieurs mégaoctets, l'envoyer entière pour n'en garder que 256 px
 * coûterait le téléversement complet sur un réseau mobile — et obligerait le
 * serveur à embarquer un décodeur d'images pour la ramener à cette taille.
 */

/** Côté de la vignette. Elle s'affiche à 96 px au plus : 256 couvre le retina. */
export const AVATAR_SIZE = 256

/**
 * Plafond aligné sur `MAX_AVATAR_BYTES` côté API. Dépasser ici donnerait un
 * 400 certain : autant baisser la qualité d'un cran avant d'envoyer.
 */
export const MAX_AVATAR_BYTES = 64 * 1024

/** Qualités tentées dans l'ordre, jusqu'à tenir sous le plafond. */
const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4]

/**
 * Fond appliqué sous l'image. Le JPEG ne connaît pas la transparence : sans
 * ça, une photo à fond transparent ressortirait sur du noir pur, plus sombre
 * que la surface qui l'entoure.
 */
const BACKDROP = '#1f2735'

export class AvatarImageError extends Error {}

/** Poids réel des octets encodés dans une data URL, sans les décoder. */
export function dataUrlByteLength(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

/** Type MIME déclaré en tête d'une data URL (`data:image/webp;base64,…`). */
export function dataUrlMimeType(dataUrl: string): string {
  return dataUrl.slice(5, dataUrl.indexOf(';'))
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.addEventListener('load', () => {
      URL.revokeObjectURL(url)
      resolve(image)
    })
    image.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      reject(new AvatarImageError('Cette image est illisible.'))
    })
    image.src = url
  })
}

/**
 * Recadre au centre puis dessine dans un carré de `AVATAR_SIZE`. Recadrer
 * plutôt que déformer : une photo écrasée pour tenir dans un carré est bien
 * plus visible qu'un bord perdu.
 */
function drawSquare(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE

  const context = canvas.getContext('2d')
  if (!context) throw new AvatarImageError('Cette image est illisible.')

  context.fillStyle = BACKDROP
  context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)

  const side = Math.min(image.naturalWidth, image.naturalHeight)
  if (!side) throw new AvatarImageError('Cette image est illisible.')

  context.drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE
  )
  return canvas
}

/**
 * Format de sortie. WebP quand le navigateur sait l'encoder — à qualité égale
 * il pèse nettement moins que le JPEG. Un navigateur qui ne le connaît pas
 * ignore l'argument et rend du PNG : on le détecte au préfixe rendu plutôt que
 * de tenir une liste de navigateurs.
 */
function preferredMimeType(canvas: HTMLCanvasElement): 'image/webp' | 'image/jpeg' {
  return dataUrlMimeType(canvas.toDataURL('image/webp', 0.5)) === 'image/webp'
    ? 'image/webp'
    : 'image/jpeg'
}

/**
 * Vignette prête à envoyer à `PUT /auth/me/avatar`.
 *
 * Lève une `AvatarImageError` (message affichable tel quel) si le fichier
 * n'est pas une image, ou si même la qualité la plus basse dépasse le plafond
 * — ce qui, à 256 px, ne devrait pas arriver.
 */
export async function toAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new AvatarImageError('Choisis un fichier image.')
  }

  const canvas = drawSquare(await loadImage(file))
  const mimeType = preferredMimeType(canvas)

  for (const quality of QUALITY_STEPS) {
    const dataUrl = canvas.toDataURL(mimeType, quality)
    if (dataUrlByteLength(dataUrl) <= MAX_AVATAR_BYTES) return dataUrl
  }

  throw new AvatarImageError('Cette image est trop lourde, même compressée.')
}

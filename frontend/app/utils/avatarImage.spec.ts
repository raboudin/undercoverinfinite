import { describe, expect, it } from 'vitest'
import { AvatarImageError, dataUrlByteLength, dataUrlMimeType, toAvatarDataUrl } from './avatarImage'

describe('dataUrlByteLength', () => {
  it.each([
    ['', 0],
    ['A', 1],
    ['AB', 2],
    ['ABC', 3],
    ['undercover', 10]
  ])('compte les octets réels de « %s »', (content, expected) => {
    const base64 = Buffer.from(content).toString('base64')

    expect(dataUrlByteLength(`data:image/webp;base64,${base64}`)).toBe(expected)
  })

  it('ne se laisse pas tromper par le remplissage base64', () => {
    // Sans le retrait du `=`, on surestimerait de deux octets — de quoi
    // rejeter une image qui passe en réalité sous le plafond.
    expect(dataUrlByteLength('data:image/webp;base64,QQ==')).toBe(1)
    expect(dataUrlByteLength('data:image/webp;base64,QUI=')).toBe(2)
  })
})

describe('dataUrlMimeType', () => {
  it('lit le type déclaré en tête', () => {
    expect(dataUrlMimeType('data:image/webp;base64,AAAA')).toBe('image/webp')
    expect(dataUrlMimeType('data:image/png;base64,AAAA')).toBe('image/png')
  })
})

describe('toAvatarDataUrl', () => {
  it('refuse un fichier qui n’est pas une image', async () => {
    // Contrôlé avant tout décodage : inutile de charger un PDF dans un canvas.
    const file = new File(['%PDF-1.4'], 'dossier.pdf', { type: 'application/pdf' })

    await expect(toAvatarDataUrl(file)).rejects.toBeInstanceOf(AvatarImageError)
  })
})

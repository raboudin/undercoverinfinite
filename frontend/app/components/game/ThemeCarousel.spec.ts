import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ThemeCarousel from './ThemeCarousel.vue'
import ArtSlot from './ArtSlot.vue'
import Button from '../core/Button.vue'
import IconButton from '../core/IconButton.vue'
import RoleTag from '../core/RoleTag.vue'
import type { ThemeCard } from '../../composables/useEntitlements'

// Teleport(to="body") sort de l'arbre du wrapper : sans ce ménage, chaque test
// laisserait sa feuille derrière lui.
afterEach(() => {
  document.body.innerHTML = ''
})

const global = { components: { ArtSlot, Button, IconButton, RoleTag } }

const THEMES: ThemeCard[] = [
  { id: 'general', label: 'Tous horizons', tagline: 'Tout le terrain.', generalist: true, unlocked: true },
  { id: 'culture', label: 'Culture', tagline: 'Livres et musique.', generalist: true, unlocked: true },
  { id: 'football', label: 'Football', tagline: 'Joueurs et clubs.', generalist: false, unlocked: false }
]

function carousel(props: Record<string, unknown> = {}) {
  return mount(ThemeCarousel, {
    props: { open: true, themes: THEMES, modelValue: 'general', ...props },
    global
  })
}

const dialog = () => document.body.textContent ?? ''
const arrow = (label: string) => new DOMWrapper(document.body.querySelector(`[aria-label="${label}"]`)!)
const nextArrow = () => arrow('Dossier suivant')
const prevArrow = () => arrow('Dossier précédent')

/** Le bouton d'action est le dernier de la feuille (pied de page). */
function actionButton() {
  const buttons = document.body.querySelectorAll('button')
  return new DOMWrapper(buttons[buttons.length - 1]!)
}

/** happy-dom ne construit pas de TouchEvent : un Event nu suffit au composant. */
function fireTouch(element: Element, type: string, clientX?: number) {
  const event = new Event(type, { bubbles: true }) as Event & { touches: { clientX: number }[] }
  event.touches = clientX === undefined ? [] : [{ clientX }]
  element.dispatchEvent(event)
}

async function swipe(distance: number) {
  const zone = document.body.querySelector('[aria-label="Dossier suivant"]')!.parentElement!
  fireTouch(zone, 'touchstart', 500)
  fireTouch(zone, 'touchmove', 500 + distance)
  fireTouch(zone, 'touchend')
  await nextTick()
}

describe('ThemeCarousel — affichage', () => {
  it('ne rend rien tant qu’il est fermé', () => {
    carousel({ open: false })
    expect(dialog()).not.toContain('Tous horizons')
  })

  it('affiche un seul dossier à la fois, en grand', () => {
    carousel()
    expect(dialog()).toContain('Tous horizons')
    expect(dialog()).toContain('Tout le terrain.')
    expect(dialog()).not.toContain('Culture')
  })

  it('s’ouvre sur le dossier déjà choisi', () => {
    carousel({ modelValue: 'football' })
    expect(dialog()).toContain('Football')
    expect(dialog()).toContain('3 / 3')
  })

  it('affiche le visuel plein écran du dossier', () => {
    carousel()
    expect(document.body.querySelector('img')?.getAttribute('src')).toContain('themes/general')
  })
})

describe('ThemeCarousel — navigation', () => {
  it('avance et recule d’un dossier', async () => {
    carousel()

    await nextArrow().trigger('click')
    expect(dialog()).toContain('Culture')

    await prevArrow().trigger('click')
    expect(dialog()).toContain('Tous horizons')
  })

  it('efface la flèche qui ne mène nulle part', async () => {
    carousel()
    expect(prevArrow().classes()).toContain('opacity-0')
    expect(nextArrow().classes()).not.toContain('opacity-0')

    await nextArrow().trigger('click')
    await nextArrow().trigger('click')

    expect(nextArrow().classes()).toContain('opacity-0')
    expect(prevArrow().classes()).not.toContain('opacity-0')
  })

  it('appuie la flèche quand le curseur approche du bord', async () => {
    carousel()
    const zone = document.body.querySelector('[aria-label="Dossier suivant"]')!.parentElement!
    zone.getBoundingClientRect = () => ({ left: 0, width: 400 }) as DOMRect

    expect(nextArrow().classes()).toContain('opacity-40')

    zone.dispatchEvent(Object.assign(new Event('mousemove', { bubbles: true }), { clientX: 380 }))
    await nextTick()
    expect(nextArrow().classes()).toContain('opacity-100')

    // De retour au centre, la flèche s'efface pour laisser voir l'illustration.
    zone.dispatchEvent(Object.assign(new Event('mousemove', { bubbles: true }), { clientX: 200 }))
    await nextTick()
    expect(nextArrow().classes()).toContain('opacity-40')
  })

  it('passe au dossier suivant au glissement vers la gauche', async () => {
    carousel()

    await swipe(-120)
    expect(dialog()).toContain('Culture')

    await swipe(120)
    expect(dialog()).toContain('Tous horizons')
  })

  it('ignore un glissement trop court', async () => {
    carousel()
    await swipe(-20)
    expect(dialog()).toContain('Tous horizons')
  })

  it('se pilote aussi au clavier', async () => {
    const wrapper = carousel()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await nextTick()
    expect(dialog()).toContain('Culture')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})

describe('ThemeCarousel — choix', () => {
  it('choisit le dossier affiché et referme', async () => {
    const wrapper = carousel()
    await nextArrow().trigger('click')

    await actionButton().trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['culture']])
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('renvoie un dossier scellé vers la boutique sans le choisir', async () => {
    const wrapper = carousel({ modelValue: 'football' })

    expect(dialog()).toContain('Débloquer dans la boutique')
    await actionButton().trigger('click')

    expect(wrapper.emitted('locked')).toEqual([['football']])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('se ferme depuis l’en-tête', async () => {
    const wrapper = carousel()
    await arrow('Fermer les dossiers').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('tient bon sans catalogue', () => {
    carousel({ themes: [] })
    expect(dialog()).toContain('Aucun dossier disponible')
  })
})

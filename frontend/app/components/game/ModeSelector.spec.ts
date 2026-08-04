import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ModeSelector from './ModeSelector.vue'
import ArtSlot from './ArtSlot.vue'
import type { ModeCard } from '../../composables/useEntitlements'

const global = { components: { ArtSlot } }

const MODES: ModeCard[] = [
  { id: 'classique', label: 'Classique', tagline: 'L’originale.', available: true, unlocked: true, playable: true },
  { id: 'hot', label: 'Hot', tagline: 'Mots osés.', available: true, spicy: true, unlocked: false, playable: false },
  { id: 'teams', label: 'Teams', tagline: 'Deux équipes.', available: false, unlocked: true, playable: false }
]

function selector(modelValue = 'classique') {
  return mount(ModeSelector, { props: { modes: MODES, modelValue }, global })
}

/** Bouton du mode, dans l'ordre du catalogue. */
function modeAt(wrapper: ReturnType<typeof selector>, index: number) {
  return wrapper.findAll('button')[index]!
}

describe('ModeSelector', () => {
  it('liste les modes du catalogue avec leur accroche', () => {
    const wrapper = selector()
    expect(wrapper.findAll('button')).toHaveLength(3)
    expect(wrapper.text()).toContain('Classique')
    expect(wrapper.text()).toContain('L’originale.')
  })

  /** Un emplacement d'illustration par mode, en cartouche tant qu'il est vide. */
  it('réserve un visuel à chaque mode', () => {
    const slots = selector().findAllComponents(ArtSlot)
    expect(slots).toHaveLength(3)
    expect(slots.map(slot => slot.text())).toEqual(['CL', 'HO', 'TE'])
  })

  it('marque le mode courant', () => {
    expect(modeAt(selector(), 0).attributes('aria-pressed')).toBe('true')
    expect(modeAt(selector(), 1).attributes('aria-pressed')).toBe('false')
  })

  it('sélectionne un mode débloqué', async () => {
    const wrapper = mount(ModeSelector, {
      props: {
        modes: [
          ...MODES,
          { id: 'chrono' as const, label: 'Chrono', tagline: '', available: true, unlocked: true, playable: true }
        ],
        modelValue: 'classique'
      },
      global
    })

    await modeAt(wrapper, 3).trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['chrono']])
  })

  it('renvoie un mode verrouillé vers la boutique sans le sélectionner', async () => {
    const wrapper = selector()

    await modeAt(wrapper, 1).trigger('click')

    expect(wrapper.emitted('locked')).toEqual([['hot']])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('affiche « à débloquer » sur un mode verrouillé', () => {
    expect(modeAt(selector(), 1).text()).toContain('À débloquer')
  })

  it('n’ouvre pas un mode débloqué mais pas encore écrit', async () => {
    const wrapper = selector()

    await modeAt(wrapper, 2).trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('locked')).toBeUndefined()
    expect(modeAt(wrapper, 2).text()).toContain('Bientôt')
  })

  it('ne rend rien sans catalogue', () => {
    const wrapper = mount(ModeSelector, { global })
    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})

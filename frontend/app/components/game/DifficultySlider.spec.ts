import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DifficultySlider from './DifficultySlider.vue'
import type { DifficultyCard } from '../../composables/useEntitlements'

const DIFFICULTIES: DifficultyCard[] = [
  { id: 'evident', level: 1, label: 'Évident', tagline: 'Une association immédiate.' },
  { id: 'facile', level: 2, label: 'Facile', tagline: 'Le lien saute aux yeux.' },
  { id: 'normal', level: 3, label: 'Normal', tagline: 'Assez proches pour bluffer.' },
  { id: 'difficile', level: 4, label: 'Difficile', tagline: 'Il faut vraiment chercher.' },
  { id: 'farfelu', level: 5, label: 'Farfelu', tagline: 'Un lien indirect.' }
]

describe('DifficultySlider', () => {
  it('affiche un cran par palier reçu', () => {
    const wrapper = mount(DifficultySlider, { props: { difficulties: DIFFICULTIES } })
    expect(wrapper.findAll('button')).toHaveLength(5)
  })

  it('affiche le libellé et l’accroche du palier choisi', () => {
    const wrapper = mount(DifficultySlider, {
      props: { difficulties: DIFFICULTIES, modelValue: 'difficile' }
    })
    expect(wrapper.text()).toContain('Difficile')
    expect(wrapper.text()).toContain('Il faut vraiment chercher.')
  })

  it('sélectionne un palier au clic', async () => {
    const wrapper = mount(DifficultySlider, {
      props: { difficulties: DIFFICULTIES, modelValue: 'normal' }
    })

    await wrapper.findAll('button')[4]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['farfelu']])
  })

  it('« normal » est la valeur par défaut sans modèle fourni', () => {
    const wrapper = mount(DifficultySlider, { props: { difficulties: DIFFICULTIES } })
    expect(wrapper.text()).toContain('Normal')
  })
})

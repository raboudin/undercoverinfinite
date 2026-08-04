import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ThemeButton from './ThemeButton.vue'
import ArtSlot from './ArtSlot.vue'
import type { ThemeCard } from '../../composables/useEntitlements'

const global = { components: { ArtSlot } }

const CULTURE: ThemeCard = {
  id: 'culture',
  label: 'Culture',
  tagline: 'Livres, musique, scène et traditions.',
  generalist: true,
  unlocked: true
}

describe('ThemeButton', () => {
  it('affiche le dossier choisi', () => {
    const wrapper = mount(ThemeButton, { props: { theme: CULTURE }, global })

    expect(wrapper.text()).toContain('Culture')
    expect(wrapper.text()).toContain('Livres, musique, scène et traditions.')
  })

  it('affiche la vignette du dossier', () => {
    const wrapper = mount(ThemeButton, { props: { theme: CULTURE }, global })
    expect(wrapper.get('img').attributes('src')).toContain('thumbs/culture')
  })

  /** Un thème sans vignette déposée tient sa place avec un cartouche, pas un 404. */
  it('retombe sur un cartouche quand la vignette manque', () => {
    const wrapper = mount(ThemeButton, {
      props: { theme: { ...CULTURE, id: 'inexistant' as typeof CULTURE.id, label: 'Culture' } },
      global
    })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.findComponent(ArtSlot).text()).toBe('CU')
  })

  it('invite à choisir tant qu’aucun dossier n’est connu', () => {
    const wrapper = mount(ThemeButton, { global })
    expect(wrapper.text()).toContain('À choisir')
  })

  it('ouvre la vitrine', async () => {
    const wrapper = mount(ThemeButton, { props: { theme: CULTURE }, global })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('se tait quand il est désactivé', async () => {
    const wrapper = mount(ThemeButton, { props: { theme: CULTURE, disabled: true }, global })

    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('open')).toBeUndefined()
  })
})

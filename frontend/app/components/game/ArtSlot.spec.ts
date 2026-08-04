import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ArtSlot from './ArtSlot.vue'

describe('ArtSlot', () => {
  it('affiche le visuel demandé', () => {
    const wrapper = mount(ArtSlot, { props: { src: '/images/themes/culture.webp', alt: 'Culture' } })
    expect(wrapper.get('img').attributes('src')).toBe('/images/themes/culture.webp')
  })

  /**
   * `gameArt` rend `null` tant que le fichier n'a pas été déposé : rien ne doit
   * être demandé au réseau, sinon chaque visuel manquant coûterait un 404.
   */
  it('ne demande aucun fichier tant qu’il n’y a pas de visuel', () => {
    const wrapper = mount(ArtSlot, { props: { src: null, monogram: 'Tous horizons' } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('TH')
  })

  it('retombe sur un cartouche quand le fichier n’existe pas encore', async () => {
    const wrapper = mount(ArtSlot, { props: { src: '/images/themes/absent.webp', monogram: 'Pop culture' } })

    await wrapper.get('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('PC')
  })

  it('réessaie le visuel suivant après un échec', async () => {
    const wrapper = mount(ArtSlot, { props: { src: '/images/themes/absent.webp', monogram: 'Culture' } })
    await wrapper.get('img').trigger('error')

    await wrapper.setProps({ src: '/images/themes/nature.webp' })

    expect(wrapper.get('img').attributes('src')).toBe('/images/themes/nature.webp')
  })

  it('réduit un libellé d’un seul mot à ses deux premières lettres', async () => {
    const wrapper = mount(ArtSlot, { props: { src: '/x.webp', monogram: 'Football' } })
    await wrapper.get('img').trigger('error')
    expect(wrapper.text()).toBe('FO')
  })
})

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AccountButton from './AccountButton.vue'
import IconButton from '../core/IconButton.vue'

const NuxtLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }
const global = { components: { IconButton }, stubs: { NuxtLink } }

describe('AccountButton', () => {
  it('n’affiche rien tant que la session n’est pas résolue', () => {
    const wrapper = mount(AccountButton, { global, props: { resolved: false } })

    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('propose la connexion à un visiteur anonyme', () => {
    const wrapper = mount(AccountButton, { global, props: { resolved: true } })

    expect(wrapper.get('a').attributes('href')).toBe('/connexion')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('affiche le nom de l’agent et permet de sortir', async () => {
    const wrapper = mount(AccountButton, {
      global,
      props: { resolved: true, label: 'Agent 42' }
    })

    expect(wrapper.text()).toContain('Agent 42')
    await wrapper.get('[aria-label="Se déconnecter"]').trigger('click')
    expect(wrapper.emitted('logout')).toHaveLength(1)
  })

  it('bloque le bouton pendant la déconnexion', () => {
    const wrapper = mount(AccountButton, {
      global,
      props: { resolved: true, label: 'Agent 42', pending: true }
    })

    expect(wrapper.get('[aria-label="Se déconnecter"]').attributes('disabled')).toBeDefined()
  })
})

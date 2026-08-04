import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, mount } from '@vue/test-utils'
import AccountButton from './AccountButton.vue'
import LogoutConfirm from './LogoutConfirm.vue'
import Button from '../core/Button.vue'
import IconButton from '../core/IconButton.vue'
import Avatar from '../data-display/Avatar.vue'
import Modal from '../feedback/Modal.vue'

const NuxtLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }
const global = {
  components: { Avatar, Button, IconButton, LogoutConfirm, Modal },
  stubs: { NuxtLink }
}

// LogoutConfirm passe par Modal, qui téléporte dans document.body.
afterEach(() => {
  document.body.innerHTML = ''
})

function modalButton(label: string) {
  const match = [...document.body.querySelectorAll('button')].find(
    button => button.textContent?.trim() === label
  )
  return new DOMWrapper(match!)
}

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

  it('affiche le nom de l’agent et mène à son dossier', () => {
    // Sans ce lien, /connexion serait injoignable une fois connecté : il n'y a
    // aucune autre entrée vers le dossier dans l'app.
    const wrapper = mount(AccountButton, {
      global,
      props: { resolved: true, label: 'Agent 42', initial: 'A' }
    })

    expect(wrapper.text()).toContain('Agent 42')
    expect(wrapper.get('a').attributes('href')).toBe('/connexion')
  })

  it('affiche la photo de profil quand il y en a une', () => {
    const wrapper = mount(AccountButton, {
      global,
      props: {
        resolved: true,
        label: 'Agent 42',
        initial: 'A',
        avatarUrl: 'http://api.test/auth/avatar/u1?v=1'
      }
    })

    expect(wrapper.get('img').attributes('src')).toBe('http://api.test/auth/avatar/u1?v=1')
  })

  it('demande confirmation avant de déconnecter', async () => {
    // Le bouton est dans l'en-tête, à portée de pouce en pleine partie.
    const wrapper = mount(AccountButton, {
      global,
      props: { resolved: true, label: 'Agent 42' }
    })

    await wrapper.get('[aria-label="Se déconnecter"]').trigger('click')
    expect(wrapper.emitted('logout')).toBeUndefined()
    expect(document.body.textContent).toContain('Quitter le QG')

    await modalButton('Se déconnecter').trigger('click')
    expect(wrapper.emitted('logout')).toHaveLength(1)
  })

  it('renonce à la déconnexion quand l’agent reste en poste', async () => {
    const wrapper = mount(AccountButton, {
      global,
      props: { resolved: true, label: 'Agent 42' }
    })
    await wrapper.get('[aria-label="Se déconnecter"]').trigger('click')

    await modalButton('Rester en poste').trigger('click')

    expect(wrapper.emitted('logout')).toBeUndefined()
    expect(document.body.textContent).not.toContain('Quitter le QG')
  })

  it('bloque le bouton pendant la déconnexion', () => {
    const wrapper = mount(AccountButton, {
      global,
      props: { resolved: true, label: 'Agent 42', pending: true }
    })

    expect(wrapper.get('[aria-label="Se déconnecter"]').attributes('disabled')).toBeDefined()
  })
})

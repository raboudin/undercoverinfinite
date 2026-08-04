import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, mount } from '@vue/test-utils'
import AgentDossier from './AgentDossier.vue'
import DeleteAccountDialog, { CONFIRMATION_PHRASE } from './DeleteAccountDialog.vue'
import LogoutConfirm from './LogoutConfirm.vue'
import Button from '../core/Button.vue'
import Avatar from '../data-display/Avatar.vue'
import Card from '../data-display/Card.vue'
import Modal from '../feedback/Modal.vue'
import Toast from '../feedback/Toast.vue'

const global = {
  components: { Avatar, Button, Card, DeleteAccountDialog, LogoutConfirm, Modal, Toast }
}

afterEach(() => {
  document.body.innerHTML = ''
})

function mountDossier(props: Record<string, unknown> = {}) {
  return mount(AgentDossier, {
    props: {
      label: 'Corbeau',
      email: 'agent@undercover.test',
      displayName: 'Corbeau',
      initial: 'C',
      ...props
    },
    global
  })
}

/**
 * Bouton d'un modal. Recherché dans `document.body` uniquement : les fenêtres
 * y sont téléportées, hors de l'arbre du wrapper — et « Se déconnecter »
 * existe des deux côtés, dans la carte comme dans la confirmation.
 */
function modalButton(label: string) {
  const match = [...document.body.querySelectorAll('button')].find(
    button => button.textContent?.trim() === label
  )
  return new DOMWrapper(match!)
}

/** Bouton retrouvé par son libellé, dans le composant ou dans un modal. */
function buttonNamed(wrapper: ReturnType<typeof mountDossier>, label: string) {
  const own = wrapper.findAll('button').find(b => b.text().trim() === label)
  return own ?? modalButton(label)
}

describe('AgentDossier', () => {
  it('présente l’agent, sa photo et son adresse', () => {
    const wrapper = mountDossier({ avatarUrl: 'http://api.test/auth/avatar/u1?v=1' })

    expect(wrapper.text()).toContain('Corbeau')
    expect(wrapper.text()).toContain('agent@undercover.test')
    expect(wrapper.get('img').attributes('src')).toBe('http://api.test/auth/avatar/u1?v=1')
  })

  it('n’enregistre le nom que s’il a changé', async () => {
    const wrapper = mountDossier()
    const save = buttonNamed(wrapper, 'Enregistrer')

    expect(save.attributes('disabled')).toBeDefined()

    await wrapper.get('input[type="text"]').setValue('Faucon')
    expect(save.attributes('disabled')).toBeUndefined()

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('rename')).toEqual([['Faucon']])
  })

  it('remonte le nom sans ses espaces', async () => {
    const wrapper = mountDossier()

    await wrapper.get('input[type="text"]').setValue('  Faucon  ')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('rename')).toEqual([['Faucon']])
  })

  it('suit le nom quand il change hors du champ', async () => {
    const wrapper = mountDossier()

    await wrapper.setProps({ displayName: 'Vipère' })

    expect(wrapper.get<HTMLInputElement>('input[type="text"]').element.value).toBe('Vipère')
  })

  it('propose de retirer la photo seulement quand il y en a une', async () => {
    const wrapper = mountDossier()
    expect(wrapper.text()).toContain('Ajouter une photo')
    expect(wrapper.text()).not.toContain('Retirer')

    await wrapper.setProps({ avatarUrl: 'http://api.test/auth/avatar/u1?v=1' })

    expect(wrapper.text()).toContain('Changer la photo')
    await buttonNamed(wrapper, 'Retirer').trigger('click')
    expect(wrapper.emitted('remove-photo')).toHaveLength(1)
  })

  it('remonte le fichier choisi sans le transformer', async () => {
    // La réduction en vignette a besoin d'un canvas : elle est faite par la
    // page, ce composant ne fait que transmettre le fichier.
    const wrapper = mountDossier()
    const file = new File(['octets'], 'photo.png', { type: 'image/png' })
    const input = wrapper.get<HTMLInputElement>('input[type="file"]')

    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')

    expect(wrapper.emitted('photo')).toEqual([[file]])
  })

  it('ne se déconnecte qu’après confirmation', async () => {
    const wrapper = mountDossier()

    await buttonNamed(wrapper, 'Se déconnecter').trigger('click')
    expect(wrapper.emitted('logout')).toBeUndefined()
    expect(document.body.textContent).toContain('Quitter le QG')

    // Le bouton du même nom, mais dans la fenêtre de confirmation.
    await modalButton('Se déconnecter').trigger('click')
    expect(wrapper.emitted('logout')).toHaveLength(1)
  })

  it('ne supprime le compte qu’après la phrase et le mot de passe', async () => {
    const wrapper = mountDossier()

    await buttonNamed(wrapper, 'Supprimer mon compte').trigger('click')
    expect(wrapper.emitted('delete-account')).toBeUndefined()

    const phrase = new DOMWrapper(
      document.body.querySelector<HTMLInputElement>('input[aria-label="Phrase de confirmation"]')!
    )
    const password = new DOMWrapper(
      document.body.querySelector<HTMLInputElement>('input[aria-label="Code d\'accès"]')!
    )
    await phrase.setValue(CONFIRMATION_PHRASE)
    await password.setValue('motdepasse-1')
    await buttonNamed(wrapper, 'Détruire le dossier').trigger('click')

    expect(wrapper.emitted('delete-account')).toEqual([['motdepasse-1']])
  })

  it('laisse la fenêtre ouverte quand l’API refuse la suppression', async () => {
    // Sinon il faudrait tout ressaisir après une simple faute de frappe.
    const wrapper = mountDossier()
    await buttonNamed(wrapper, 'Supprimer mon compte').trigger('click')

    await wrapper.setProps({ error: 'Mot de passe incorrect.' })

    expect(document.body.textContent).toContain('Détruire le dossier')
    expect(document.body.textContent).toContain('Mot de passe incorrect.')
  })

  it('gèle les commandes pendant un aller-retour', () => {
    const wrapper = mountDossier({ pending: true, displayName: null })

    for (const label of ['Ajouter une photo', 'Se déconnecter', 'Supprimer mon compte']) {
      expect(buttonNamed(wrapper, label).attributes('disabled')).toBeDefined()
    }
  })

  it('accuse réception d’un enregistrement', () => {
    const wrapper = mountDossier({ saved: true })

    expect(wrapper.text()).toContain('Dossier mis à jour.')
  })
})

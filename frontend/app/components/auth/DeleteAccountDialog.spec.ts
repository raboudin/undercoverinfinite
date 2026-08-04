import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, mount } from '@vue/test-utils'
import DeleteAccountDialog, { CONFIRMATION_PHRASE } from './DeleteAccountDialog.vue'
import Button from '../core/Button.vue'
import Modal from '../feedback/Modal.vue'
import Toast from '../feedback/Toast.vue'

const global = { components: { Button, Modal, Toast } }

afterEach(() => {
  document.body.innerHTML = ''
})

function modalButton(label: string) {
  const match = [...document.body.querySelectorAll('button')].find(
    button => button.textContent?.trim() === label
  )
  return new DOMWrapper(match!)
}

function field(ariaLabel: string) {
  return new DOMWrapper(
    document.body.querySelector<HTMLInputElement>(`input[aria-label="${ariaLabel}"]`)!
  )
}

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(DeleteAccountDialog, { props: { open: true, ...props }, global })
}

describe('DeleteAccountDialog', () => {
  it('annonce que l’opération est définitive', () => {
    mountDialog()

    expect(document.body.textContent).toContain('définitive')
  })

  it('n’active la destruction qu’avec la phrase ET le mot de passe', async () => {
    const wrapper = mountDialog()
    const destroy = modalButton('Détruire le dossier')

    expect(destroy.attributes('disabled')).toBeDefined()

    await field('Phrase de confirmation').setValue(CONFIRMATION_PHRASE)
    expect(destroy.attributes('disabled')).toBeDefined()

    await field("Code d'accès").setValue('motdepasse-1')
    expect(destroy.attributes('disabled')).toBeUndefined()

    await destroy.trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([['motdepasse-1']])
  })

  it('accepte la phrase quelle qu’en soit la casse', async () => {
    mountDialog()
    await field('Phrase de confirmation').setValue(CONFIRMATION_PHRASE.toLowerCase())
    await field("Code d'accès").setValue('motdepasse-1')

    expect(modalButton('Détruire le dossier').attributes('disabled')).toBeUndefined()
  })

  it('refuse une phrase approchante', async () => {
    mountDialog()
    await field('Phrase de confirmation').setValue('supprime')
    await field("Code d'accès").setValue('motdepasse-1')

    expect(modalButton('Détruire le dossier').attributes('disabled')).toBeDefined()
  })

  it('ne réclame pas de mot de passe à un compte OAuth', async () => {
    // Un compte ouvert via Google n'en a pas : lui en demander un le
    // bloquerait définitivement devant un champ impossible à remplir.
    const wrapper = mountDialog({ hasPassword: false })

    expect(document.body.querySelector('input[type="password"]')).toBeNull()

    await field('Phrase de confirmation').setValue(CONFIRMATION_PHRASE)
    await modalButton('Détruire le dossier').trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([[undefined]])
  })

  it('affiche le refus de l’API', () => {
    mountDialog({ error: 'Mot de passe incorrect.' })

    expect(document.body.textContent).toContain('Mot de passe incorrect.')
  })

  it('efface la saisie à chaque réouverture', async () => {
    const wrapper = mountDialog({ open: false })

    await wrapper.setProps({ open: true })
    await field('Phrase de confirmation').setValue(CONFIRMATION_PHRASE)
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })

    expect(field('Phrase de confirmation').element.value).toBe('')
    expect(modalButton('Détruire le dossier').attributes('disabled')).toBeDefined()
  })

  it('annule sans rien détruire', async () => {
    const wrapper = mountDialog()

    await modalButton('Annuler').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })
})

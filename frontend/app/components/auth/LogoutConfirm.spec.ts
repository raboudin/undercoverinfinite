import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, mount } from '@vue/test-utils'
import LogoutConfirm from './LogoutConfirm.vue'
import Button from '../core/Button.vue'
import Modal from '../feedback/Modal.vue'

const global = { components: { Button, Modal } }

// Modal utilise Teleport(to="body") : sans nettoyage, les instances des tests
// précédents s'empilent dans document.body.
afterEach(() => {
  document.body.innerHTML = ''
})

/** Retrouve un bouton du modal téléporté hors de l'arbre du wrapper. */
function modalButton(label: string) {
  const match = [...document.body.querySelectorAll('button')].find(
    button => button.textContent?.trim() === label
  )
  return new DOMWrapper(match!)
}

describe('LogoutConfirm', () => {
  it('ne montre rien tant qu’elle est fermée', () => {
    mount(LogoutConfirm, { props: { open: false }, global })

    expect(document.body.textContent).not.toContain('Quitter le QG')
  })

  it('confirme la sortie', async () => {
    const wrapper = mount(LogoutConfirm, { props: { open: true }, global })

    await modalButton('Se déconnecter').trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  it('laisse rester en poste', async () => {
    const wrapper = mount(LogoutConfirm, { props: { open: true }, global })

    await modalButton('Rester en poste').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('bloque la confirmation pendant la sortie', () => {
    mount(LogoutConfirm, { props: { open: true, pending: true }, global })

    expect(modalButton('Sortie…').attributes('disabled')).toBeDefined()
  })
})

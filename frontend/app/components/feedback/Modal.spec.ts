import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, mount } from '@vue/test-utils'
import Modal from './Modal.vue'

// Teleport(to="body") escapes the wrapper's own tree, so leftover instances
// from earlier tests would otherwise keep piling up in document.body.
afterEach(() => {
  document.body.innerHTML = ''
})

describe('Modal', () => {
  it('renders nothing in the DOM when closed', () => {
    mount(Modal, { props: { open: false } })
    expect(document.body.textContent).not.toContain('Confirmer')
  })

  it('teleports the title and slot content into the body when open', () => {
    mount(Modal, {
      props: { open: true, title: "Confirmer l'accusation" },
      slots: { default: '<p>Cette décision est irréversible.</p>' }
    })
    expect(document.body.textContent).toContain("Confirmer l'accusation")
    expect(document.body.textContent).toContain('Cette décision est irréversible.')
  })

  it('emits close when the scrim is clicked, but not when the panel is clicked', async () => {
    const wrapper = mount(Modal, { props: { open: true, title: 'Titre' } })

    // Teleported content lives in document.body, outside `wrapper`'s own tree.
    const panel = new DOMWrapper(document.body.querySelector('.rounded-md')!)
    await panel.trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()

    const scrim = new DOMWrapper(document.body.querySelector('.fixed.inset-0')!)
    await scrim.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})

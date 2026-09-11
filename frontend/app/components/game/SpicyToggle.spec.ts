import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SpicyToggle from './SpicyToggle.vue'

describe('SpicyToggle', () => {
  it('part désactivé par défaut', () => {
    const wrapper = mount(SpicyToggle)
    expect(wrapper.get('button').attributes('aria-checked')).toBe('false')
  })

  it('bascule au clic', async () => {
    const wrapper = mount(SpicyToggle, { props: { modelValue: false } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })

  it('reflète la valeur reçue', () => {
    const wrapper = mount(SpicyToggle, { props: { modelValue: true } })
    expect(wrapper.get('button').attributes('aria-checked')).toBe('true')
  })

  it('ne bascule pas quand il est désactivé', async () => {
    const wrapper = mount(SpicyToggle, { props: { modelValue: false, disabled: true } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

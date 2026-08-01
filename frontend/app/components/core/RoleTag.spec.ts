import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RoleTag from './RoleTag.vue'

describe('RoleTag', () => {
  it('renders slot content and defaults to neutral tone', () => {
    const wrapper = mount(RoleTag, { slots: { default: 'Grillé' } })
    expect(wrapper.text()).toBe('Grillé')
    expect(wrapper.classes()).toContain('bg-ink-4')
  })

  it.each([
    ['neutral', 'bg-ink-4'],
    ['ally', 'text-blue-3'],
    ['danger', 'bg-danger'],
    ['warning', 'text-amber-4'],
    ['classified', 'border-dashed']
  ] as const)('applies %s tone classes', (tone, expectedClass) => {
    const wrapper = mount(RoleTag, { props: { tone } })
    expect(wrapper.classes()).toContain(expectedClass)
  })
})

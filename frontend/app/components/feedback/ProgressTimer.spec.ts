import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProgressTimer from './ProgressTimer.vue'

describe('ProgressTimer', () => {
  it('sets the bar width from pct and hides the label row when no label is given', () => {
    const wrapper = mount(ProgressTimer, { props: { pct: 0.55 } })
    const style = wrapper.find('.rounded-pill.h-full').attributes('style') ?? ''
    const width = Number(style.match(/width:\s*([\d.]+)%/)?.[1])
    expect(width).toBeCloseTo(55)
    expect(wrapper.text()).toBe('')
  })

  it('renders the label and rounded percentage', () => {
    const wrapper = mount(ProgressTimer, { props: { pct: 0.474, label: 'TRANSMISSION 00:47' } })
    expect(wrapper.text()).toContain('TRANSMISSION 00:47')
    expect(wrapper.text()).toContain('47%')
  })

  it('switches to the danger fill and text color', () => {
    const wrapper = mount(ProgressTimer, { props: { pct: 0.1, label: 'VOTE 00:08', danger: true } })
    expect(wrapper.find('.rounded-pill.h-full').classes()).toContain('bg-danger')
    expect(wrapper.find('span.text-red-4').exists()).toBe(true)
  })
})

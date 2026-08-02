import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SetupScreen from './SetupScreen.vue'
import Button from '../core/Button.vue'
import IconButton from '../core/IconButton.vue'
import Card from '../data-display/Card.vue'
import Toast from '../feedback/Toast.vue'

// Les composants du design system sont auto-importés par Nuxt ; en test
// unitaire il faut les enregistrer explicitement.
const global = { components: { Button, IconButton, Card, Toast } }

const ADD_PLAYER = '[aria-label="Ajouter un agent"]'
const REMOVE_PLAYER = '[aria-label="Retirer un agent"]'
const ADD_UNDERCOVER = '[aria-label="Ajouter un undercover"]'
const REMOVE_UNDERCOVER = '[aria-label="Retirer un undercover"]'

describe('SetupScreen', () => {
  it('démarre avec quatre agents et un undercover', () => {
    const wrapper = mount(SetupScreen, { global })
    expect(wrapper.findAll('input')).toHaveLength(4)
    expect(wrapper.text()).toContain('3 loyaux · 1 infiltré')
  })

  it('ajoute et retire des champs de nom de code, dans les bornes du jeu', async () => {
    const wrapper = mount(SetupScreen, { global })

    await wrapper.get(ADD_PLAYER).trigger('click')
    expect(wrapper.findAll('input')).toHaveLength(5)

    for (let i = 0; i < 3; i++) await wrapper.get(REMOVE_PLAYER).trigger('click')
    expect(wrapper.findAll('input')).toHaveLength(3)

    // Plancher à 3 agents.
    await wrapper.get(REMOVE_PLAYER).trigger('click')
    expect(wrapper.findAll('input')).toHaveLength(3)
  })

  it('plafonne les undercovers pour garder les loyaux majoritaires', async () => {
    const wrapper = mount(SetupScreen, { global })

    // 4 agents : un seul undercover autorisé.
    await wrapper.get(ADD_UNDERCOVER).trigger('click')
    expect(wrapper.text()).toContain('3 loyaux · 1 infiltré')

    // 6 agents : le second undercover devient légal.
    await wrapper.get(ADD_PLAYER).trigger('click')
    await wrapper.get(ADD_PLAYER).trigger('click')
    await wrapper.get(ADD_UNDERCOVER).trigger('click')
    expect(wrapper.text()).toContain('4 loyaux · 2 infiltrés')
  })

  it('ramène le compte d’undercovers sous le plafond quand l’effectif baisse', async () => {
    const wrapper = mount(SetupScreen, { global })
    await wrapper.get(ADD_PLAYER).trigger('click')
    await wrapper.get(ADD_UNDERCOVER).trigger('click')
    expect(wrapper.text()).toContain('3 loyaux · 2 infiltrés')

    await wrapper.get(REMOVE_PLAYER).trigger('click')
    await wrapper.get(REMOVE_PLAYER).trigger('click')
    expect(wrapper.text()).toContain('2 loyaux · 1 infiltré')
  })

  it('ne descend jamais sous un undercover', async () => {
    const wrapper = mount(SetupScreen, { global })
    await wrapper.get(REMOVE_UNDERCOVER).trigger('click')
    expect(wrapper.text()).toContain('3 loyaux · 1 infiltré')
  })

  it('émet start avec les noms saisis et le nombre d’undercovers', async () => {
    const wrapper = mount(SetupScreen, { global })
    const inputs = wrapper.findAll('input')
    const names = ['Marion', 'Karim', 'Sami', 'Léa']
    for (const [index, input] of inputs.entries()) await input.setValue(names[index])

    await wrapper.findComponent(Button).trigger('click')

    expect(wrapper.emitted('start')).toEqual([[{ names, undercoverCount: 1 }]])
  })

  it('affiche l’erreur de validation renvoyée par le jeu', () => {
    const message = 'Deux agents ne peuvent pas partager le même nom de code.'
    const withoutError = mount(SetupScreen, { global })
    expect(withoutError.findComponent(Toast).exists()).toBe(false)

    const wrapper = mount(SetupScreen, { props: { error: message }, global })
    expect(wrapper.findComponent(Toast).text()).toBe(message)
  })
})

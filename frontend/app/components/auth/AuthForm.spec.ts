import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AuthForm from './AuthForm.vue'
import Button from '../core/Button.vue'
import Toast from '../feedback/Toast.vue'

// Les composants du design system sont auto-importés par Nuxt ; en test
// unitaire il faut les enregistrer explicitement.
const global = { components: { Button, Toast } }

/** Remplit email + mot de passe, seuls champs requis. */
async function fill(wrapper: ReturnType<typeof mount>, password = 'motdepasse-1') {
  await wrapper.get('input[type="email"]').setValue('agent@undercover.test')
  await wrapper.get('input[type="password"]').setValue(password)
}

describe('AuthForm', () => {
  it('émet les identifiants saisis', async () => {
    const wrapper = mount(AuthForm, { global })
    await fill(wrapper)

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]).toEqual([
      { email: 'agent@undercover.test', password: 'motdepasse-1' }
    ])
  })

  it('coupe les espaces autour de l’email', async () => {
    const wrapper = mount(AuthForm, { global })
    await wrapper.get('input[type="email"]').setValue('  agent@undercover.test  ')
    await wrapper.get('input[type="password"]').setValue('motdepasse-1')

    await wrapper.get('form').trigger('submit')

    const [payload] = wrapper.emitted('submit')![0] as [{ email: string }]
    expect(payload.email).toBe('agent@undercover.test')
  })

  it('n’affiche le nom de code qu’à l’inscription', async () => {
    const login = mount(AuthForm, { global })
    expect(login.findAll('input')).toHaveLength(2)

    const register = mount(AuthForm, { global, props: { mode: 'register' } })
    expect(register.findAll('input')).toHaveLength(3)
    expect(register.text()).toContain('Nom de code')
  })

  it('joint le nom de code quand il est renseigné', async () => {
    const wrapper = mount(AuthForm, { global, props: { mode: 'register' } })
    await wrapper.get('input[type="text"]').setValue('  Agent 42  ')
    await fill(wrapper)

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]).toEqual([
      { email: 'agent@undercover.test', password: 'motdepasse-1', displayName: 'Agent 42' }
    ])
  })

  it('refuse un mot de passe trop court à l’inscription, pas à la connexion', async () => {
    const register = mount(AuthForm, { global, props: { mode: 'register' } })
    await fill(register, 'court')
    await register.get('form').trigger('submit')
    expect(register.emitted('submit')).toBeUndefined()
    expect(register.text()).toContain('Encore 5 caractères')

    // Les règles ont pu changer depuis : un ancien compte doit rester joignable.
    const login = mount(AuthForm, { global })
    await fill(login, 'court')
    await login.get('form').trigger('submit')
    expect(login.emitted('submit')).toHaveLength(1)
  })

  it('n’émet rien tant que les champs sont vides ou pendant l’envoi', async () => {
    const empty = mount(AuthForm, { global })
    await empty.get('form').trigger('submit')
    expect(empty.emitted('submit')).toBeUndefined()

    const busy = mount(AuthForm, { global, props: { pending: true } })
    await fill(busy)
    await busy.get('form').trigger('submit')
    expect(busy.emitted('submit')).toBeUndefined()
    expect(busy.text()).toContain('Transmission…')
  })

  it('affiche l’erreur transmise', () => {
    const wrapper = mount(AuthForm, {
      global,
      props: { error: 'Email ou mot de passe incorrect.' }
    })

    expect(wrapper.findComponent(Toast).exists()).toBe(true)
    expect(wrapper.text()).toContain('Email ou mot de passe incorrect.')
  })

  it('ne propose Google que si l’API l’annonce', () => {
    const without = mount(AuthForm, { global })
    expect(without.find('a').exists()).toBe(false)

    const with_ = mount(AuthForm, {
      global,
      props: { googleUrl: 'http://api.test/auth/google' }
    })
    // Un vrai lien, pas un fetch : le navigateur doit suivre la redirection.
    expect(with_.get('a').attributes('href')).toBe('http://api.test/auth/google')
  })

  it('bascule entre connexion et inscription', async () => {
    const wrapper = mount(AuthForm, { global })

    await wrapper.get('button[type="button"]').trigger('click')

    expect(wrapper.emitted('update:mode')?.[0]).toEqual(['register'])
  })
})

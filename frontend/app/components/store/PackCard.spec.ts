import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PackCard from './PackCard.vue'
import Button from '../core/Button.vue'
import RoleTag from '../core/RoleTag.vue'
import Card from '../data-display/Card.vue'
import type { PackDefinition } from '../../composables/useEntitlements'

const global = { components: { Button, RoleTag, Card } }

const INFINITE: PackDefinition & { owned: boolean } = {
  id: 'infinite',
  label: 'Infinite',
  tagline: 'Tous les modes, tous les thèmes.',
  priceEur: 6.99,
  modes: ['chrono', 'hot', 'defi'],
  allThemes: true,
  unlimited: true,
  credits: 0,
  owned: false
}

const RECHARGE: PackDefinition & { owned: boolean } = {
  id: 'credits20',
  label: '20 crédits',
  tagline: 'Une recharge.',
  priceEur: 1.99,
  modes: [],
  allThemes: false,
  unlimited: false,
  credits: 20,
  owned: false
}

const MODE_LABELS = { chrono: 'Chrono', hot: 'Hot', defi: 'Défi' }

function card(pack = INFINITE, props: Record<string, unknown> = {}) {
  return mount(PackCard, {
    props: { pack, modeLabels: MODE_LABELS, ...props },
    global
  })
}

describe('PackCard', () => {
  it('affiche le prix en euros', () => {
    expect(card().text()).toContain('6,99')
  })

  it('dit que le pack est offert tant que le paiement n’est pas branché', () => {
    expect(card().text()).toContain('offert au lancement')
  })

  it('nomme les modes ouverts, avec les libellés du catalogue', () => {
    expect(card().text()).toContain('Modes : Chrono, Hot, Défi')
  })

  it('annonce le plafond quotidien d’un pack illimité', () => {
    expect(card(INFINITE, { unlimitedDailyCredits: 50 }).text()).toContain(
      'jusqu’à 50 par jour'
    )
  })

  it('annonce la réserve d’un pack de recharge', () => {
    const wrapper = card(RECHARGE)
    expect(wrapper.text()).toContain('20 missions ajoutées à ta réserve')
    expect(wrapper.text()).not.toContain('par jour')
  })

  it('distingue tous les thèmes des seuls généralistes', () => {
    expect(card().text()).toContain('Tous les thèmes')
    expect(card(RECHARGE).text()).toContain('Thèmes généralistes')
  })

  it('émet unlock au clic', async () => {
    const wrapper = card()

    await wrapper.findComponent(Button).trigger('click')

    expect(wrapper.emitted('unlock')).toHaveLength(1)
  })

  it('renvoie vers la connexion sans compte', async () => {
    const wrapper = card(INFINITE, { account: false })

    expect(wrapper.text()).toContain('Créer un dossier d’agent')
    await wrapper.findComponent(Button).trigger('click')

    expect(wrapper.emitted('signIn')).toHaveLength(1)
    expect(wrapper.emitted('unlock')).toBeUndefined()
  })

  it('remplace le bouton par une pastille quand le pack est déjà là', () => {
    const wrapper = card({ ...INFINITE, owned: true })

    expect(wrapper.findComponent(RoleTag).text()).toBe('Rattaché à ton dossier')
    expect(wrapper.findComponent(Button).exists()).toBe(false)
  })

  it('bloque le bouton pendant un déblocage en cours', () => {
    expect(
      card(INFINITE, { pending: true }).findComponent(Button).attributes('disabled')
    ).toBeDefined()
  })
})

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import GameTable, { type TableSeat } from './GameTable.vue'
import { seatLayout } from '../../utils/tableLayout'

function seats(count: number, extra: Partial<TableSeat> = {}): TableSeat[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `agent-${index}`,
    name: `Agent ${index + 1}`,
    ...extra
  }))
}

function table(props: Record<string, unknown>) {
  return mount(GameTable, { props: { seats: seats(4), ...props } })
}

describe('GameTable — plateau', () => {
  /** La géométrie elle-même est vérifiée dans `utils/tableLayout.spec.ts`. */
  it('place chaque siège là où la géométrie le demande', () => {
    const placed = table({ seats: seats(4) }).findAll('.flip-scene')
    const { seat, positions } = seatLayout(4)

    expect(placed).toHaveLength(4)
    placed.forEach((scene, index) => {
      const style = scene.attributes('style')!
      expect(style).toContain(`left: ${positions[index]!.left}%`)
      expect(style).toContain(`top: ${positions[index]!.top}%`)
      expect(style).toContain(`width: ${seat}%`)
    })
  })

  it('passe les cartes au carré dès que la table se remplit', () => {
    expect(table({ seats: seats(4) }).get('.flip-card').classes()).toContain('aspect-[4/5]')
    expect(table({ seats: seats(9) }).get('.flip-card').classes()).toContain('aspect-square')
  })

  it('numérote les sièges et affiche les noms', () => {
    const wrapper = table({ seats: seats(3) })
    expect(wrapper.text()).toContain('01')
    expect(wrapper.text()).toContain('Agent 3')
  })

  it('rend le contenu central passé en slot', () => {
    const wrapper = mount(GameTable, {
      props: { seats: seats(3) },
      slots: { default: '<p>Manche 2</p>' }
    })
    expect(wrapper.text()).toContain('Manche 2')
  })
})

describe('GameTable — sélection', () => {
  it('ne rend des boutons que quand la table est jouable', () => {
    expect(table({ seats: seats(4) }).findAll('button')).toHaveLength(0)
    expect(table({ seats: seats(4), selectable: true }).findAll('button')).toHaveLength(4)
  })

  it('remonte le siège touché', async () => {
    const wrapper = table({ seats: seats(4), selectable: true })

    await wrapper.findAll('button')[2]!.trigger('click')

    expect(wrapper.emitted('select')).toEqual([['agent-2']])
  })

  it('ignore un siège désactivé', async () => {
    const wrapper = table({
      seats: seats(4).map((seat, index) => ({ ...seat, disabled: index !== 1 })),
      selectable: true
    })

    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()

    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['agent-1']])
  })

  it('marque le siège courant', () => {
    const wrapper = table({ seats: seats(4), selectable: true, selectedId: 'agent-1' })
    const pressed = wrapper.findAll('button').map(button => button.attributes('aria-pressed'))
    expect(pressed).toEqual(['false', 'true', 'false', 'false'])
  })

  it('nomme le geste proposé pour les lecteurs d’écran', () => {
    const wrapper = table({ seats: seats(3), selectable: true, actionLabel: 'Accuser' })
    expect(wrapper.get('button').attributes('aria-label')).toBe('Accuser Agent 1')
  })
})

describe('GameTable — cartes', () => {
  it('laisse les cartes face cachée par défaut', () => {
    const wrapper = table({ seats: seats(4, { word: 'Canapé' }) })
    expect(wrapper.findAll('.flip-card--up')).toHaveLength(0)
  })

  /**
   * `backface-visibility` cache la face au regard, pas au DOM : le mot ne doit
   * pas être dans la page tant que la carte n'est pas retournée.
   */
  it('ne met le mot dans la page qu’une fois la carte retournée', () => {
    expect(table({ seats: seats(4, { word: 'Canapé' }) }).text()).not.toContain('Canapé')
    expect(table({ seats: seats(4, { word: 'Canapé', faceUp: true }) }).text()).toContain('Canapé')
  })

  it('retourne la carte demandée et y montre le mot', () => {
    const wrapper = table({
      seats: seats(4).map((seat, index) =>
        index === 2 ? { ...seat, faceUp: true, word: 'Fauteuil' } : seat
      )
    })

    const flipped = wrapper.findAll('.flip-card')
    expect(flipped[2]!.classes()).toContain('flip-card--up')
    expect(flipped[0]!.classes()).not.toContain('flip-card--up')
    expect(flipped[2]!.text()).toContain('Fauteuil')
  })

  /**
   * Le cœur de la règle : retourner une carte montre le mot, jamais le camp.
   * Un siège n'a même pas de quoi porter cette information.
   */
  it('ne connaît pas les rôles', () => {
    const wrapper = table({
      seats: seats(4).map(seat => ({ ...seat, faceUp: true, word: 'Fauteuil' }))
    })
    expect(wrapper.text().toLowerCase()).not.toContain('undercover')
    expect(wrapper.text().toLowerCase()).not.toContain('loyal')
  })

  it('distingue les états d’un siège', () => {
    const wrapper = table({
      seats: [
        { id: 'a', name: '', state: 'empty' as const },
        { id: 'b', name: 'Karim', state: 'active' as const },
        { id: 'c', name: 'Léa', state: 'eliminated' as const }
      ]
    })

    const cards = wrapper.findAll('.flip-card')
    expect(cards[0]!.classes()).toContain('border-dashed')
    expect(cards[1]!.classes()).toContain('shadow-glow-recon')
    expect(cards[2]!.classes()).toContain('border-red-9')
  })

  /**
   * Une `opacity` sur la carte aplatirait son contexte `preserve-3d` : la face
   * cachée resterait visible, en miroir, une fois la carte retournée.
   */
  it('atténue un siège grillé sur la scène, pas sur la carte', () => {
    const wrapper = table({
      seats: [{ id: 'a', name: 'Léa', state: 'eliminated' as const, faceUp: true, word: 'Visa' }]
    })

    expect(wrapper.get('.flip-scene').classes()).toContain('opacity-60')
    expect(wrapper.get('.flip-card').classes()).not.toContain('opacity-60')
  })
})

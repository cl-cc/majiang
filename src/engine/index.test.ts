import { describe, expect, it } from 'vitest'
import { createDeck, deal, shuffle } from './index'

describe('规则引擎公开接口', () => {
  it('可以完成建牌、洗牌和四人发牌', () => {
    const deck = createDeck()
    const shuffled = shuffle(deck, () => 0)
    const result = deal(shuffled, 0)
    const allIds = [
      ...result.hands.flatMap((hand) => hand.map((tile) => tile.id)),
      ...result.wall.map((tile) => tile.id),
    ]

    expect(shuffled).toHaveLength(136)
    expect(result.hands.map((hand) => hand.length)).toEqual([14, 13, 13, 13])
    expect(result.wall).toHaveLength(83)
    expect([...allIds].sort((left, right) => left - right)).toEqual(deck.map((tile) => tile.id))
  })
})

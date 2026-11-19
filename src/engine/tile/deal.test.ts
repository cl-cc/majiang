import { describe, expect, it } from 'vitest'
import { createDeck } from './deck'
import { DEALER_HAND_SIZE, DEALT_TILE_COUNT, HAND_SIZE, WALL_SIZE, deal } from './deal'
import { TILE_COUNT } from './types'

function ids(items: readonly { readonly id: number }[]): number[] {
  return items.map((item) => item.id)
}

describe('deal', () => {
  it('庄家 14 张，三家闲家各 13 张，牌墙按原顺序留下 83 张', () => {
    const deck = createDeck()
    const result = deal(deck, 0)
    const dealt = result.hands.flatMap((hand) => ids(hand))

    expect(HAND_SIZE).toBe(13)
    expect(DEALER_HAND_SIZE).toBe(14)
    expect(DEALT_TILE_COUNT).toBe(53)
    expect(WALL_SIZE).toBe(83)
    expect(result.dealerIndex).toBe(0)
    expect(result.hands.map((hand) => hand.length)).toEqual([14, 13, 13, 13])
    expect(result.wall).toHaveLength(83)
    expect(ids(result.wall)).toEqual(ids(deck.slice(DEALT_TILE_COUNT)))
    expect([...dealt, ...ids(result.wall)].sort((left, right) => left - right)).toEqual(ids(deck))
    expect(new Set([...dealt, ...ids(result.wall)]).size).toBe(TILE_COUNT)
  })

  it('默认从座位 0 开始，按三轮四张、一轮一张，再给庄家补一张', () => {
    const result = deal(createDeck())

    expect(ids(result.hands[0])).toEqual([
      0, 1, 2, 3, 16, 17, 18, 19, 32, 33, 34, 35, 48, 52,
    ])
    expect(ids(result.hands[1])).toEqual([
      4, 5, 6, 7, 20, 21, 22, 23, 36, 37, 38, 39, 49,
    ])
    expect(ids(result.hands[2])).toEqual([
      8, 9, 10, 11, 24, 25, 26, 27, 40, 41, 42, 43, 50,
    ])
    expect(ids(result.hands[3])).toEqual([
      12, 13, 14, 15, 28, 29, 30, 31, 44, 45, 46, 47, 51,
    ])
    expect(result.wall[0]?.id).toBe(53)
    expect(result.wall.at(-1)?.id).toBe(135)
  })

  it('换庄家只改发牌对象，不改牌墙顺序，也不重新洗牌', () => {
    const deck = createDeck()
    const result = deal(deck, 1)

    expect(result.dealerIndex).toBe(1)
    expect(result.hands.map((hand) => hand.length)).toEqual([13, 14, 13, 13])
    expect(result.hands[1][0]?.id).toBe(0)
    expect(result.hands[1].at(-1)?.id).toBe(52)
    expect(result.hands[0][0]?.id).toBe(12)
    expect(ids(result.wall)).toEqual(ids(deck.slice(DEALT_TILE_COUNT)))
    expect(deal(deck, 1).hands.map(ids)).toEqual(result.hands.map(ids))
  })

  it('不改动传入的牌墙', () => {
    const deck = createDeck()
    const before = ids(deck)

    deal(deck, 2)

    expect(ids(deck)).toEqual(before)
    expect(Object.isFrozen(deck)).toBe(true)
  })

  it('手牌和牌墙结果不能被改写', () => {
    const result = deal(createDeck(), 3)

    expect(result.hands[3]).toHaveLength(14)
    expect(result.hands[3][0]?.id).toBe(0)
    expect(result.hands[3].at(-1)?.id).toBe(52)
    expect(Object.isFrozen(result.hands[3])).toBe(true)
    expect(Object.isFrozen(result.wall)).toBe(true)
    expect(() => {
      Object.assign(result.wall, { 0: result.hands[0][0] })
    }).toThrow(TypeError)
  })

  it('拒绝不完整、有重复或庄家座位非法的牌墙', () => {
    const deck = createDeck().slice()
    const duplicate = deck.slice()
    duplicate[135] = duplicate[0]!

    expect(() => deal(deck.slice(0, 135), 0)).toThrow(/136/)
    expect(() => deal(duplicate, 0)).toThrow(/重复/)
    expect(() => deal(deck, 4)).toThrow(/庄家/)
    expect(() => deal(deck, -1)).toThrow(/庄家/)
    expect(() => deal(deck, 1.5)).toThrow(/庄家/)
  })
})

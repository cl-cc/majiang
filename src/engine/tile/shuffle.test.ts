import { describe, expect, it } from 'vitest'
import { createDeck } from './deck'
import { shuffle } from './shuffle'
import { TILE_COUNT } from './types'

function ids(items: readonly { readonly id: number }[]): number[] {
  return items.map((item) => item.id)
}

describe('shuffle', () => {
  it('使用 Fisher-Yates，随机数总是取 0 时得到确定排列', () => {
    expect(shuffle([0, 1, 2, 3], () => 0)).toEqual([1, 2, 3, 0])
  })

  it('随机数接近 1 时保持原顺序', () => {
    const deck = createDeck()
    const shuffled = shuffle(deck, () => 0.999999)

    expect(ids(shuffled)).toEqual(ids(deck))
    expect(shuffled).not.toBe(deck)
  })

  it('不改动原来的牌组，结果仍是同一副牌', () => {
    const deck = createDeck()
    const before = ids(deck)
    const shuffled = shuffle(deck, () => 0)

    expect(ids(deck)).toEqual(before)
    expect(ids(shuffled).sort((left, right) => left - right)).toEqual(before)
    expect(ids(shuffled)).not.toEqual(before)
    expect(new Set(ids(shuffled)).size).toBe(TILE_COUNT)
  })

  it('同一个随机源得到同一个顺序', () => {
    const deck = createDeck()
    const first = shuffle(deck, () => 0.25)
    const second = shuffle(deck, () => 0.25)

    expect(ids(first)).toEqual(ids(second))
    expect(ids(first)).not.toEqual(ids(deck))
  })

  it('默认洗牌只改变顺序，不增删牌', () => {
    const deck = createDeck()
    const first = shuffle(deck)
    const second = shuffle(deck)

    expect([...ids(first)].sort((left, right) => left - right)).toEqual(ids(deck))
    expect([...ids(second)].sort((left, right) => left - right)).toEqual(ids(deck))
    expect(ids(first)).not.toEqual(ids(deck))
    expect(ids(first)).not.toEqual(ids(second))
  })

  it('拒绝越界随机数，并且不改动原数组', () => {
    const source = [0, 1, 2, 3]

    expect(() => shuffle(source, () => 1)).toThrow(/随机源/)
    expect(() => shuffle(source, () => -0.1)).toThrow(/随机源/)
    expect(() => shuffle(source, () => Number.NaN)).toThrow(/随机源/)
    expect(source).toEqual([0, 1, 2, 3])
  })

  it('不足两张时不取随机数', () => {
    const random = (): number => {
      throw new Error('不应取随机数')
    }

    expect(shuffle([], random)).toEqual([])
    expect(shuffle(['东'], random)).toEqual(['东'])
  })
})

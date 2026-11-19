import { describe, expect, it } from 'vitest'
import { createDeck } from './deck'
import {
  COPIES_PER_FACE,
  DRAGONS,
  FACE_COUNT,
  NUMBER_SUITS,
  RANKS,
  TILE_COUNT,
  WINDS,
  faceKey,
  isSameFace,
  tileLabel,
} from './types'
import type { TileKind } from './types'

const RANK_CHARS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'] as const

describe('createDeck', () => {
  it('生成 136 张牌，没有花牌', () => {
    const deck = createDeck()
    const categories = new Set(deck.map((tile) => tile.kind.category))

    expect(TILE_COUNT).toBe(136)
    expect(FACE_COUNT).toBe(34)
    expect(deck).toHaveLength(136)
    expect(categories).toEqual(new Set(['number', 'wind', 'dragon']))
    expect(deck.filter((tile) => tile.kind.category === 'number')).toHaveLength(108)
    expect(deck.filter((tile) => tile.kind.category === 'wind')).toHaveLength(16)
    expect(deck.filter((tile) => tile.kind.category === 'dragon')).toHaveLength(12)
  })

  it('每张实体牌有独立 id，每种牌面正好 4 张', () => {
    const deck = createDeck()
    const ids = deck.map((tile) => tile.id)
    const counts = new Map<string, number>()

    for (const tile of deck) {
      const key = faceKey(tile.kind)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    expect(ids).toEqual(Array.from({ length: TILE_COUNT }, (_, index) => index))
    expect(new Set(ids).size).toBe(TILE_COUNT)
    expect(counts.size).toBe(FACE_COUNT)
    expect([...counts.values()].every((count) => count === COPIES_PER_FACE)).toBe(true)
  })

  it('牌名覆盖万条筒、东南西北和中发白', () => {
    const deck = createDeck()
    const labels = new Set(deck.map((tile) => tileLabel(tile.kind)))
    const expected = new Set<string>()

    for (const suit of [
      ['wan', '万'],
      ['tiao', '条'],
      ['tong', '筒'],
    ] as const) {
      for (const rank of RANKS) {
        expected.add(`${RANK_CHARS[rank - 1]}${suit[1]}`)
      }
    }
    for (const label of ['东', '南', '西', '北', '中', '发', '白']) {
      expected.add(label)
    }

    expect(labels).toEqual(expected)
    expect(tileLabel(deck[0]!.kind)).toBe('一万')
    expect(tileLabel(deck[35]!.kind)).toBe('九万')
    expect(tileLabel(deck[36]!.kind)).toBe('一条')
    expect(tileLabel(deck[71]!.kind)).toBe('九条')
    expect(tileLabel(deck[72]!.kind)).toBe('一筒')
    expect(tileLabel(deck[107]!.kind)).toBe('九筒')
    expect(tileLabel(deck[108]!.kind)).toBe('东')
    expect(tileLabel(deck[112]!.kind)).toBe('南')
    expect(tileLabel(deck[116]!.kind)).toBe('西')
    expect(tileLabel(deck[120]!.kind)).toBe('北')
    expect(tileLabel(deck[124]!.kind)).toBe('中')
    expect(tileLabel(deck[128]!.kind)).toBe('发')
    expect(tileLabel(deck[135]!.kind)).toBe('白')
  })

  it('数牌、风牌、箭牌的结构完整', () => {
    const deck = createDeck()
    const suits = new Set(
      deck.flatMap((tile) => (tile.kind.category === 'number' ? [tile.kind.suit] : [])),
    )
    const ranks = new Set(
      deck.flatMap((tile) => (tile.kind.category === 'number' ? [tile.kind.rank] : [])),
    )
    const winds = deck.flatMap((tile) => (tile.kind.category === 'wind' ? [tile.kind.wind] : []))
    const dragons = deck.flatMap((tile) =>
      tile.kind.category === 'dragon' ? [tile.kind.dragon] : [],
    )

    expect(suits).toEqual(new Set(NUMBER_SUITS))
    expect(ranks).toEqual(new Set(RANKS))
    expect(winds).toEqual(WINDS.flatMap((wind) => Array<typeof wind>(COPIES_PER_FACE).fill(wind)))
    expect(dragons).toEqual(
      DRAGONS.flatMap((dragon) => Array<typeof dragon>(COPIES_PER_FACE).fill(dragon)),
    )
  })

  it('相同牌面可以识别，不同实体牌不会被当成同一张', () => {
    const deck = createDeck()
    const copies = deck.filter((tile) => tileLabel(tile.kind) === '五万')
    const first = copies[0]
    const second = copies[1]
    const different = deck.find((tile) => tileLabel(tile.kind) === '五万')

    expect(copies).toHaveLength(4)
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(first!.id).not.toBe(second!.id)
    expect(isSameFace(first!.kind, second!.kind)).toBe(true)
    expect(isSameFace(first!.kind, deck[108]!.kind)).toBe(false)
    expect(different!.kind).toEqual(first!.kind)
  })

  it('牌和牌面都不能被改写', () => {
    const tile = createDeck()[0]!

    expect(Object.isFrozen(tile)).toBe(true)
    expect(Object.isFrozen(tile.kind)).toBe(true)
    expect(() => {
      Object.assign(tile.kind, { rank: 9 })
    }).toThrow(TypeError)
  })

  it('每次生成独立的一副牌，编号规则保持稳定', () => {
    const first = createDeck()
    const second = createDeck()

    expect(first).not.toBe(second)
    expect(first[0]).not.toBe(second[0])
    expect(first.map((tile) => tile.id)).toEqual(second.map((tile) => tile.id))
    expect(Object.isFrozen(first)).toBe(true)
  })
})

describe('isSameFace', () => {
  it('只比较牌面，不比较是第几张', () => {
    const wan: TileKind = { category: 'number', suit: 'wan', rank: 1 }
    const anotherWan: TileKind = { category: 'number', suit: 'wan', rank: 1 }
    const tiao: TileKind = { category: 'number', suit: 'tiao', rank: 1 }
    const east: TileKind = { category: 'wind', wind: 'east' }
    const south: TileKind = { category: 'wind', wind: 'south' }
    const zhong: TileKind = { category: 'dragon', dragon: 'zhong' }
    const fa: TileKind = { category: 'dragon', dragon: 'fa' }

    expect(isSameFace(wan, anotherWan)).toBe(true)
    expect(isSameFace(wan, tiao)).toBe(false)
    expect(isSameFace(east, south)).toBe(false)
    expect(isSameFace(zhong, fa)).toBe(false)
    expect(isSameFace(east, zhong)).toBe(false)
  })
})

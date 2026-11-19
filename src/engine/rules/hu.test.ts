import { describe, expect, it } from 'vitest'
import type { Tile } from '../tile/types'
import { canHu } from './hu'
import type { AnGangMeld, ChiMeld, PengMeld } from './meld'
import { isMenqing } from './meld'
import { createBag, ids, takeAll } from './test-bag'

function pengOf(tiles: readonly [Tile, Tile, Tile], from: 0 | 1 | 2 | 3 = 0): PengMeld {
  return { type: 'peng', tiles, from, claimed: tiles[0] }
}

function chiOf(tiles: readonly [Tile, Tile, Tile], from: 0 | 1 | 2 | 3 = 0): ChiMeld {
  return { type: 'chi', tiles, from, claimed: tiles[0] }
}

describe('标准平胡', () => {
  it('四组顺子加一对可以胡', () => {
    const bag = createBag()
    const hand = takeAll(bag, [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 1], ['二条', 1], ['三条', 1],
      ['九筒', 1],
    ])
    const eye = bag.take('九筒')[0]!
    const before = ids(hand)

    const result = canHu(hand, eye)

    expect(result).toMatchObject({ pattern: 'standard', standard: true, sevenPairs: false, pengPeng: false })
    expect(ids(hand)).toEqual(before)
  })

  it('已经在手里的进张不会被重复计算', () => {
    const bag = createBag()
    const hand = takeAll(bag, [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 1], ['二条', 1], ['三条', 1],
      ['九筒', 2],
    ])
    const frozen = Object.freeze(hand.slice())

    expect(canHu(frozen, frozen[13]!)?.pattern).toBe('standard')
    expect(frozen).toHaveLength(14)
  })

  it('差一张、牌数不对或顺子不连续都不能胡', () => {
    const bag = createBag()
    const waiting = takeAll(bag, [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 1], ['二条', 1], ['三条', 1],
      ['九筒', 1],
    ])

    expect(canHu(waiting, bag.take('八筒')[0]!)).toBeNull()
    expect(canHu(waiting, bag.take('九万')[0]!)).toBeNull()
    expect(canHu(waiting.slice(0, 12), waiting[12]!)).toBeNull()

    const broken = takeAll(createBag(), [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 1], ['四条', 1], ['七条', 1],
      ['九筒', 2],
    ])
    expect(canHu(broken, broken[0]!)).toBeNull()
  })
})

describe('七对', () => {
  it('七个对子可以胡，四张相同的牌算两对', () => {
    const bag = createBag()
    const hand = takeAll(bag, [
      ['一万', 2], ['二万', 2], ['三万', 2],
      ['四条', 2], ['五条', 2], ['六条', 2],
      ['七筒', 1],
    ])
    const last = bag.take('七筒')[0]!

    expect(canHu(hand, last)).toMatchObject({ pattern: 'sevenPairs', sevenPairs: true, pengPeng: false })

    const doubled = takeAll(createBag(), [
      ['一万', 4],
      ['二万', 2], ['三万', 2], ['四万', 2], ['五万', 2], ['六万', 2],
    ])
    expect(canHu(doubled, doubled[0]!)).toMatchObject({ pattern: 'sevenPairs', sevenPairs: true })
  })

  it('有单张、有刻子或有公开牌组时不能算七对', () => {
    const bag = createBag()
    const broken = takeAll(bag, [
      ['一万', 2], ['二万', 2], ['三万', 2],
      ['四条', 2], ['五条', 2], ['六条', 2],
      ['七筒', 1], ['八筒', 1],
    ])
    expect(canHu(broken, broken[0]!)).toBeNull()

    const withPung = takeAll(createBag(), [
      ['一万', 3], ['二万', 2], ['三万', 2],
      ['四条', 2], ['五条', 2], ['六条', 2], ['七筒', 1],
    ])
    expect(canHu(withPung, withPung[0]!)?.sevenPairs).not.toBe(true)

    const pairs = takeAll(createBag(), [
      ['二万', 2], ['三万', 2], ['四万', 2],
      ['五万', 2], ['六万', 2], ['七万', 2], ['八万', 2],
    ])
    const peng = pengOf(createBag().take('一万', 3) as [Tile, Tile, Tile])
    expect(isMenqing([peng])).toBe(false)
    expect(canHu(pairs, pairs[0]!, [peng])).toBeNull()
  })

  it('字牌七对可以胡', () => {
    const bag = createBag()
    const hand = takeAll(bag, [
      ['东', 2], ['南', 2], ['西', 2], ['北', 2],
      ['中', 2], ['发', 2], ['白', 2],
    ])

    expect(canHu(hand, hand[0]!)).toMatchObject({ pattern: 'sevenPairs', standard: false })
  })
})

describe('碰碰胡', () => {
  it('四组刻子加一对是碰碰胡', () => {
    const bag = createBag()
    const hand = takeAll(bag, [
      ['一万', 3], ['二万', 3], ['三万', 3], ['四条', 3], ['五筒', 2],
    ])

    expect(canHu(hand, hand[0]!)).toMatchObject({
      pattern: 'pengPeng',
      pengPeng: true,
      standard: true,
      sevenPairs: false,
    })
  })

  it('含有顺子时只算平胡', () => {
    const bag = createBag()
    const hand = takeAll(bag, [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 3], ['二条', 2],
    ])

    expect(canHu(hand, hand[0]!)).toMatchObject({ pattern: 'standard', pengPeng: false, standard: true })
  })
})

describe('门清和公开牌组', () => {
  it('吃、碰、明杠、补杠破门清，暗杠不破门清', () => {
    const bag = createBag()
    const chi = chiOf(bag.take('一万', 3) as [Tile, Tile, Tile])
    const peng = pengOf(createBag().take('二万', 3) as [Tile, Tile, Tile])
    const anGangTiles = createBag().take('三万', 4) as [Tile, Tile, Tile, Tile]
    const anGang: AnGangMeld = { type: 'anGang', tiles: anGangTiles }
    const mingTiles = createBag().take('四万', 4) as [Tile, Tile, Tile, Tile]
    const buTiles = createBag().take('白', 4) as [Tile, Tile, Tile, Tile]

    expect(isMenqing([])).toBe(true)
    expect(isMenqing([anGang])).toBe(true)
    expect(isMenqing([chi])).toBe(false)
    expect(isMenqing([peng])).toBe(false)
    expect(isMenqing([{
      type: 'mingGang',
      tiles: mingTiles,
      from: 1,
      claimed: mingTiles[0],
    }])).toBe(false)
    expect(isMenqing([{
      type: 'buGang',
      tiles: buTiles,
      from: 1,
      claimed: buTiles[0],
      added: buTiles[3],
    }])).toBe(false)
  })

  it('吃过牌之后仍可以平胡，但不能算七对', () => {
    const bag = createBag()
    const chiTiles = takeAll(bag, [['一万', 1], ['二万', 1], ['三万', 1]]) as [Tile, Tile, Tile]
    const concealed = takeAll(bag, [
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 1], ['二条', 1], ['三条', 1],
      ['九筒', 1],
    ])
    const eye = bag.take('九筒')[0]!

    const result = canHu(concealed, eye, [chiOf(chiTiles)])

    expect(result).toMatchObject({ pattern: 'standard', sevenPairs: false, pengPeng: false })
    expect(canHu(concealed, bag.take('八筒')[0]!, [chiOf(chiTiles)])).toBeNull()
  })

  it('暗杠之后可以碰碰胡，并且仍然门清', () => {
    const bag = createBag()
    const gangTiles = bag.take('一万', 4) as [Tile, Tile, Tile, Tile]
    const gang: AnGangMeld = { type: 'anGang', tiles: gangTiles }
    const concealed = takeAll(bag, [
      ['二万', 3], ['三万', 3], ['四条', 3], ['五筒', 2],
    ])

    expect(isMenqing([gang])).toBe(true)
    expect(canHu(concealed, concealed[0]!, [gang])).toMatchObject({
      pattern: 'pengPeng',
      sevenPairs: false,
    })
  })

  it('碰过之后剩下的牌能配成牌型就可以胡', () => {
    const bag = createBag()
    const peng = pengOf(bag.take('一万', 3) as [Tile, Tile, Tile], 2)
    const concealed = takeAll(bag, [
      ['二万', 3], ['三条', 3], ['四筒', 3], ['五筒', 1],
    ])
    const eye = bag.take('五筒')[0]!

    expect(canHu(concealed, eye, [peng])).toMatchObject({ pattern: 'pengPeng' })
  })
})

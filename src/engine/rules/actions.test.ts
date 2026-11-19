import { describe, expect, it } from 'vitest'
import { canAnGang, canBuGang, canChi, canMingGang, canPeng, listChiOptions } from './actions'
import type { PengMeld } from './meld'
import { createBag, takeAll } from './test-bag'
import type { Tile } from '../tile/types'

describe('吃牌', () => {
  it('只有下家能吃，顺子按点数从小到大给出', () => {
    const bag = createBag()
    const hand = takeAll(bag, [
      ['一万', 1], ['二万', 1], ['三万', 1], ['四万', 1], ['五万', 1], ['六万', 1],
    ])
    const discarded = bag.take('三万')[0]!

    expect(canChi(hand, discarded, 1, 0)).toBe(true)
    expect(canChi(hand, discarded, 2, 0)).toBe(false)
    expect(canChi(hand, discarded, 3, 0)).toBe(false)
    expect(canChi(hand, discarded, 0, 0)).toBe(false)
    expect(listChiOptions(hand, discarded, 1, 0).map((option) => option.ranks)).toEqual([
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 5],
    ])
  })

  it('边张、卡张可以吃，字牌和不连续的牌不能吃', () => {
    const bag = createBag()
    const low = takeAll(bag, [['二万', 1], ['三万', 1]])
    expect(canChi(low, bag.take('一万')[0]!, 1, 0)).toBe(true)
    expect(listChiOptions(low, bag.take('一万')[0]!, 1, 0)[0]?.ranks).toEqual([1, 2, 3])

    const high = takeAll(bag, [['七筒', 1], ['八筒', 1]])
    expect(canChi(high, bag.take('九筒')[0]!, 2, 1)).toBe(true)

    const gap = takeAll(bag, [['一万', 1], ['二万', 1]])
    expect(canChi(gap, bag.take('四万')[0]!, 1, 0)).toBe(false)
    expect(canChi(gap, bag.take('东')[0]!, 1, 0)).toBe(false)
    expect(canChi([], bag.take('中')[0]!, 1, 0)).toBe(false)
  })
})

describe('碰和杠的判断', () => {
  it('两张能碰，一张不能碰', () => {
    const bag = createBag()
    const pair = bag.take('东', 2)
    const single = bag.take('南', 1)
    const discarded = bag.take('东')[0]!

    expect(canPeng(pair, discarded, 2, 0)).toBe(true)
    expect(canPeng(single, bag.take('南')[0]!, 1, 0)).toBe(false)
    expect(canPeng(pair, discarded, 0, 0)).toBe(false)
  })

  it('三张能明杠，四张能暗杠，碰过之后能补杠', () => {
    const bag = createBag()
    const three = bag.take('中', 3)
    const four = bag.take('发', 4)
    const discarded = bag.take('中')[0]!
    const whites = bag.take('白', 4)
    const pengTiles = [whites[0]!, whites[1]!, whites[2]!] as [Tile, Tile, Tile]
    const peng: PengMeld = {
      type: 'peng',
      tiles: pengTiles,
      from: 1,
      claimed: pengTiles[0],
    }
    const extra = whites[3]!

    expect(canMingGang(three, discarded, 3, 0)).toBe(true)
    expect(canMingGang(bag.take('南', 2), bag.take('南')[0]!, 3, 0)).toBe(false)
    expect(canAnGang(four)).toBe(true)
    expect(canAnGang(three)).toBe(false)
    expect(canBuGang([peng], [extra, ...bag.take('一条', 1)])).toBe(true)
    expect(canBuGang([peng], bag.take('二条', 1))).toBe(false)
    expect(canPeng(three, discarded, 3, 0)).toBe(true)
  })
})

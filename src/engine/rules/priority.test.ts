import { describe, expect, it } from 'vitest'
import { paymentDeltas, scoreWin } from './score'
import { resolveResponses } from './priority'
import { createBag, takeAll } from './test-bag'
import type { Tile, TileKind } from '../tile/types'

describe('计分', () => {
  it('按牌型和胡牌方式计算分值', () => {
    expect(scoreWin('standard', 'dianpao')).toBe(1)
    expect(scoreWin('standard', 'zimo')).toBe(2)
    expect(scoreWin('standard', 'gangShang')).toBe(3)
    expect(scoreWin('standard', 'qiangGang')).toBe(1)
    expect(scoreWin('sevenPairs', 'dianpao')).toBe(2)
    expect(scoreWin('sevenPairs', 'zimo')).toBe(2)
    expect(scoreWin('sevenPairs', 'gangShang')).toBe(3)
    expect(scoreWin('sevenPairs', 'qiangGang')).toBe(2)
    expect(scoreWin('pengPeng', 'dianpao')).toBe(2)
    expect(scoreWin('pengPeng', 'zimo')).toBe(2)
    expect(scoreWin('pengPeng', 'gangShang')).toBe(3)
    expect(scoreWin('pengPeng', 'qiangGang')).toBe(2)
  })

  it('点炮由责任人支付，自摸由其余三家各支付', () => {
    expect(paymentDeltas([{ player: 0, points: 1 }], 2)).toEqual([1, 0, -1, 0])
    expect(paymentDeltas([{ player: 1, points: 2 }, { player: 2, points: 1 }], 0)).toEqual([-3, 2, 1, 0])
    expect(paymentDeltas([{ player: 0, points: 2 }], 'others')).toEqual([6, -2, -2, -2])
    expect(paymentDeltas([{ player: 1, points: 3 }], 'others')).toEqual([-3, 9, -3, -3])
    expect(paymentDeltas([{ player: 0, points: 2 }], 'others').reduce((sum, value) => sum + value, 0)).toBe(0)
  })
})

describe('操作优先级', () => {
  it('胡优先于杠和吃，杠优先于吃，碰优先于吃', () => {
    const bag = createBag()
    const discard = bag.take('九筒')[0]!
    const huHand = takeAll(bag, [
      ['七筒', 1], ['八筒', 1],
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['九条', 2],
    ])
    const gangHand = bag.take('九筒', 3)
    const chiHand = takeAll(createBag(), [['七筒', 1], ['八筒', 1]])

    const huOverGang = resolveResponses({
      discarder: 0,
      tile: discard,
      players: hands([], huHand, [], gangHand),
      responses: [
        { player: 3, action: 'gang' },
        { player: 1, action: 'hu' },
      ],
      mode: 'discard',
    })
    expect(huOverGang).toEqual({ type: 'hu', winners: [1] })

    const gangOverChi = resolveResponses({
      discarder: 0,
      tile: discard,
      players: hands([], chiHand, [], gangHand),
      responses: [
        { player: 1, action: 'chi', tileIds: [chiHand[0]!.id, chiHand[1]!.id] },
        { player: 3, action: 'gang' },
      ],
      mode: 'discard',
    })
    expect(gangOverChi).toEqual({ type: 'mingGang', player: 3 })

    const pengBag = createBag()
    const pengDiscard = pengBag.take('三万')[0]!
    const pengHand = pengBag.take('三万', 2)
    const pengChi = takeAll(pengBag, [['一万', 1], ['二万', 1]])
    const pengOverChi = resolveResponses({
      discarder: 0,
      tile: pengDiscard,
      players: hands([], pengChi, pengHand, []),
      responses: [
        { player: 1, action: 'chi', tileIds: [pengChi[0]!.id, pengChi[1]!.id] },
        { player: 2, action: 'peng' },
      ],
      mode: 'discard',
    })
    expect(pengOverChi).toEqual({ type: 'peng', player: 2 })
  })

  it('多家胡牌全部成立，同样的碰由更近的下家获得', () => {
    const bag = createBag()
    const discard = bag.take('白')[0]!
    const seven = takeAll(bag, [
      ['一万', 2], ['二万', 2], ['三万', 2],
      ['四万', 2], ['五万', 2], ['六万', 2],
      ['白', 1],
    ])
    const standard = takeAll(bag, [
      ['一条', 1], ['二条', 1], ['三条', 1],
      ['四条', 1], ['五条', 1], ['六条', 1],
      ['七条', 1], ['八条', 1], ['九条', 1],
      ['一筒', 1], ['二筒', 1], ['三筒', 1],
      ['白', 1],
    ])

    expect(resolveResponses({
      discarder: 0,
      tile: discard,
      players: hands([], seven, standard, []),
      responses: [
        { player: 2, action: 'hu' },
        { player: 1, action: 'hu' },
      ],
      mode: 'discard',
    })).toEqual({ type: 'hu', winners: [1, 2] })

    const left = synthetic('东', 1)
    const right = synthetic('东', 2)
    const claimed = synthetic('东', 3)
    expect(resolveResponses({
      discarder: 0,
      tile: claimed,
      players: hands([], [left, synthetic('东', 4)], [right, synthetic('东', 5)], []),
      responses: [
        { player: 2, action: 'peng' },
        { player: 1, action: 'peng' },
      ],
      mode: 'discard',
    })).toEqual({ type: 'peng', player: 1 })
  })

  it('非法响应会被拒绝', () => {
    const bag = createBag()
    const discard = bag.take('一万')[0]!
    const hand = bag.take('二万', 1)

    expect(() => resolveResponses({
      discarder: 0,
      tile: discard,
      players: hands([], hand, [], []),
      responses: [{ player: 1, action: 'hu' }],
      mode: 'discard',
    })).toThrow(/不能胡/)
    expect(() => resolveResponses({
      discarder: 0,
      tile: discard,
      players: hands([], hand, [], []),
      responses: [{ player: 1, action: 'chi', tileIds: [hand[0]!.id, hand[0]!.id] }],
      mode: 'discard',
    })).toThrow(/不能这样吃|只能吃/)
    expect(() => resolveResponses({
      discarder: 0,
      tile: discard,
      players: hands(hand, [], [], []),
      responses: [{ player: 0, action: 'peng' }],
      mode: 'discard',
    })).toThrow(/自己/)
  })
})

function hands(
  first: readonly Tile[],
  second: readonly Tile[],
  third: readonly Tile[],
  fourth: readonly Tile[],
) {
  return [
    { concealed: first, melds: [] },
    { concealed: second, melds: [] },
    { concealed: third, melds: [] },
    { concealed: fourth, melds: [] },
  ] as const
}

let syntheticId = 1000

function synthetic(label: '东', copy: number): Tile {
  const kind: TileKind = { category: 'wind', wind: 'east' }
  return { id: syntheticId + copy + label.length * 10, kind }
}

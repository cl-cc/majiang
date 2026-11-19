import { describe, expect, it } from 'vitest'
import { createDeck, deal, shuffle, tileLabel } from '../index'
import type { PengMeld } from './meld'
import {
  createTable,
  declareAnGang,
  declareBuGang,
  declareSelfWin,
  discardTile,
  drawTile,
  respond,
  startRound,
} from './round'
import { createBag, ids, takeAll } from './test-bag'

describe('吃碰杠的执行', () => {
  it('吃上家的牌后按点数排列，并且不能接着暗杠', () => {
    const bag = createBag()
    const discard = bag.take('四万')[0]!
    const chiTiles = takeAll(bag, [['二万', 1], ['三万', 1]])
    const kong = bag.take('一万', 4)
    const state = createTable({
      hands: [[discard, ...bag.take('九条', 1)], [...chiTiles, ...kong], [], []],
      wall: bag.take('一条', 1),
      current: 0,
    })
    const response = discardTile(state, 0, discard.id)

    expect(() => respond(response, [{
      player: 2,
      action: 'chi',
      tileIds: [chiTiles[0]!.id, chiTiles[1]!.id],
    }])).toThrow(/只能吃上家/)

    const eaten = respond(response, [{
      player: 1,
      action: 'chi',
      tileIds: [chiTiles[0]!.id, chiTiles[1]!.id],
    }])
    const meld = eaten.players[1].melds[0]

    expect(meld?.type).toBe('chi')
    if (meld?.type === 'chi') {
      expect(meld.tiles.map((tile) => tileLabel(tile.kind))).toEqual(['二万', '三万', '四万'])
      expect(meld.claimed.id).toBe(discard.id)
      expect(meld.from).toBe(0)
    }
    expect(eaten.phase).toEqual({ type: 'discard', selfTurn: false, from: 'claim' })
    expect(() => declareAnGang(eaten, kong[0]!.id)).toThrow(/现在不能/)
  })

  it('对家可以碰，明杠会立刻补牌且不能被抢', () => {
    const bag = createBag()
    const discard = bag.take('东')[0]!
    const pair = bag.take('东', 2)
    const response = discardTile(createTable({
      hands: [[discard], [], pair, []],
      wall: [],
      current: 0,
    }), 0, discard.id)
    const peng = respond(response, [{ player: 2, action: 'peng' }])

    expect(peng.current).toBe(2)
    expect(peng.players[2].melds[0]).toMatchObject({ type: 'peng', from: 0, claimed: discard })
    expect(peng.players[2].concealed).toHaveLength(0)
    expect(peng.phase).toEqual({ type: 'discard', selfTurn: false, from: 'claim' })

    const gangBag = createBag()
    const gangDiscard = gangBag.take('中')[0]!
    const three = gangBag.take('中', 3)
    const replacement = gangBag.take('一条')[0]!
    const gangResponse = discardTile(createTable({
      hands: [[gangDiscard], [], [], three],
      wall: [replacement],
      current: 0,
    }), 0, gangDiscard.id)
    const ganged = respond(gangResponse, [{ player: 3, action: 'gang' }])

    expect(ganged.phase).toEqual({ type: 'discard', selfTurn: true, from: 'kong' })
    expect(ganged.players[3].melds[0]?.type).toBe('mingGang')
    expect(ganged.players[3].melds[0]?.tiles).toHaveLength(4)
    expect(ganged.pendingDraw?.id).toBe(replacement.id)
    expect(ganged.wall).toHaveLength(0)
    expect(ganged.players[3].concealed.map((tile) => tile.id)).toContain(replacement.id)
  })

  it('暗杠、补杠都会补一张牌', () => {
    const bag = createBag()
    const kong = bag.take('发', 4)
    const replacement = bag.take('二条')[0]!
    const concealed = declareAnGang(createTable({
      hands: [kong, [], [], []],
      wall: [replacement],
      pendingDrawId: kong[0]!.id,
    }), kong[0]!.id)

    expect(concealed.players[0].melds[0]?.type).toBe('anGang')
    expect(concealed.pendingDraw?.id).toBe(replacement.id)
    expect(concealed.wall).toHaveLength(0)

    const addedBag = createBag()
    const pengTiles = addedBag.take('白', 3)
    const added = addedBag.take('白')[0]!
    const filler = addedBag.take('三条')[0]!
    const peng: PengMeld = {
      type: 'peng',
      tiles: [pengTiles[0]!, pengTiles[1]!, pengTiles[2]!],
      from: 1,
      claimed: pengTiles[0]!,
    }
    const declared = declareBuGang(createTable({
      hands: [[added], [], [], []],
      melds: [[peng], [], [], []],
      wall: [filler],
      pendingDrawId: added.id,
    }), added.id)
    const passed = respond(declared, [])

    expect(declared.phase.type).toBe('qiangGang')
    expect(passed.phase).toEqual({ type: 'discard', selfTurn: true, from: 'kong' })
    expect(passed.players[0].melds[0]?.type).toBe('buGang')
    expect(passed.players[0].melds[0]?.tiles.map((tile) => tile.id)).toContain(added.id)
    expect(passed.pendingDraw?.id).toBe(filler.id)
    expect(passed.wall).toHaveLength(0)
  })

  it('牌墙没有补牌时，明杠、暗杠、补杠都不执行', () => {
    const bag = createBag()
    const an = bag.take('一万', 4)
    const anState = createTable({ hands: [an, [], [], []], wall: [], pendingDrawId: an[0]!.id })
    expect(() => declareAnGang(anState, an[0]!.id)).toThrow(/牌墙没有补牌/)
    expect(ids(anState.players[0].concealed)).toEqual(ids(an))

    const pengTiles = bag.take('二万', 3)
    const extra = bag.take('二万')[0]!
    const peng: PengMeld = {
      type: 'peng',
      tiles: [pengTiles[0]!, pengTiles[1]!, pengTiles[2]!],
      from: 2,
      claimed: pengTiles[0]!,
    }
    const buState = createTable({
      hands: [[extra], [], [], []],
      melds: [[peng], [], [], []],
      wall: [],
      pendingDrawId: extra.id,
    })
    expect(() => declareBuGang(buState, extra.id)).toThrow(/牌墙没有补牌/)
    expect(buState.players[0].melds[0]?.type).toBe('peng')

    const discard = bag.take('三万')[0]!
    const three = bag.take('三万', 3)
    const response = discardTile(createTable({
      hands: [[discard], three, [], []],
      wall: [],
      current: 0,
    }), 0, discard.id)
    expect(() => respond(response, [{ player: 1, action: 'gang' }])).toThrow(/牌墙没有补牌/)
    expect(response.players[1].melds).toHaveLength(0)
    expect(ids(response.players[1].concealed)).toEqual(ids(three))
  })

  it('补过一次之后牌墙空了，不能再杠', () => {
    const bag = createBag()
    const ones = bag.take('一万', 4)
    const twos = bag.take('二条', 4)
    const rest = takeAll(bag, [
      ['三筒', 1], ['四筒', 1], ['五筒', 1],
      ['六万', 1], ['七万', 1], ['八万', 1],
    ])
    const replacement = bag.take('九筒')[0]!
    const once = declareAnGang(createTable({
      hands: [[...ones, ...twos, ...rest], [], [], []],
      wall: [replacement],
      pendingDrawId: ones[0]!.id,
    }), ones[0]!.id)

    expect(once.wall).toHaveLength(0)
    expect(() => declareAnGang(once, twos[0]!.id)).toThrow(/牌墙没有补牌/)
    expect(once.players[0].concealed.map((tile) => tile.id)).toEqual(
      expect.arrayContaining(ids(twos)),
    )
  })
})

describe('胡牌结算', () => {
  it('自摸按两分由三家支付', () => {
    const bag = createBag()
    const hand = takeAll(bag, [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 1], ['二条', 1], ['三条', 1],
      ['九筒', 2],
    ])
    const won = declareSelfWin(createTable({
      hands: [hand, [], [], []],
      wall: [],
      from: 'draw',
      pendingDrawId: hand[13]!.id,
    }))

    expect(won.phase).toMatchObject({
      type: 'over',
      wins: [{ player: 0, pattern: 'standard', method: 'zimo', points: 2 }],
    })
    expect(won.players.map((player) => player.score)).toEqual([6, -2, -2, -2])
  })

  it('杠上开花在自摸分上加一分，补牌后打出的牌仍是普通点炮', () => {
    const bag = createBag()
    const ones = bag.take('一万', 4)
    const hand = [
      ...ones,
      ...takeAll(bag, [
        ['二万', 3], ['三万', 3], ['四条', 3], ['五筒', 1],
      ]),
    ]
    const drawn = bag.take('五筒')[0]!
    const afterKong = declareAnGang(createTable({
      hands: [hand, [], [], []],
      wall: [drawn],
      pendingDrawId: ones[0]!.id,
    }), ones[0]!.id)
    const won = declareSelfWin(afterKong)

    expect(won.phase).toMatchObject({
      type: 'over',
      wins: [{ pattern: 'pengPeng', method: 'gangShang', points: 3 }],
    })
    expect(won.players.map((player) => player.score)).toEqual([9, -3, -3, -3])

    const pointBag = createBag()
    const pointOnes = pointBag.take('一万', 4)
    const pointHand = [
      ...pointOnes,
      ...takeAll(pointBag, [
        ['二万', 1], ['三万', 1], ['四万', 1],
        ['五万', 1], ['六万', 1], ['七万', 1],
        ['八条', 2], ['九条', 2],
      ]),
    ]
    const pointDraw = pointBag.take('一条')[0]!
    const robber = takeAll(pointBag, [
      ['二筒', 1], ['三筒', 1], ['四筒', 1],
      ['五筒', 1], ['六筒', 1], ['七筒', 1],
      ['八筒', 3], ['九万', 3], ['一条', 1],
    ])
    const kong = declareAnGang(createTable({
      hands: [pointHand, robber, [], []],
      wall: [pointDraw],
      pendingDrawId: pointOnes[0]!.id,
    }), pointOnes[0]!.id)

    expect(() => declareSelfWin(kong)).toThrow(/不能胡/)
    const discarded = discardTile(kong, 0, pointDraw.id)
    const result = respond(discarded, [{ player: 1, action: 'hu' }])

    expect(result.phase).toMatchObject({
      type: 'over',
      wins: [{ player: 1, pattern: 'standard', method: 'dianpao', points: 1 }],
    })
    expect(result.players[0].score).toBe(-1)
    expect(result.players[1].score).toBe(1)
  })

  it('抢补杠成功后撤销第四张牌，并按点炮计分', () => {
    const bag = createBag()
    const pengTiles = bag.take('一万', 3)
    const added = bag.take('一万')[0]!
    const concealed = [
      added,
      ...takeAll(bag, [
        ['二万', 1], ['三万', 1], ['四万', 1],
        ['五万', 1], ['六万', 1], ['七万', 1],
        ['八条', 2], ['九条', 2],
      ]),
    ]
    const robber = takeAll(bag, [
      ['二万', 1], ['三万', 1],
      ['四条', 1], ['五条', 1], ['六条', 1],
      ['七条', 1], ['八条', 1], ['九条', 1],
      ['二筒', 1], ['三筒', 1], ['四筒', 1],
      ['九筒', 2],
    ])
    const replacement = bag.take('一条')[0]!
    const peng: PengMeld = {
      type: 'peng',
      tiles: [pengTiles[0]!, pengTiles[1]!, pengTiles[2]!],
      from: 3,
      claimed: pengTiles[0]!,
    }
    const pending = declareBuGang(createTable({
      hands: [concealed, robber, [], []],
      melds: [[peng], [], [], []],
      wall: [replacement],
      pendingDrawId: added.id,
    }), added.id)
    const finished = respond(pending, [{ player: 1, action: 'hu' }])
    const meld = finished.players[0].melds[0]

    expect(pending.players[0].melds[0]?.type).toBe('buGang')
    expect(pending.players[0].melds[0]?.tiles).toHaveLength(4)
    expect(meld?.type).toBe('peng')
    expect(meld?.tiles).toHaveLength(3)
    expect(meld?.tiles.map((tile) => tile.id)).not.toContain(added.id)
    expect(finished.wall.map((tile) => tile.id)).toEqual([replacement.id])
    expect(finished.phase).toMatchObject({
      type: 'over',
      wins: [{ player: 1, method: 'qiangGang', points: 1, pattern: 'standard' }],
    })
    expect(finished.players[0].score).toBe(-1)
    expect(finished.players[1].score).toBe(1)
  })

  it('多家可以胡同一张牌时一炮多响', () => {
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
    const dealer = [discard, ...takeAll(bag, [['七万', 2], ['八万', 2], ['九万', 2]])]
    const response = discardTile(createTable({
      hands: [dealer, seven, standard, []],
      wall: [],
      current: 0,
    }), 0, discard.id)
    const finished = respond(response, [
      { player: 2, action: 'hu' },
      { player: 1, action: 'hu' },
    ])

    expect(finished.phase).toMatchObject({
      type: 'over',
      wins: [
        { player: 1, pattern: 'sevenPairs', method: 'dianpao', points: 2 },
        { player: 2, pattern: 'standard', method: 'dianpao', points: 1 },
      ],
    })
    expect(finished.players.map((player) => player.score)).toEqual([-3, 2, 1, 0])
  })

  it('没人要的牌由下家摸走', () => {
    const bag = createBag()
    const discard = bag.take('东')[0]!
    const drawn = bag.take('南')[0]!
    const response = discardTile(createTable({
      hands: [[discard], [], [], []],
      wall: [drawn],
      current: 0,
    }), 0, discard.id)
    const drawing = respond(response, [])
    const next = drawTile(drawing)

    expect(drawing.phase).toEqual({ type: 'draw', player: 1 })
    expect(next.current).toBe(1)
    expect(next.pendingDraw?.id).toBe(drawn.id)
    expect(next.players[1].concealed.map((tile) => tile.id)).toEqual([drawn.id])
    expect(next.phase).toEqual({ type: 'discard', selfTurn: true, from: 'draw' })
    expect(next.discards.map((tile) => tile.id)).toEqual([discard.id])
  })

  it('不能胡的自摸、不属于自己的出牌会被拒绝', () => {
    const bag = createBag()
    const tile = bag.take('东')[0]!
    const state = createTable({
      hands: [[tile], [], [], []],
      wall: [],
      pendingDrawId: tile.id,
    })

    expect(() => declareSelfWin(state)).toThrow(/不能胡/)
    expect(() => discardTile(state, 1, tile.id)).toThrow(/还没轮到/)
    expect(() => discardTile(state, 0, 99999)).toThrow(/没有这张牌/)
    expect(() => respond(state, [])).toThrow(/没有可以响应/)
  })
})

describe('和第一阶段发牌衔接', () => {
  it('庄家从 14 张里出牌，牌墙仍是剩下的 83 张', () => {
    const dealt = deal(shuffle(createDeck(), () => 0), 0)
    const round = startRound(dealt)
    const discard = round.players[0].concealed[0]!
    const response = discardTile(round, 0, discard.id)

    expect(dealt.hands[0]).toHaveLength(14)
    expect(round.players[0].concealed).toHaveLength(14)
    expect(round.wall).toHaveLength(83)
    expect(round.pendingDraw?.id).toBe(dealt.hands[0][13]?.id)
    expect(response.phase).toMatchObject({ type: 'response', discarder: 0 })
    expect(response.players[0].concealed).toHaveLength(13)
    expect(dealt.wall).toHaveLength(83)
  })
})

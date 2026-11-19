import { describe, expect, it } from 'vitest'
import {
  DRAGONS,
  NUMBER_SUITS,
  RANKS,
  WINDS,
  canHu,
  createTable,
  declareBuGang,
  discardTile,
  tileLabel,
} from '../engine'
import type { AnGangMeld, Meld, PengMeld, Tile, TileKind } from '../engine'
import { faceIndex } from '../engine/rules/face'
import { createBag, takeAll } from '../engine/rules/test-bag'
import {
  analyzeHand,
  calculateShanten,
  chooseAction,
  chooseDiscard,
  chooseTurnAction,
  projectAIView,
} from './index'
import type { AIView } from './types'

describe('向听和手牌结构', () => {
  it('标准胡、听牌和一向听', () => {
    const bag = createBag()
    const win = takeAll(bag, [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 1], ['二条', 1], ['三条', 1],
      ['九筒', 2],
    ])
    const tanki = win.slice(0, 13)
    const ryanmen = takeAll(createBag(), [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 1], ['二条', 1],
      ['九筒', 2],
    ])
    const oneAway = takeAll(createBag(), [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 1], ['九条', 1],
      ['九筒', 2],
    ])

    expect(calculateShanten(win)).toBe(-1)
    expect(canHu(win, win[0]!, [])).not.toBeNull()
    expect(calculateShanten(tanki)).toBe(0)
    expect(calculateShanten(ryanmen)).toBe(0)
    expect(calculateShanten(oneAway)).toBe(1)
    expectShantenMatchesHu(tanki)
    expectShantenMatchesHu(ryanmen)
    expectShantenMatchesHu(oneAway)
  })

  it('七对、碰碰胡和已经碰过的牌', () => {
    const seven = takeAll(createBag(), [
      ['一万', 2], ['二万', 2], ['三万', 2], ['四万', 2],
      ['五万', 2], ['六万', 2], ['七万', 2],
    ])
    const sevenTenpai = seven.slice(0, 13)
    const allPungs = takeAll(createBag(), [
      ['一万', 3], ['二万', 3], ['三万', 3], ['四万', 3], ['五万', 2],
    ])
    const pungTenpai = allPungs.slice(0, 13)
    const bag = createBag()
    const easts = bag.take('东', 3)
    const peng: PengMeld = {
      type: 'peng',
      tiles: [easts[0]!, easts[1]!, easts[2]!],
      from: 1,
      claimed: easts[0]!,
    }
    const afterPeng = takeAll(bag, [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['九筒', 2],
    ])

    expect(calculateShanten(seven)).toBe(-1)
    expect(analyzeHand(sevenTenpai).sevenPairsShanten).toBe(0)
    expect(calculateShanten(sevenTenpai)).toBe(0)
    expect(calculateShanten(allPungs)).toBe(-1)
    expect(analyzeHand(pungTenpai).pengPengShanten).toBe(0)
    expect(calculateShanten(pungTenpai)).toBe(0)
    expect(calculateShanten(afterPeng, [peng])).toBe(-1)
    expect(canHu(afterPeng, afterPeng[0]!, [peng])).not.toBeNull()
    expect(analyzeHand(afterPeng, [peng]).sevenPairsShanten).toBeNull()
    expectShantenMatchesHu(sevenTenpai)
    expectShantenMatchesHu(pungTenpai)
  })

  it('能认出对子、两面、边张、坎张和孤张', () => {
    const bag = createBag()
    const tiles = takeAll(bag, [
      ['五条', 2],
      ['三条', 1], ['四条', 1],
      ['八筒', 1], ['九筒', 1],
      ['二万', 1], ['四万', 1],
      ['东', 1],
    ])
    const analysis = analyzeHand(tiles)
    const at = (label: string): number => faceIndex(bag.take(label)[0]!.kind)

    expect(analysis.pairs).toEqual([at('五条')])
    expect(analysis.taatsu).toEqual([
      { kind: 'ryanmen', faces: [at('三条'), at('四条')] },
      { kind: 'penchan', faces: [at('八筒'), at('九筒')] },
      { kind: 'kanchan', faces: [at('二万'), at('四万')] },
    ])
    expect(analysis.isolated).toEqual([at('东')])
  })
})

describe('出牌', () => {
  it('打出的牌一定在自己手里', () => {
    const view = selfView(takeAll(createBag(), [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四条', 1], ['五条', 1], ['六条', 1],
      ['七筒', 1], ['八筒', 1], ['九筒', 1],
      ['东', 1], ['南', 1], ['西', 1],
      ['中', 1], ['白', 1],
    ]))
    const tile = chooseDiscard(view)
    expect(view.concealed.map((item) => item.id)).toContain(tile.id)
    expect(chooseDiscard(view).id).toBe(tile.id)
  })

  it('有孤张时先打孤张，不拆已经成型的顺子', () => {
    const view = selfView(takeAll(createBag(), [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 1], ['二条', 1], ['三条', 1],
      ['九筒', 1],
      ['东', 1],
    ]))
    expect(tileLabel(chooseDiscard(view).kind)).toBe('东')
  })

  it('同样是孤张时不固定打最小的一张', () => {
    const view = selfView(takeAll(createBag(), [
      ['一条', 1], ['二条', 1], ['三条', 1],
      ['四条', 1], ['五条', 1], ['六条', 1],
      ['七条', 1], ['八条', 1], ['九条', 1],
      ['九筒', 2],
      ['一万', 1],
      ['九万', 1],
    ]))
    expect(tileLabel(chooseDiscard(view).kind)).toBe('九万')
  })
})

describe('吃碰杠胡', () => {
  it('能胡就胡，不会改去碰', () => {
    const bag = createBag()
    const discard = bag.take('九条')[0]!
    const hand = takeAll(bag, [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['九筒', 2],
      ['九条', 2],
    ])
    const view = responseView(0, 1, [discard], hand, [bag.take('一条')[0]!])
    expect(chooseAction(view)).toEqual({ player: 1, action: 'hu' })
    expect(canHu(hand, discard, [])).not.toBeNull()
  })

  it('碰了能听牌才碰，已经听牌就不再碰', () => {
    const improve = createBag()
    const improveTile = improve.take('五万')[0]!
    const improveHand = takeAll(improve, [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['五万', 2],
      ['九条', 1],
      ['一筒', 1],
    ])
    expect(chooseAction(responseView(0, 1, [improveTile], improveHand, [improve.take('二筒')[0]!])).action).toBe('peng')

    const keep = createBag()
    const keepTile = keep.take('九筒')[0]!
    const keepHand = takeAll(keep, [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 1], ['二条', 1],
      ['九筒', 2],
    ])
    expect(chooseAction(responseView(0, 1, [keepTile], keepHand, [keep.take('一筒')[0]!])).action).toBe('pass')
  })

  it('只吃上家，而且吃完要变近才吃', () => {
    const bag = createBag()
    const discard = bag.take('一万')[0]!
    const hand = takeAll(bag, [
      ['一条', 1], ['二条', 1], ['三条', 1],
      ['四条', 1], ['五条', 1], ['六条', 1],
      ['七条', 1], ['八条', 1], ['九条', 1],
      ['二万', 1], ['三万', 1],
      ['九筒', 1], ['一筒', 1],
    ])
    const wall = [bag.take('二筒')[0]!]
    const eaten = chooseAction(responseView(0, 1, [discard], hand, wall))
    expect(eaten.action).toBe('chi')
    if (eaten.action === 'chi') {
      expect(eaten.tileIds).toHaveLength(2)
      expect(hand.map((tile) => tile.id)).toEqual(expect.arrayContaining([...eaten.tileIds]))
    }
    expect(chooseAction(responseView(0, 2, [discard], hand, wall)).action).toBe('pass')

    const noGain = createBag()
    const other = noGain.take('四万')[0]!
    const ready = takeAll(noGain, [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 1], ['二条', 1], ['三条', 1],
      ['九筒', 1],
    ])
    expect(chooseAction(responseView(0, 1, [other], ready, [noGain.take('一筒')[0]!])).action).toBe('pass')
  })

  it('杠牌不拆更好的牌型，牌墙没牌时不杠', () => {
    const useful = createBag()
    const quad = useful.take('一万', 4)
    const usefulHand = [
      ...quad,
      ...takeAll(useful, [
        ['一条', 1], ['二条', 1], ['三条', 1],
        ['四条', 1], ['五条', 1], ['六条', 1],
        ['七条', 1], ['八条', 1], ['九条', 1],
        ['九筒', 1],
      ]),
    ]
    const usefulView = selfView(usefulHand, [useful.take('中')[0]!])
    expect(chooseTurnAction(usefulView)).toMatchObject({ type: 'anGang' })

    const pairs = createBag()
    const pairHand = takeAll(pairs, [
      ['东', 4],
      ['南', 2], ['西', 2], ['北', 2], ['中', 2],
      ['发', 1], ['白', 1],
    ])
    const skipped = chooseTurnAction(selfView(pairHand, [pairs.take('一条')[0]!]))
    expect(skipped.type).toBe('discard')
    if (skipped.type === 'discard') {
      expect(tileLabel(skipped.tile.kind)).toBe('白')
    }

    const ming = createBag()
    const claimed = ming.take('中')[0]!
    const mingHand = [
      ...ming.take('中', 3),
      ...takeAll(ming, [
        ['一万', 1], ['二万', 1], ['三万', 1],
        ['四万', 1], ['五万', 1], ['六万', 1],
        ['七万', 1], ['八万', 1], ['九万', 1],
        ['九筒', 1],
      ]),
    ]
    expect(chooseAction(responseView(0, 1, [claimed], mingHand, [ming.take('一条')[0]!])).action).toBe('gang')
    expect(chooseAction(responseView(0, 1, [claimed], mingHand, [])).action).toBe('pass')

    const adding = createBag()
    const addedPeng = adding.take('东', 3)
    const added = adding.take('东')[0]!
    const addedHand = [
      added,
      ...takeAll(adding, [
        ['一万', 1], ['二万', 1], ['三万', 1],
        ['四万', 1], ['五万', 1], ['六万', 1],
        ['七万', 1], ['八万', 1], ['九万', 1],
        ['九筒', 1],
      ]),
    ]
    const addedView = meldView(addedHand, {
      type: 'peng',
      tiles: [addedPeng[0]!, addedPeng[1]!, addedPeng[2]!],
      from: 1,
      claimed: addedPeng[0]!,
    }, added.id, [adding.take('一条')[0]!])
    expect(chooseTurnAction(addedView)).toMatchObject({ type: 'buGang', tileId: added.id })

    const breaking = createBag()
    const breakPeng = breaking.take('二万', 3)
    const breakTile = breaking.take('二万')[0]!
    const breakHand = [
      breakTile,
      ...takeAll(breaking, [
        ['一万', 1], ['三万', 1],
        ['四万', 1], ['五万', 1], ['六万', 1],
        ['七万', 1], ['八万', 1], ['九万', 1],
        ['九筒', 1], ['一筒', 1],
      ]),
    ]
    const breakView = meldView(breakHand, {
      type: 'peng',
      tiles: [breakPeng[0]!, breakPeng[1]!, breakPeng[2]!],
      from: 1,
      claimed: breakPeng[0]!,
    }, breakTile.id, [breaking.take('一条')[0]!])
    expect(chooseTurnAction(breakView).type).toBe('discard')

    const winning = createBag()
    const winPeng = winning.take('二万', 3)
    const winTile = winning.take('二万')[0]!
    const winHand = [
      winTile,
      ...takeAll(winning, [
        ['一万', 1], ['三万', 1],
        ['四万', 1], ['五万', 1], ['六万', 1],
        ['七万', 1], ['八万', 1], ['九万', 1],
        ['九筒', 2],
      ]),
    ]
    const winView = meldView(winHand, {
      type: 'peng',
      tiles: [winPeng[0]!, winPeng[1]!, winPeng[2]!],
      from: 1,
      claimed: winPeng[0]!,
    }, winTile.id, [winning.take('一条')[0]!])
    expect(chooseTurnAction(winView)).toEqual({ type: 'selfHu' })
  })

  it('抢杠时只能胡或过', () => {
    const bag = createBag()
    const pengTiles = bag.take('一万', 3)
    const added = bag.take('一万')[0]!
    const peng: PengMeld = {
      type: 'peng',
      tiles: [pengTiles[0]!, pengTiles[1]!, pengTiles[2]!],
      from: 2,
      claimed: pengTiles[0]!,
    }
    const robber = takeAll(bag, [
      ['二万', 1], ['三万', 1],
      ['四条', 1], ['五条', 1], ['六条', 1],
      ['七条', 1], ['八条', 1], ['九条', 1],
      ['二筒', 1], ['三筒', 1], ['四筒', 1],
      ['九筒', 2],
    ])
    const state = createTable({
      hands: [[added, ...bag.take('五筒', 1)], robber, bag.take('六筒', 1), []],
      melds: [[peng], [], [], []],
      wall: [bag.take('七筒')[0]!],
      pendingDrawId: added.id,
    })
    const pending = declareBuGang(state, added.id)
    expect(chooseAction(projectAIView(pending, 1))).toEqual({ player: 1, action: 'hu' })
    expect(chooseAction(projectAIView(pending, 2)).action).toBe('pass')

    const pair = takeAll(createBag(), [['二万', 2]])
    const claimed: Tile = { id: 9000, kind: pair[0]!.kind }
    const blocked: AIView = {
      seat: 1,
      concealed: pair,
      melds: [],
      publicMelds: [[], [], [], []],
      discards: [],
      wallCount: 4,
      current: 0,
      phase: { type: 'qiangGang', player: 0, tile: claimed },
      token: 'qiang',
    }
    expect(chooseAction(blocked)).toEqual({ player: 1, action: 'pass' })
  })

  it('没有合法吃碰杠胡时选择过', () => {
    const bag = createBag()
    const discard = bag.take('东')[0]!
    const hand = bag.take('一万', 1)
    const view = responseView(0, 1, [discard], hand, [])
    const action = chooseAction(view)
    expect(action).toEqual({ player: 1, action: 'pass' })
    expect(() => chooseAction(selfView(hand))).toThrow(/没有可以响应/)
  })
})

describe('信息边界', () => {
  it('看不到别人的暗手、暗杠牌面和牌墙顺序', () => {
    const bag = createBag()
    const kong = bag.take('发', 4)
    const anGang: AnGangMeld = {
      type: 'anGang',
      tiles: [kong[0]!, kong[1]!, kong[2]!, kong[3]!],
    }
    const secret = bag.take('一万')[0]!
    const wall = [...bag.take('二万', 1), ...bag.take('三筒', 1), ...bag.take('四筒', 1)]
    const hand = takeAll(bag, [
      ['三万', 1], ['四万', 1], ['五万', 1],
      ['六万', 1], ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 1], ['二条', 1], ['三条', 1],
      ['四条', 1], ['五条', 1],
      ['一筒', 1], ['二筒', 1],
    ])
    const state = createTable({
      hands: [hand, [secret], [], []],
      melds: [[], [anGang], [], []],
      wall,
      pendingDrawId: hand[13]!.id,
    })
    const view = projectAIView(state, 0)
    const seen = new Set(allTiles(view).map((tile) => tile.id))

    expect(view.wallCount).toBe(3)
    expect(view).not.toHaveProperty('wall')
    expect(seen.has(secret.id)).toBe(false)
    for (const tile of kong) expect(seen.has(tile.id)).toBe(false)
    for (const tile of wall) expect(seen.has(tile.id)).toBe(false)
    expect(Math.max(...visibleCounts(view))).toBeLessThanOrEqual(4)

    const flipped = createTable({
      hands: [hand, [], [secret], []],
      melds: [[], [], [anGang], []],
      wall: [...wall].reverse(),
      pendingDrawId: hand[13]!.id,
    })
    expect(chooseDiscard(projectAIView(flipped, 0)).id).toBe(chooseDiscard(view).id)
  })
})

function meldView(hand: readonly Tile[], meld: PengMeld, pendingDrawId: number, wall: readonly Tile[]): AIView {
  return projectAIView(createTable({
    hands: [hand, [], [], []],
    melds: [[meld], [], [], []],
    wall,
    pendingDrawId,
  }), 0)
}

function selfView(hand: readonly Tile[], wall: readonly Tile[] = []): AIView {
  return projectAIView(createTable({
    hands: [hand, [], [], []],
    wall,
    pendingDrawId: hand[hand.length - 1]?.id,
  }), 0)
}

function responseView(
  discarder: 0 | 1 | 2 | 3,
  seat: 0 | 1 | 2 | 3,
  discardTiles: readonly Tile[],
  hand: readonly Tile[],
  wall: readonly Tile[],
): AIView {
  const discard = discardTiles[0]
  if (discard === undefined) throw new Error('缺少打出的牌')
  const hands: [Tile[], Tile[], Tile[], Tile[]] = [[], [], [], []]
  hands[discarder] = [discard]
  hands[seat] = [...hand]
  return projectAIView(discardTile(createTable({
    hands,
    wall,
    current: discarder,
  }), discarder, discard.id), seat)
}

function allTiles(view: AIView): Tile[] {
  const tiles = [...view.concealed, ...view.discards]
  for (const meld of view.melds) tiles.push(...meld.tiles)
  for (const melds of view.publicMelds) {
    for (const meld of melds) {
      if (meld.type !== 'anGang') tiles.push(...meld.tiles)
    }
  }
  if (view.phase.type === 'response' || view.phase.type === 'qiangGang') tiles.push(view.phase.tile)
  return tiles
}

function visibleCounts(view: AIView): number[] {
  const counts = Array.from({ length: 34 }, () => 0)
  for (const tile of allTiles(view)) {
    const index = faceIndex(tile.kind)
    counts[index] = (counts[index] ?? 0) + 1
  }
  return counts
}

function expectShantenMatchesHu(hand: readonly Tile[], melds: readonly Meld[] = []): void {
  const shanten = calculateShanten(hand, melds)
  expect(shanten).toBeGreaterThanOrEqual(0)
  expect(shanten === 0).toBe(existsWinningTile(hand, melds))
}

function existsWinningTile(hand: readonly Tile[], melds: readonly Meld[]): boolean {
  const counts = new Map<number, number>()
  for (const tile of hand) {
    const index = faceIndex(tile.kind)
    counts.set(index, (counts.get(index) ?? 0) + 1)
  }
  for (let index = 0; index < 34; index += 1) {
    if ((counts.get(index) ?? 0) >= 4) continue
    const tile: Tile = { id: 5000 + index, kind: kindAt(index) }
    if (canHu(hand, tile, melds) !== null) return true
  }
  return false
}

function kindAt(index: number): TileKind {
  if (index < 27) {
    const suit = NUMBER_SUITS[Math.floor(index / 9)]
    const rank = RANKS[index % 9]
    if (suit === undefined || rank === undefined) throw new Error('牌面错误')
    return { category: 'number', suit, rank }
  }
  if (index < 31) {
    const wind = WINDS[index - 27]
    if (wind === undefined) throw new Error('牌面错误')
    return { category: 'wind', wind }
  }
  const dragon = DRAGONS[index - 31]
  if (dragon === undefined) throw new Error('牌面错误')
  return { category: 'dragon', dragon }
}

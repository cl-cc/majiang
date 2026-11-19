import { describe, expect, it } from 'vitest'
import { createTable, discardTile } from '../engine'
import type { Tile } from '../engine'
import { createBag, takeAll } from '../engine/rules/test-bag'
import { humanActions } from './legal'
import { createGame } from './table'
import type { GameSnapshot } from './types'

const empty: readonly Tile[] = []

describe('对局界面状态', () => {
  it('开局后显示玩家手牌，AI 手牌只有张数', () => {
    const game = createGame({ sleep: () => Promise.resolve() })
    game.start()
    const snap = game.snapshot
    const self = seat(snap, 'self')

    expect(snap.round).toBe(1)
    expect(snap.dealerName).toBe('你')
    expect(snap.wallCount).toBe(83)
    expect(snap.canDiscard).toBe(true)
    expect(self.hand).toHaveLength(14)
    expect(self.concealedCount).toBe(14)
    expect(self.hand.filter((tile) => tile.drawn)).toHaveLength(1)
    expect(self.hand.at(-1)?.drawn).toBe(true)
    for (const place of ['right', 'top', 'left'] as const) {
      const ai = seat(snap, place)
      expect(ai.hand).toEqual([])
      expect(ai.concealedCount).toBe(13)
      expect(ai.melds).toEqual([])
    }
    expect(snap).not.toHaveProperty('wall')
    game.dispose()
  })

  it('打出一张合法牌后，同一次操作不会再打出第二张', () => {
    const game = createGame({ sleep: () => Promise.resolve() })
    game.start()
    const first = seat(game.snapshot, 'self').hand[0]
    if (first === undefined) {
      throw new Error('没有手牌')
    }
    game.act({ type: 'peng' })
    expect(game.snapshot.notice).toBe('现在不能这样走')
    expect(seat(game.snapshot, 'self').concealedCount).toBe(14)

    game.act({ type: 'discard', tileId: first.id })
    game.act({ type: 'discard', tileId: first.id })
    const self = seat(game.snapshot, 'self')
    expect(self.concealedCount).toBe(13)
    expect(self.hand.some((tile) => tile.id === first.id)).toBe(false)
    expect(game.snapshot.canDiscard).toBe(false)
    game.dispose()
  })

  it('取消后，正在思考的 AI 不会继续改牌', async () => {
    const pending: Array<() => void> = []
    const game = createGame({
      sleep: () => new Promise((resolve) => {
        pending.push(resolve)
      }),
    })
    game.start()
    const tile = seat(game.snapshot, 'self').hand[0]
    if (tile === undefined) {
      throw new Error('没有手牌')
    }
    game.act({ type: 'discard', tileId: tile.id })
    expect(pending.length).toBe(3)
    game.dispose()
    for (const resolve of pending) resolve()
    await flush()

    expect(game.snapshot.rivers.every((river) => river.tiles.length === 0)).toBe(true)
    expect(game.snapshot.rivers.some((river) => river.pending !== null)).toBe(true)
    expect(seat(game.snapshot, 'self').concealedCount).toBe(13)
  })

  it('吃碰杠胡按钮只在合法时出现', () => {
    const win = createBag()
    const winning = takeAll(win, [
      ['一万', 1], ['二万', 1], ['三万', 1], ['四万', 1], ['五万', 1],
      ['六万', 1], ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 1], ['二条', 1], ['三条', 1], ['九筒', 2],
    ])
    const wall = win.take('一条', 1)
    const winningState = createTable({
      hands: [winning, empty, empty, empty],
      wall,
      pendingDrawId: winning[13]?.id,
    })
    expect(labels(humanActions(winningState, 0))).toEqual(['胡'])

    const peng = createBag()
    const humanPeng = peng.take('三万', 2)
    const discardPeng = peng.take('三万', 1)
    let pengState = createTable({
      hands: [humanPeng, discardPeng, empty, empty],
      wall: peng.take('一万', 1),
      current: 1,
    })
    const discarded = discardPeng[0]
    if (discarded === undefined) {
      throw new Error('没有打出的牌')
    }
    pengState = discardTile(pengState, 1, discarded.id)
    expect(labels(humanActions(pengState, 0))).toEqual(['碰', '过'])

    const chi = createBag()
    const humanChi = [...chi.take('二万', 1), ...chi.take('三万', 1)]
    const discardChi = chi.take('四万', 1)
    const chiTile = discardChi[0]
    if (chiTile === undefined) {
      throw new Error('没有打出的牌')
    }
    let chiState = createTable({
      hands: [humanChi, empty, empty, discardChi],
      wall: chi.take('一条', 1),
      current: 3,
    })
    chiState = discardTile(chiState, 3, chiTile.id)
    expect(labels(humanActions(chiState, 0))).toEqual(['吃二三四万', '过'])

    const none = createBag()
    const humanNone = none.take('一万', 1)
    const discardNone = none.take('东', 1)
    const noneTile = discardNone[0]
    if (noneTile === undefined) {
      throw new Error('没有打出的牌')
    }
    let noneState = createTable({
      hands: [humanNone, discardNone, empty, empty],
      wall: none.take('一条', 1),
      current: 1,
    })
    noneState = discardTile(noneState, 1, noneTile.id)
    expect(humanActions(noneState, 0)).toEqual([])

    const gang = createBag()
    const gangHand = gang.take('一万', 4)
    const gangTile = gangHand[0]
    if (gangTile === undefined) {
      throw new Error('没有杠牌')
    }
    const blocked = createTable({
      hands: [gangHand, empty, empty, empty],
      wall: [],
      pendingDrawId: gangTile.id,
    })
    expect(humanActions(blocked, 0).some((action) => action.command.type === 'anGang')).toBe(false)
    const open = createTable({
      hands: [gangHand, empty, empty, empty],
      wall: gang.take('二万', 1),
      pendingDrawId: gangTile.id,
    })
    expect(labels(humanActions(open, 0))).toEqual(['杠 一万'])

    const ming = createBag()
    const mingHand = ming.take('五万', 3)
    const mingDiscard = ming.take('五万', 1)
    const mingTile = mingDiscard[0]
    if (mingTile === undefined) {
      throw new Error('没有打出的牌')
    }
    let mingState = createTable({
      hands: [mingHand, mingDiscard, empty, empty],
      wall: [],
      current: 1,
    })
    mingState = discardTile(mingState, 1, mingTile.id)
    expect(labels(humanActions(mingState, 0))).toEqual(['碰', '过'])
  })

  it('一局结束后可以开始下一局', async () => {
    const game = createGame({ sleep: () => Promise.resolve(), random: () => 0 })
    game.start()
    for (let step = 0; step < 800 && game.snapshot.settlement === null; step += 1) {
      const snap = game.snapshot
      const hu = snap.actions.find((action) => action.command.type === 'hu')
      const pass = snap.actions.find((action) => action.command.type === 'pass')
      if (hu !== undefined) {
        game.act(hu.command)
      } else if (snap.canDiscard) {
        const tile = seat(snap, 'self').hand[0]
        if (tile === undefined) {
          throw new Error('没有手牌')
        }
        game.act({ type: 'discard', tileId: tile.id })
      } else if (pass !== undefined) {
        game.act(pass.command)
      }
      assertConcealedHidden(snap)
      await flush()
    }

    const ended = game.snapshot
    if (ended.settlement === null) {
      throw new Error(`没有打完：${ended.notice} / ${ended.turnText}`)
    }
    expect(ended.settlement.rows).toHaveLength(4)
    expect(ended.settlement.rows.reduce((sum, row) => sum + row.round, 0)).toBe(0)
    expect(ended.settlement.kind === 'hu' || ended.settlement.kind === 'draw').toBe(true)
    if (ended.settlement.kind === 'hu') {
      expect(ended.settlement.hands.length).toBeGreaterThan(0)
      for (const hand of ended.settlement.hands) {
        const meldCount = hand.melds.reduce((sum, meld) => sum + (meld.hidden ? meld.count : meld.tiles.length), 0)
        expect(hand.tiles.length + meldCount).toBeGreaterThanOrEqual(14)
        expect(hand.tiles.filter((tile) => tile.drawn)).toHaveLength(1)
      }
    } else {
      expect(ended.settlement.hands).toEqual([])
    }
    assertConcealedHidden(ended)

    game.act({ type: 'nextRound' })
    const next = game.snapshot
    expect(next.round).toBe(2)
    expect(next.settlement).toBeNull()
    expect(next.wallCount).toBe(83)
    expect(next.rivers.every((river) => river.tiles.length === 0 && river.pending === null)).toBe(true)
    const self = seat(next, 'self')
    expect(self.hand).toHaveLength(next.dealerName === '你' ? 14 : 13)
    expect(self.hand.length).toBeGreaterThan(0)
    for (const place of ['right', 'top', 'left'] as const) {
      expect(seat(next, place).hand).toEqual([])
    }
    game.dispose()
  }, 20_000)
})

function seat(snap: GameSnapshot, place: GameSnapshot['seats'][number]['place']) {
  const found = snap.seats.find((item) => item.place === place)
  if (found === undefined) {
    throw new Error(`没有${place}`)
  }
  return found
}

function labels(actions: ReturnType<typeof humanActions>): string[] {
  return actions.map((action) => action.label)
}

function assertConcealedHidden(snap: GameSnapshot): void {
  expect(snap).not.toHaveProperty('wall')
  for (const item of snap.seats) {
    if (item.place === 'self') {
      continue
    }
    expect(item.hand).toEqual([])
    for (const meld of item.melds) {
      if (meld.hidden) {
        expect(meld).not.toHaveProperty('tiles')
      }
    }
  }
}

async function flush(): Promise<void> {
  for (let count = 0; count < 12; count += 1) {
    await Promise.resolve()
  }
}

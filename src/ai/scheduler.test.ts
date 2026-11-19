import { describe, expect, it } from 'vitest'
import { createTable } from '../engine'
import { createBag, takeAll } from '../engine/rules/test-bag'
import { createAIScheduler, decisionDelayMs, projectAIView } from './index'
import type { AIView } from './types'

describe('思考延迟', () => {
  it('胡牌、吃碰杠和出牌使用各自的等待区间', () => {
    const tile = createBag().take('一万')[0]!
    const pass = { type: 'response', response: { player: 1, action: 'pass' } } as const
    const peng = { type: 'response', response: { player: 1, action: 'peng' } } as const
    const hu = { type: 'response', response: { player: 1, action: 'hu' } } as const

    expect(decisionDelayMs({ type: 'discard', tile }, () => 0)).toBe(2000)
    expect(decisionDelayMs({ type: 'discard', tile }, () => 0.999999)).toBe(6000)
    expect(decisionDelayMs({ type: 'selfHu' }, () => 0)).toBe(1000)
    expect(decisionDelayMs({ type: 'selfHu' }, () => 0.999999)).toBe(2000)
    expect(decisionDelayMs(pass, () => 0)).toBe(1000)
    expect(decisionDelayMs(peng, () => 0.999999)).toBe(4000)
    expect(decisionDelayMs(hu, () => 0)).toBe(1000)
    expect(decisionDelayMs({ type: 'anGang', tileId: tile.id }, () => 0)).toBe(1000)
  })

  it('延迟可以取消，取消后不会出牌', async () => {
    const gate = deferred()
    let applied = 0
    const scheduler = createAIScheduler({
      sleep: () => gate.promise,
      random: () => 0,
    })
    const handle = scheduler.scheduleAIAction({
      seat: 0,
      readView: () => discardView(),
      apply: () => { applied += 1 },
    })
    handle.cancel()
    gate.resolve()
    expect(await handle.status).toBe('cancelled')
    expect(applied).toBe(0)
  })

  it('牌桌变了之后不执行过期决定', async () => {
    let changed = false
    let applied = 0
    const first = discardView()
    const second = projectAIView(createTable({
      hands: [[first.concealed[0]!], [], [], []],
      wall: [],
      pendingDrawId: first.concealed[0]!.id,
    }), 0)
    const scheduler = createAIScheduler({
      sleep: async () => { changed = true },
      random: () => 0,
    })
    const handle = scheduler.scheduleAIAction({
      seat: 0,
      readView: () => (changed ? second : first),
      apply: () => { applied += 1 },
    })
    expect(await handle.status).toBe('stale')
    expect(applied).toBe(0)
  })

  it('同一家同一轮只会执行一次', async () => {
    const gate = deferred()
    let applied = 0
    const view = discardView()
    const scheduler = createAIScheduler({
      sleep: () => gate.promise,
      random: () => 0,
    })
    const request = {
      seat: 0 as const,
      readView: () => view,
      apply: () => { applied += 1 },
    }
    const first = scheduler.scheduleAIAction(request)
    const second = scheduler.scheduleAIAction(request)
    expect(await second.status).toBe('duplicate')
    gate.resolve()
    expect(await first.status).toBe('done')
    expect(applied).toBe(1)
    expect(await scheduler.scheduleAIAction(request).status).toBe('duplicate')
    expect(applied).toBe(1)
  })

  it('重置后会停掉还没做完的决定', async () => {
    const gate = deferred()
    let applied = 0
    const scheduler = createAIScheduler({
      sleep: () => gate.promise,
      random: () => 0,
    })
    const handle = scheduler.scheduleAIAction({
      seat: 0,
      readView: () => discardView(),
      apply: () => { applied += 1 },
    })
    scheduler.cancelAll()
    gate.resolve()
    expect(await handle.status).toBe('cancelled')
    expect(applied).toBe(0)
  })
})

function discardView(): AIView {
  const bag = createBag()
  const hand = takeAll(bag, [
    ['一万', 1], ['二万', 1], ['三万', 1],
    ['四万', 1], ['五万', 1], ['六万', 1],
    ['七万', 1], ['八万', 1], ['九万', 1],
    ['一条', 1], ['三条', 1], ['五条', 1],
    ['七条', 1], ['九条', 1],
  ])
  return projectAIView(createTable({
    hands: [hand, [], [], []],
    wall: [],
    pendingDrawId: hand[13]!.id,
  }), 0)
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

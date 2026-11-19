import type { PlayerIndex } from '../engine'
import { chooseTurnAction } from './aiPlayer'
import type { AIDecision } from './aiPlayer'
import type { AIView } from './types'

export type ScheduleStatus = 'done' | 'cancelled' | 'stale' | 'duplicate'

export interface ScheduleRequest {
  readonly seat: PlayerIndex
  /** 每次调用都要重新投影当前牌桌，不能把旧视图存下来用。 */
  readonly readView: () => AIView
  readonly apply: (decision: AIDecision) => void
}

export interface AIScheduleHandle {
  readonly status: Promise<ScheduleStatus>
  cancel(): void
}

export interface AIScheduler {
  scheduleAIAction(request: ScheduleRequest): AIScheduleHandle
  cancelAll(): void
}

export interface AISchedulerOptions {
  readonly sleep?: (ms: number) => Promise<void>
  /** 返回 [0, 1) 的数，用来决定思考时间。 */
  readonly random?: () => number
}

/**
 * 给一次决定加上思考时间。
 * 胡牌 1～2 秒，吃碰杠和过 1～4 秒，出牌 2～6 秒。
 */
export function decisionDelayMs(decision: AIDecision, random: () => number): number {
  const [min, max] = delayRange(decision)
  const sample = random()
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new Error('随机源必须返回 [0, 1) 内的有限数字')
  }
  return min + Math.floor(sample * (max - min + 1))
}

export function createAIScheduler(options: AISchedulerOptions = {}): AIScheduler {
  const random = options.random ?? Math.random
  const inflight = new Set<PlayerIndex>()
  const completed = new Set<string>()
  const cancels = new Set<() => void>()

  return {
    cancelAll() {
      for (const cancel of cancels) cancel()
      cancels.clear()
      inflight.clear()
      completed.clear()
    },
    scheduleAIAction(request) {
      const seat = request.seat
      const view = request.readView()
      if (view.seat !== seat) throw new Error('座位不一致')
      const key = `${seat}:${view.token}`
      if (inflight.has(seat) || completed.has(key)) {
        return { status: Promise.resolve('duplicate'), cancel() {} }
      }

      inflight.add(seat)
      let cancelled = false
      let cancelSleep = (): void => {}
      const cancel = (): void => {
        cancelled = true
        cancelSleep()
      }
      cancels.add(cancel)

      const status = (async (): Promise<ScheduleStatus> => {
        try {
          const planned = chooseTurnAction(view)
          const outcome = await waitFor(decisionDelayMs(planned, random), options.sleep, (next) => {
            cancelSleep = next
          })
          if (cancelled || outcome === 'cancelled') return 'cancelled'
          const fresh = request.readView()
          if (cancelled) return 'cancelled'
          if (fresh.seat !== seat || fresh.token !== view.token) return 'stale'
          const decision = chooseTurnAction(fresh)
          if (cancelled) return 'cancelled'
          request.apply(decision)
          completed.add(key)
          return 'done'
        } finally {
          inflight.delete(seat)
          cancels.delete(cancel)
        }
      })()

      return { status, cancel }
    },
  }
}

function delayRange(decision: AIDecision): readonly [number, number] {
  if (decision.type === 'selfHu') return [1000, 2000]
  if (decision.type === 'response' && decision.response.action === 'hu') return [1000, 2000]
  if (decision.type === 'discard') return [2000, 6000]
  return [1000, 4000]
}

function waitFor(
  ms: number,
  sleep: ((ms: number) => Promise<void>) | undefined,
  register: (cancel: () => void) => void,
): Promise<'ok' | 'cancelled'> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: 'ok' | 'cancelled'): void => {
      if (settled) return
      settled = true
      resolve(value)
    }
    if (sleep === undefined) {
      const timer = setTimeout(() => finish('ok'), ms)
      register(() => {
        clearTimeout(timer)
        finish('cancelled')
      })
      return
    }
    register(() => finish('cancelled'))
    void sleep(ms).then(() => finish('ok'))
  })
}

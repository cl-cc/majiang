import {
  PLAYER_INDEXES,
  TILE_COUNT,
  createDeck,
  deal,
  declareAnGang,
  declareBuGang,
  declareSelfWin,
  discardTile,
  drawTile,
  isPlayerIndex,
  respond,
  shuffle,
  startRound,
} from '../engine'
import type { PlayerIndex, RandomSource, Response, RoundState, WinAward } from '../engine'
import { chooseTurnAction } from './aiPlayer'
import type { AIDecision } from './aiPlayer'
import { projectAIView } from './view'

export interface MatchResult {
  readonly seed: number
  readonly ending: 'hu' | 'draw'
  readonly steps: number
  readonly wins: readonly WinAward[]
}

/** 四个 AI 用同一套策略打完一局。种子只用来洗牌，决策本身不取随机数。 */
export function playMatch(seed: number): MatchResult {
  return playState(startRound(deal(shuffle(createDeck(), mulberry32(seed)), 0)), seed)
}

/** 从给定牌桌继续，直到胡牌或牌墙摸空。 */
export function playState(initial: RoundState, seed = 0): MatchResult {
  let state = initial
  const seen = new Set<string>()

  for (let step = 0; step < 400; step += 1) {
    assertTable(state)
    if (state.phase.type === 'over') {
      if (state.phase.wins.length === 0) throw new Error('胡牌结果是空的')
      return { seed, ending: 'hu', steps: step, wins: state.phase.wins }
    }
    if (state.phase.type === 'draw') {
      if (state.wall.length === 0) return { seed, ending: 'draw', steps: step, wins: [] }
      if (state.phase.player !== state.current) throw new Error('摸牌的座位不对')
      state = drawTile(state)
      continue
    }
    if (state.phase.type === 'discard') {
      const seat = state.current
      const view = projectAIView(state, seat)
      remember(seen, view.token)
      state = applyTurn(state, seat, chooseTurnAction(view))
      continue
    }

    const actor = state.phase.type === 'response' ? state.phase.discarder : state.phase.player
    const responses: Response[] = []
    for (const seat of PLAYER_INDEXES) {
      if (seat === actor) continue
      const view = projectAIView(state, seat)
      remember(seen, view.token)
      const decision = chooseTurnAction(view)
      if (decision.type !== 'response') throw new Error('响应阶段只能选择吃碰杠胡或过')
      if (decision.response.player !== seat) throw new Error('响应的座位不对')
      if (decision.response.action !== 'pass') responses.push(decision.response)
    }
    state = respond(state, responses)
  }

  throw new Error('对局步数过多，可能死循环')
}

export function playMatches(count: number): readonly MatchResult[] {
  const results: MatchResult[] = []
  for (let seed = 1; seed <= count; seed += 1) {
    try {
      results.push(playMatch(seed))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`第 ${seed} 局失败：${message}`)
    }
  }
  return results
}

function applyTurn(state: RoundState, seat: PlayerIndex, decision: AIDecision): RoundState {
  switch (decision.type) {
    case 'discard':
      if (!state.players[seat].concealed.some((tile) => tile.id === decision.tile.id)) {
        throw new Error('打出的牌不在手里')
      }
      return discardTile(state, seat, decision.tile.id)
    case 'selfHu':
      return declareSelfWin(state)
    case 'anGang':
      return declareAnGang(state, decision.tileId)
    case 'buGang':
      return declareBuGang(state, decision.tileId)
    case 'response':
      throw new Error('出牌阶段不能响应')
  }
}

function remember(seen: Set<string>, token: string): void {
  if (seen.has(token)) throw new Error('重复执行同一轮操作')
  seen.add(token)
}

function assertTable(state: RoundState): void {
  const ids = collectIds(state)
  if (ids.length !== TILE_COUNT || new Set(ids).size !== TILE_COUNT) {
    throw new Error(`牌数不守恒：${ids.length} 张，其中 ${new Set(ids).size} 张不重复`)
  }
  const score = state.players.reduce((sum, player) => sum + player.score, 0)
  if (score !== 0) throw new Error('四家分数加起来不是 0')
  if (!isPlayerIndex(state.current)) throw new Error('轮次不对')
  if (state.phase.type === 'draw' && state.phase.player !== state.current) {
    throw new Error('轮次不对')
  }
}

function collectIds(state: RoundState): number[] {
  const ids: number[] = []
  for (const player of state.players) {
    for (const tile of player.concealed) ids.push(tile.id)
    for (const meld of player.melds) {
      for (const tile of meld.tiles) ids.push(tile.id)
    }
  }
  for (const tile of state.wall) ids.push(tile.id)
  for (const tile of state.discards) ids.push(tile.id)
  if (state.phase.type === 'response') ids.push(state.phase.tile.id)
  if (state.phase.type === 'over') {
    for (const win of state.phase.wins) {
      if (!ids.includes(win.tile.id)) ids.push(win.tile.id)
    }
  }
  return ids
}

function mulberry32(seed: number): RandomSource {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

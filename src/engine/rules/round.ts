import { isSameFace } from '../tile/types'
import type { Tile, TileKind } from '../tile/types'
import { PLAYER_INDEXES } from '../tile/deal'
import type { DealResult, PlayerIndex } from '../tile/deal'
import { chiHandTiles } from './actions'
import { canHu } from './hu'
import type { WinPattern } from './hu'
import { assertValidMeld } from './meld'
import type { AnGangMeld, BuGangMeld, ChiMeld, Meld, MingGangMeld, PengMeld } from './meld'
import { resolveResponses } from './priority'
import type { Response } from './priority'
import { paymentDeltas, scoreWin } from './score'
import type { WinMethod } from './score'
import { nextPlayer } from './seats'

export interface PlayerState {
  readonly concealed: readonly Tile[]
  readonly melds: readonly Meld[]
  readonly score: number
}

export interface WinAward {
  readonly player: PlayerIndex
  readonly pattern: WinPattern
  readonly method: WinMethod
  readonly points: number
  readonly tile: Tile
}

export type RoundPhase =
  | { readonly type: 'discard'; readonly selfTurn: boolean; readonly from: 'deal' | 'draw' | 'kong' | 'claim' }
  | { readonly type: 'response'; readonly discarder: PlayerIndex; readonly tile: Tile }
  | { readonly type: 'qiangGang'; readonly player: PlayerIndex; readonly tile: Tile }
  | { readonly type: 'draw'; readonly player: PlayerIndex }
  | { readonly type: 'over'; readonly wins: readonly WinAward[] }

export interface RoundState {
  readonly players: readonly [PlayerState, PlayerState, PlayerState, PlayerState]
  readonly wall: readonly Tile[]
  readonly discards: readonly Tile[]
  readonly current: PlayerIndex
  readonly phase: RoundPhase
  readonly pendingDraw: Tile | null
}

export function createTable(input: {
  readonly hands: readonly [readonly Tile[], readonly Tile[], readonly Tile[], readonly Tile[]]
  readonly melds?: readonly [readonly Meld[], readonly Meld[], readonly Meld[], readonly Meld[]]
  readonly wall: readonly Tile[]
  readonly current?: PlayerIndex
  readonly selfTurn?: boolean
  readonly from?: 'deal' | 'draw' | 'kong' | 'claim'
  readonly pendingDrawId?: number
}): RoundState {
  const current = input.current ?? 0
  const melds = input.melds ?? [[], [], [], []]
  const players = PLAYER_INDEXES.map((seat) => {
    const hand = input.hands[seat]
    const seatMelds = melds[seat]
    return {
      concealed: hand.slice(),
      melds: seatMelds.slice(),
      score: 0,
    }
  })
  const statePlayers = asPlayers(players)
  for (const player of statePlayers) {
    for (const meld of player.melds) {
      assertValidMeld(meld)
    }
  }

  const pendingDraw = input.pendingDrawId === undefined
    ? null
    : statePlayers[current].concealed.find((tile) => tile.id === input.pendingDrawId) ?? null
  if (input.pendingDrawId !== undefined && pendingDraw === null) {
    throw new Error('进张不在当前手里')
  }

  assertUniqueTiles(statePlayers, input.wall)
  return {
    players: statePlayers,
    wall: input.wall.slice(),
    discards: [],
    current,
    pendingDraw,
    phase: {
      type: 'discard',
      selfTurn: input.selfTurn ?? true,
      from: input.from ?? 'deal',
    },
  }
}

export function startRound(result: DealResult): RoundState {
  const dealerHand = result.hands[result.dealerIndex]
  const pending = dealerHand[dealerHand.length - 1]
  if (pending === undefined) {
    throw new Error('庄家没有手牌')
  }
  return createTable({
    hands: result.hands,
    wall: result.wall,
    current: result.dealerIndex,
    selfTurn: true,
    from: 'deal',
    pendingDrawId: pending.id,
  })
}

export function discardTile(state: RoundState, player: PlayerIndex, tileId: number): RoundState {
  if (state.phase.type !== 'discard') {
    throw new Error('现在不能出牌')
  }
  if (player !== state.current) {
    throw new Error('还没轮到这家出牌')
  }
  const hand = state.players[player].concealed
  if (!hand.some((tile) => tile.id === tileId)) {
    throw new Error('手牌里没有这张牌')
  }
  const tile = hand.find((item) => item.id === tileId)
  if (tile === undefined) {
    throw new Error('手牌里没有这张牌')
  }
  return {
    ...state,
    pendingDraw: null,
    players: replacePlayer(state.players, player, {
      ...state.players[player],
      concealed: hand.filter((item) => item.id !== tileId),
    }),
    phase: { type: 'response', discarder: player, tile },
  }
}

export function drawTile(state: RoundState): RoundState {
  if (state.phase.type !== 'draw') {
    throw new Error('现在不能摸牌')
  }
  const tile = state.wall[0]
  if (tile === undefined) {
    throw new Error('牌墙已经空了')
  }
  const player = state.phase.player
  return {
    ...state,
    wall: state.wall.slice(1),
    current: player,
    pendingDraw: tile,
    phase: { type: 'discard', selfTurn: true, from: 'draw' },
    players: replacePlayer(state.players, player, {
      ...state.players[player],
      concealed: [...state.players[player].concealed, tile],
    }),
  }
}

/** 响应别人打出的牌，或响应补杠。优先级是胡、杠、碰、吃、过。 */
export function respond(state: RoundState, responses: readonly Response[]): RoundState {
  if (state.phase.type === 'response') {
    return respondToDiscard(state, state.phase.discarder, state.phase.tile, responses)
  }
  if (state.phase.type === 'qiangGang') {
    return respondToQiangGang(state, state.phase.player, state.phase.tile, responses)
  }
  throw new Error('现在没有可以响应的牌')
}

export function declareAnGang(state: RoundState, tileId: number): RoundState {
  assertSelfTurn(state)
  if (state.wall.length === 0) {
    throw new Error('牌墙没有补牌，不能杠')
  }
  const seat = state.current
  const player = state.players[seat]
  const selected = player.concealed.find((tile) => tile.id === tileId)
  if (selected === undefined) {
    throw new Error('手牌里没有这张牌')
  }
  const { taken, rest } = takeFace(player.concealed, selected.kind, 4)
  const gang: AnGangMeld = { type: 'anGang', tiles: asFour(taken) }
  assertValidMeld(gang)
  return drawReplacement(state, seat, rest, [...player.melds, gang])
}

export function declareBuGang(state: RoundState, tileId: number): RoundState {
  assertSelfTurn(state)
  if (state.wall.length === 0) {
    throw new Error('牌墙没有补牌，不能杠')
  }
  const seat = state.current
  const player = state.players[seat]
  const tile = player.concealed.find((item) => item.id === tileId)
  if (tile === undefined) {
    throw new Error('手牌里没有这张牌')
  }
  const pengIndex = player.melds.findIndex(
    (meld) => meld.type === 'peng' && isSameFace(meld.tiles[0].kind, tile.kind),
  )
  const peng = player.melds[pengIndex]
  if (peng === undefined || peng.type !== 'peng') {
    throw new Error('没有可以补杠的碰牌')
  }
  const gang: BuGangMeld = {
    type: 'buGang',
    tiles: [peng.tiles[0], peng.tiles[1], peng.tiles[2], tile],
    from: peng.from,
    claimed: peng.claimed,
    added: tile,
  }
  assertValidMeld(gang)
  const melds = player.melds.slice()
  melds[pengIndex] = gang
  return {
    ...state,
    pendingDraw: null,
    players: replacePlayer(state.players, seat, {
      ...player,
      concealed: player.concealed.filter((item) => item.id !== tile.id),
      melds,
    }),
    phase: { type: 'qiangGang', player: seat, tile },
  }
}

export function declareSelfWin(state: RoundState): RoundState {
  assertSelfTurn(state)
  const tile = state.pendingDraw
  if (tile === null) {
    throw new Error('没有可以胡的进张')
  }
  const player = state.players[state.current]
  if (!player.concealed.some((item) => item.id === tile.id)) {
    throw new Error('进张不在手里')
  }
  if (canHu(player.concealed, tile, player.melds) === null) {
    throw new Error('这手牌不能胡')
  }
  const method: WinMethod = state.phase.type === 'discard' && state.phase.from === 'kong'
    ? 'gangShang'
    : 'zimo'
  return finishWins(state, [state.current], tile, method, 'others')
}

function respondToDiscard(
  state: RoundState,
  discarder: PlayerIndex,
  tile: Tile,
  responses: readonly Response[],
): RoundState {
  const decision = resolveResponses({
    discarder,
    tile,
    players: state.players,
    responses,
    mode: 'discard',
  })
  switch (decision.type) {
    case 'pass':
      return {
        ...state,
        discards: [...state.discards, tile],
        current: nextPlayer(discarder),
        pendingDraw: null,
        phase: { type: 'draw', player: nextPlayer(discarder) },
      }
    case 'hu':
      return finishWins(state, decision.winners, tile, 'dianpao', discarder)
    case 'peng':
      return applyPeng(state, decision.player, tile, discarder)
    case 'chi':
      return applyChi(state, decision.player, tile, discarder, decision.tileIds)
    case 'mingGang':
      if (state.wall.length === 0) {
        throw new Error('牌墙没有补牌，不能杠')
      }
      return applyMingGang(state, decision.player, tile, discarder)
  }
}

function respondToQiangGang(
  state: RoundState,
  player: PlayerIndex,
  tile: Tile,
  responses: readonly Response[],
): RoundState {
  const decision = resolveResponses({
    discarder: player,
    tile,
    players: state.players,
    responses,
    mode: 'qiangGang',
  })
  if (decision.type === 'pass') {
    const hand = state.players[player]
    return drawReplacement(state, player, hand.concealed, hand.melds)
  }
  if (decision.type !== 'hu') {
    throw new Error('抢杠只能胡或过')
  }
  const reverted = revertBuGang(state, player, tile)
  return finishWins(reverted, decision.winners, tile, 'qiangGang', player)
}

function applyPeng(state: RoundState, player: PlayerIndex, tile: Tile, from: PlayerIndex): RoundState {
  const hand = state.players[player]
  const { taken, rest } = takeFace(hand.concealed, tile.kind, 2)
  const meld: PengMeld = {
    type: 'peng',
    tiles: [taken[0]!, taken[1]!, tile],
    from,
    claimed: tile,
  }
  assertValidMeld(meld)
  return {
    ...state,
    current: player,
    pendingDraw: null,
    phase: { type: 'discard', selfTurn: false, from: 'claim' },
    players: replacePlayer(state.players, player, {
      ...hand,
      concealed: rest,
      melds: [...hand.melds, meld],
    }),
  }
}

function applyChi(
  state: RoundState,
  player: PlayerIndex,
  tile: Tile,
  from: PlayerIndex,
  tileIds: readonly [number, number],
): RoundState {
  const hand = state.players[player]
  const matched = chiHandTiles(hand.concealed, tile, tileIds)
  if (matched === null) {
    throw new Error('这张牌不能这样吃')
  }
  const rest = hand.concealed.filter((item) => item.id !== matched[0].id && item.id !== matched[1].id)
  const meld: ChiMeld = {
    type: 'chi',
    tiles: sortChow([matched[0], matched[1], tile]),
    from,
    claimed: tile,
  }
  assertValidMeld(meld)
  return {
    ...state,
    current: player,
    pendingDraw: null,
    phase: { type: 'discard', selfTurn: false, from: 'claim' },
    players: replacePlayer(state.players, player, {
      ...hand,
      concealed: rest,
      melds: [...hand.melds, meld],
    }),
  }
}

function applyMingGang(
  state: RoundState,
  player: PlayerIndex,
  tile: Tile,
  from: PlayerIndex,
): RoundState {
  const hand = state.players[player]
  const { taken, rest } = takeFace(hand.concealed, tile.kind, 3)
  const meld: MingGangMeld = {
    type: 'mingGang',
    tiles: asFour([...taken, tile]),
    from,
    claimed: tile,
  }
  assertValidMeld(meld)
  return drawReplacement(state, player, rest, [...hand.melds, meld])
}

function revertBuGang(state: RoundState, player: PlayerIndex, added: Tile): RoundState {
  const hand = state.players[player]
  const index = hand.melds.findIndex((meld) => meld.type === 'buGang' && meld.added.id === added.id)
  const meld = hand.melds[index]
  if (meld === undefined || meld.type !== 'buGang') {
    throw new Error('没有可以撤销的补杠')
  }
  const kept = meld.tiles.filter((tile) => tile.id !== added.id)
  const peng: PengMeld = {
    type: 'peng',
    tiles: asThree(kept),
    from: meld.from,
    claimed: meld.claimed,
  }
  assertValidMeld(peng)
  const melds = hand.melds.slice()
  melds[index] = peng
  return {
    ...state,
    players: replacePlayer(state.players, player, { ...hand, melds }),
  }
}

function drawReplacement(
  state: RoundState,
  player: PlayerIndex,
  concealed: readonly Tile[],
  melds: readonly Meld[],
): RoundState {
  const tile = state.wall[0]
  if (tile === undefined) {
    throw new Error('牌墙没有补牌，不能杠')
  }
  return {
    ...state,
    wall: state.wall.slice(1),
    current: player,
    pendingDraw: tile,
    phase: { type: 'discard', selfTurn: true, from: 'kong' },
    players: replacePlayer(state.players, player, {
      concealed: [...concealed, tile],
      melds,
      score: state.players[player].score,
    }),
  }
}

function finishWins(
  state: RoundState,
  winnerSeats: readonly PlayerIndex[],
  tile: Tile,
  method: WinMethod,
  payer: PlayerIndex | 'others',
): RoundState {
  const awards: WinAward[] = winnerSeats.map((seat) => {
    const hand = state.players[seat]
    const result = canHu(hand.concealed, tile, hand.melds)
    if (result === null) {
      throw new Error('这手牌不能胡')
    }
    return {
      player: seat,
      pattern: result.pattern,
      method,
      points: scoreWin(result.pattern, method),
      tile,
    }
  })
  const deltas = paymentDeltas(awards, payer)
  let players = state.players
  for (const seat of PLAYER_INDEXES) {
    const delta = deltas[seat]
    players = replacePlayer(players, seat, {
      ...players[seat],
      score: players[seat].score + delta,
    })
  }
  return {
    ...state,
    players,
    pendingDraw: null,
    phase: { type: 'over', wins: awards },
  }
}

function assertSelfTurn(state: RoundState): void {
  if (state.phase.type !== 'discard' || !state.phase.selfTurn) {
    throw new Error('现在不能杠或胡牌')
  }
}

function takeFace(
  hand: readonly Tile[],
  kind: TileKind,
  count: number,
): { readonly taken: Tile[]; readonly rest: Tile[] } {
  const taken: Tile[] = []
  const rest: Tile[] = []
  for (const tile of hand) {
    if (taken.length < count && isSameFace(tile.kind, kind)) {
      taken.push(tile)
    } else {
      rest.push(tile)
    }
  }
  if (taken.length !== count) {
    throw new Error('手里没有足够的牌')
  }
  return { taken, rest }
}

function sortChow(tiles: readonly [Tile, Tile, Tile]): readonly [Tile, Tile, Tile] {
  const sorted = [...tiles].sort((left, right) => {
    if (left.kind.category !== 'number' || right.kind.category !== 'number') {
      return 0
    }
    return left.kind.rank - right.kind.rank
  })
  return asThree(sorted)
}

function asThree(tiles: readonly Tile[]): readonly [Tile, Tile, Tile] {
  const first = tiles[0]
  const second = tiles[1]
  const third = tiles[2]
  if (first === undefined || second === undefined || third === undefined || tiles.length !== 3) {
    throw new Error('牌组张数不正确')
  }
  return [first, second, third]
}

function asFour(tiles: readonly Tile[]): readonly [Tile, Tile, Tile, Tile] {
  const first = tiles[0]
  const second = tiles[1]
  const third = tiles[2]
  const fourth = tiles[3]
  if (
    first === undefined ||
    second === undefined ||
    third === undefined ||
    fourth === undefined ||
    tiles.length !== 4
  ) {
    throw new Error('杠牌张数不正确')
  }
  return [first, second, third, fourth]
}

function replacePlayer(
  players: RoundState['players'],
  index: PlayerIndex,
  next: PlayerState,
): RoundState['players'] {
  switch (index) {
    case 0:
      return [next, players[1], players[2], players[3]]
    case 1:
      return [players[0], next, players[2], players[3]]
    case 2:
      return [players[0], players[1], next, players[3]]
    case 3:
      return [players[0], players[1], players[2], next]
  }
}

function asPlayers(
  players: readonly PlayerState[],
): readonly [PlayerState, PlayerState, PlayerState, PlayerState] {
  const first = players[0]
  const second = players[1]
  const third = players[2]
  const fourth = players[3]
  if (first === undefined || second === undefined || third === undefined || fourth === undefined) {
    throw new Error('必须有四家')
  }
  return [first, second, third, fourth]
}

function assertUniqueTiles(players: readonly PlayerState[], wall: readonly Tile[]): void {
  const seen = new Set<number>()
  const tiles = [
    ...wall,
    ...players.flatMap((player) => [
      ...player.concealed,
      ...player.melds.flatMap((meld) => meld.tiles),
    ]),
  ]
  for (const tile of tiles) {
    if (seen.has(tile.id)) {
      throw new Error(`牌桌上有重复的牌：${tile.id}`)
    }
    seen.add(tile.id)
  }
}

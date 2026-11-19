import type { Tile } from '../tile/types'
import { isPlayerIndex } from '../tile/deal'
import type { PlayerIndex } from '../tile/deal'
import { canHu } from './hu'
import { canMingGang, canPeng, chiHandTiles } from './actions'
import type { Meld } from './meld'
import { isNextPlayer, seatsAfter } from './seats'

export interface ClaimHand {
  readonly concealed: readonly Tile[]
  readonly melds: readonly Meld[]
}

export type Response =
  | { readonly player: PlayerIndex; readonly action: 'hu' }
  | { readonly player: PlayerIndex; readonly action: 'peng' }
  | { readonly player: PlayerIndex; readonly action: 'gang' }
  | { readonly player: PlayerIndex; readonly action: 'chi'; readonly tileIds: readonly [number, number] }
  | { readonly player: PlayerIndex; readonly action: 'pass' }

export type Decision =
  | { readonly type: 'hu'; readonly winners: readonly PlayerIndex[] }
  | { readonly type: 'mingGang'; readonly player: PlayerIndex }
  | { readonly type: 'peng'; readonly player: PlayerIndex }
  | { readonly type: 'chi'; readonly player: PlayerIndex; readonly tileIds: readonly [number, number] }
  | { readonly type: 'pass' }

const ACTION_RANK = {
  gang: 3,
  peng: 2,
  chi: 1,
} as const

/**
 * 胡牌优先于杠，杠优先于碰，碰优先于吃，吃优先于过。
 * 几家同时胡，全部成立。其他同样的操作，由靠出牌人更近的下家得到。
 */
export function resolveResponses(input: {
  readonly discarder: PlayerIndex
  readonly tile: Tile
  readonly players: readonly [ClaimHand, ClaimHand, ClaimHand, ClaimHand]
  readonly responses: readonly Response[]
  readonly mode: 'discard' | 'qiangGang'
}): Decision {
  const seen = new Set<PlayerIndex>()
  for (const response of input.responses) {
    if (!isPlayerIndex(response.player)) {
      throw new Error('座位不存在')
    }
    if (seen.has(response.player)) {
      throw new Error('同一家不能响应两次')
    }
    seen.add(response.player)
    if (response.player === input.discarder) {
      throw new Error(input.mode === 'qiangGang' ? '不能抢自己的杠' : '不能响应自己打出的牌')
    }
    assertLegal(input, response)
  }

  const winners = input.responses
    .filter((response) => response.action === 'hu')
    .map((response) => response.player)
    .sort((left, right) => left - right)
  if (winners.length > 0) {
    return { type: 'hu', winners }
  }

  const actionable = input.responses.filter(
    (response): response is Exclude<Response, { readonly action: 'hu' | 'pass' }> =>
      response.action === 'gang' || response.action === 'peng' || response.action === 'chi',
  )
  const best = pickClosest(input.discarder, actionable)
  if (best === null) {
    return { type: 'pass' }
  }
  switch (best.action) {
    case 'gang':
      return { type: 'mingGang', player: best.player }
    case 'peng':
      return { type: 'peng', player: best.player }
    case 'chi':
      return { type: 'chi', player: best.player, tileIds: best.tileIds }
  }
}

function assertLegal(
  input: {
    readonly discarder: PlayerIndex
    readonly tile: Tile
    readonly players: readonly [ClaimHand, ClaimHand, ClaimHand, ClaimHand]
    readonly mode: 'discard' | 'qiangGang'
  },
  response: Response,
): void {
  const hand = input.players[response.player]
  switch (response.action) {
    case 'pass':
      return
    case 'hu':
      if (canHu(hand.concealed, input.tile, hand.melds) === null) {
        throw new Error('这手牌不能胡')
      }
      return
    case 'peng':
      if (input.mode === 'qiangGang') {
        throw new Error('抢杠只能胡或过')
      }
      if (!canPeng(hand.concealed, input.tile, response.player, input.discarder)) {
        throw new Error('不能碰这张牌')
      }
      return
    case 'gang':
      if (input.mode === 'qiangGang') {
        throw new Error('抢杠只能胡或过')
      }
      if (!canMingGang(hand.concealed, input.tile, response.player, input.discarder)) {
        throw new Error('不能明杠这张牌')
      }
      return
    case 'chi':
      if (input.mode === 'qiangGang') {
        throw new Error('抢杠只能胡或过')
      }
      if (!isNextPlayer(input.discarder, response.player)) {
        throw new Error('只能吃上家打出的牌')
      }
      if (chiHandTiles(hand.concealed, input.tile, response.tileIds) === null) {
        throw new Error('这张牌不能这样吃')
      }
      return
  }
}

function pickClosest(
  discarder: PlayerIndex,
  responses: readonly Exclude<Response, { readonly action: 'hu' | 'pass' }>[],
): Exclude<Response, { readonly action: 'hu' | 'pass' }> | null {
  let best: Exclude<Response, { readonly action: 'hu' | 'pass' }> | null = null
  for (const response of responses) {
    if (best === null || betterClaim(discarder, response, best)) {
      best = response
    }
  }
  return best
}

function betterClaim(
  discarder: PlayerIndex,
  candidate: Exclude<Response, { readonly action: 'hu' | 'pass' }>,
  current: Exclude<Response, { readonly action: 'hu' | 'pass' }>,
): boolean {
  const candidateRank = ACTION_RANK[candidate.action]
  const currentRank = ACTION_RANK[current.action]
  if (candidateRank !== currentRank) {
    return candidateRank > currentRank
  }
  return seatsAfter(discarder, candidate.player) < seatsAfter(discarder, current.player)
}

import { PLAYER_COUNT, isPlayerIndex } from '../tile/deal'
import type { PlayerIndex } from '../tile/deal'

/** 下家。座位按出牌顺序递增。 */
export function nextPlayer(player: PlayerIndex): PlayerIndex {
  const seat = (player + 1) % PLAYER_COUNT
  if (!isPlayerIndex(seat)) {
    throw new Error('座位计算错误')
  }
  return seat
}

/** player 是不是 discarder 的下家。只有下家可以吃上家打出的牌。 */
export function isNextPlayer(discarder: PlayerIndex, player: PlayerIndex): boolean {
  return player === nextPlayer(discarder)
}

/** 从出牌的人算起，沿出牌方向到这位玩家要经过几家。本人是 0。 */
export function seatsAfter(discarder: PlayerIndex, player: PlayerIndex): number {
  return (player - discarder + PLAYER_COUNT) % PLAYER_COUNT
}

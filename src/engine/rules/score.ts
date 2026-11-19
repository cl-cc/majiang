import { PLAYER_COUNT, PLAYER_INDEXES } from '../tile/deal'
import type { PlayerIndex } from '../tile/deal'
import type { WinPattern } from './hu'

export type WinMethod = 'dianpao' | 'zimo' | 'gangShang' | 'qiangGang'

/**
 * 这手胡牌的分值。
 * 普通点炮 1 分，普通自摸 2 分。七对、碰碰胡为 2 分。
 * 杠上开花在这个分值上再加 1 分。抢杠胡按点炮计算。
 */
export function scoreWin(pattern: WinPattern, method: WinMethod): number {
  const special = pattern === 'sevenPairs' || pattern === 'pengPeng'
  const selfDraw = method === 'zimo' || method === 'gangShang'
  let points = special || selfDraw ? 2 : 1
  if (method === 'gangShang') {
    points += 1
  }
  return points
}

/**
 * 把胡牌分摊到四家。
 * 点炮和抢杠由责任人支付。自摸和杠上开花由其余三家各支付同样的分值。
 */
export function paymentDeltas(
  winners: readonly { readonly player: PlayerIndex; readonly points: number }[],
  payer: PlayerIndex | 'others',
): readonly [number, number, number, number] {
  const deltas: [number, number, number, number] = [0, 0, 0, 0]
  if (winners.length === 0) {
    throw new Error('没有胡牌的人')
  }

  if (payer === 'others') {
    const winner = winners[0]
    if (winners.length !== 1 || winner === undefined) {
      throw new Error('自摸只能有一个胡牌的人')
    }
    for (const seat of PLAYER_INDEXES) {
      deltas[seat] = seat === winner.player ? winner.points * (PLAYER_COUNT - 1) : -winner.points
    }
    return deltas
  }

  for (const winner of winners) {
    if (winner.player === payer) {
      throw new Error('出牌的人不能胡自己打出的牌')
    }
    deltas[winner.player] += winner.points
    deltas[payer] -= winner.points
  }
  return deltas
}

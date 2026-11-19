import type { Tile } from '../engine'
import type { Response } from '../engine'
import { chooseAction, chooseSelfAction } from './actionStrategy'
import { chooseDiscard } from './discardStrategy'
import type { AIView } from './types'

export type AIDecision =
  | { readonly type: 'discard'; readonly tile: Tile }
  | { readonly type: 'selfHu' }
  | { readonly type: 'anGang'; readonly tileId: number }
  | { readonly type: 'buGang'; readonly tileId: number }
  | { readonly type: 'response'; readonly response: Response }

/**
 * 按当前阶段选出这一步。
 * 三个 AI 用的是同一套判断，不看别人的暗手。
 */
export function chooseTurnAction(view: AIView): AIDecision {
  if (view.phase.type === 'response' || view.phase.type === 'qiangGang') {
    return { type: 'response', response: chooseAction(view) }
  }
  if (view.phase.type !== 'discard' || view.current !== view.seat) {
    throw new Error('现在不能出牌')
  }
  if (view.phase.selfTurn) {
    const self = chooseSelfAction(view)
    if (self.type === 'selfHu') return { type: 'selfHu' }
    if (self.type === 'anGang') return { type: 'anGang', tileId: self.tileId }
    if (self.type === 'buGang') return { type: 'buGang', tileId: self.tileId }
  }
  return { type: 'discard', tile: chooseDiscard(view) }
}

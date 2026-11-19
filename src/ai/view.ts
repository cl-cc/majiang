import { PLAYER_INDEXES } from '../engine'
import type { Meld, PlayerIndex, RoundPhase, RoundState, Tile } from '../engine'
import { FACE_COUNT } from '../engine'
import { faceIndex } from '../engine/rules/face'
import type { AIPhase, AIView, PublicMeld } from './types'

/**
 * 从完整牌桌切出某一个座位能看到的内容。
 * 这是决策模块接触牌桌的唯一入口；返回值里没有别人的暗手和牌墙。
 */
export function projectAIView(state: RoundState, seat: PlayerIndex): AIView {
  const player = state.players[seat]
  const concealed = player.concealed.slice()
  const melds = player.melds.map(copyMeld)
  const publicMelds = asPublicMelds(PLAYER_INDEXES.map((index) => (
    state.players[index].melds.map(toPublic)
  )))
  const discards = state.discards.slice()
  const phase = copyPhase(state.phase)
  const wallCount = state.wall.length
  const view = {
    seat,
    concealed,
    melds,
    publicMelds,
    discards,
    wallCount,
    current: state.current,
    phase,
    token: '',
  }
  return {
    ...view,
    token: actionToken(view),
  }
}

/** 自己的暗手、自己的副露、别人的明牌、弃牌，以及正在打出的那张牌。 */
export function visibleFaceCounts(view: AIView): number[] {
  const counts = Array.from({ length: FACE_COUNT }, () => 0)
  const add = (tile: Tile): void => {
    const index = faceIndex(tile.kind)
    const current = counts[index]
    if (current === undefined) {
      throw new Error('牌面下标错误')
    }
    counts[index] = current + 1
  }

  for (const tile of view.concealed) add(tile)
  for (const meld of view.melds) {
    for (const tile of meld.tiles) add(tile)
  }
  for (const index of PLAYER_INDEXES) {
    if (index === view.seat) continue
    for (const meld of view.publicMelds[index]) {
      if (meld.type === 'anGang') continue
      for (const tile of meld.tiles) add(tile)
    }
  }
  for (const tile of view.discards) add(tile)
  if (view.phase.type === 'response') add(view.phase.tile)
  return counts
}

function actionToken(view: Omit<AIView, 'token'>): string {
  return [
    view.seat,
    view.current,
    view.wallCount,
    phaseToken(view.phase),
    view.concealed.map((tile) => tile.id).join('.'),
    view.melds.map(meldToken).join(','),
    view.publicMelds.map((melds) => melds.map(meldToken).join(',')).join('|'),
    view.discards.map((tile) => tile.id).join('.'),
  ].join('#')
}

function phaseToken(phase: AIPhase): string {
  switch (phase.type) {
    case 'discard':
      return `discard:${phase.selfTurn ? 1 : 0}:${phase.from}`
    case 'response':
      return `response:${phase.discarder}:${phase.tile.id}`
    case 'qiangGang':
      return `qiang:${phase.player}:${phase.tile.id}`
    case 'draw':
      return `draw:${phase.player}`
    case 'over':
      return 'over'
  }
}

function meldToken(meld: Meld | PublicMeld): string {
  if (meld.type === 'anGang' && !('tiles' in meld)) return 'an'
  if (meld.type === 'anGang') return `an:${meld.tiles.map((tile) => tile.id).join('.')}`
  return `${meld.type}:${meld.tiles.map((tile) => tile.id).join('.')}`
}

function copyPhase(phase: RoundPhase): AIPhase {
  switch (phase.type) {
    case 'discard':
      return { type: 'discard', selfTurn: phase.selfTurn, from: phase.from }
    case 'response':
      return { type: 'response', discarder: phase.discarder, tile: phase.tile }
    case 'qiangGang':
      return { type: 'qiangGang', player: phase.player, tile: phase.tile }
    case 'draw':
      return { type: 'draw', player: phase.player }
    case 'over':
      return { type: 'over' }
  }
}

function copyMeld(meld: Meld): Meld {
  switch (meld.type) {
    case 'chi':
      return { type: 'chi', tiles: [meld.tiles[0], meld.tiles[1], meld.tiles[2]], from: meld.from, claimed: meld.claimed }
    case 'peng':
      return { type: 'peng', tiles: [meld.tiles[0], meld.tiles[1], meld.tiles[2]], from: meld.from, claimed: meld.claimed }
    case 'mingGang':
      return {
        type: 'mingGang',
        tiles: [meld.tiles[0], meld.tiles[1], meld.tiles[2], meld.tiles[3]],
        from: meld.from,
        claimed: meld.claimed,
      }
    case 'anGang':
      return { type: 'anGang', tiles: [meld.tiles[0], meld.tiles[1], meld.tiles[2], meld.tiles[3]] }
    case 'buGang':
      return {
        type: 'buGang',
        tiles: [meld.tiles[0], meld.tiles[1], meld.tiles[2], meld.tiles[3]],
        from: meld.from,
        claimed: meld.claimed,
        added: meld.added,
      }
  }
}

function toPublic(meld: Meld): PublicMeld {
  if (meld.type === 'anGang') return { type: 'anGang' }
  return copyMeld(meld)
}

function asPublicMelds(
  melds: readonly (readonly PublicMeld[])[],
): AIView['publicMelds'] {
  const first = melds[0]
  const second = melds[1]
  const third = melds[2]
  const fourth = melds[3]
  if (first === undefined || second === undefined || third === undefined || fourth === undefined) {
    throw new Error('必须有四家')
  }
  return [first, second, third, fourth]
}

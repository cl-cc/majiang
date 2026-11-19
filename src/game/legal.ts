import { canHu, canMingGang, canPeng, faceKey, listBuGangTiles, listChiOptions, tileLabel } from '../engine'
import type { ChiOption, PlayerIndex, RoundState, Tile } from '../engine'
import type { ClaimCommand, LegalAction } from './types'

const RANK_TEXT = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const
const SUIT_TEXT = { wan: '万', tiao: '条', tong: '筒' } as const

export function canHumanDiscard(state: RoundState, seat: PlayerIndex): boolean {
  return state.phase.type === 'discard' && state.current === seat
}

/** 当前这位玩家可以点的吃、碰、杠、胡、过。出牌不在这里。 */
export function humanActions(state: RoundState, seat: PlayerIndex): LegalAction[] {
  const phase = state.phase
  if (phase.type === 'discard') {
    if (state.current !== seat || !phase.selfTurn) {
      return []
    }
    return selfActions(state, seat)
  }
  if (phase.type === 'response') {
    if (phase.discarder === seat) {
      return []
    }
    return claimActions(state, seat, phase.tile, phase.discarder)
  }
  if (phase.type === 'qiangGang') {
    if (phase.player === seat) {
      return []
    }
    return qiangActions(state, seat, phase.tile)
  }
  return []
}

export function isSameCommand(left: ClaimCommand, right: ClaimCommand): boolean {
  if (left.type !== right.type) {
    return false
  }
  switch (left.type) {
    case 'anGang':
      return right.type === 'anGang' && left.tileId === right.tileId
    case 'buGang':
      return right.type === 'buGang' && left.tileId === right.tileId
    case 'chi':
      return right.type === 'chi' && left.tileIds[0] === right.tileIds[0] && left.tileIds[1] === right.tileIds[1]
    case 'hu':
    case 'pass':
    case 'peng':
    case 'mingGang':
      return true
  }
}

function selfActions(state: RoundState, seat: PlayerIndex): LegalAction[] {
  const hand = state.players[seat]
  const actions: LegalAction[] = []
  const drawn = state.pendingDraw
  if (drawn !== null && canHu(hand.concealed, drawn, hand.melds) !== null) {
    actions.push({ id: 'hu', label: '胡', command: { type: 'hu' } })
  }
  if (state.wall.length === 0) {
    return actions
  }
  for (const tile of anGangChoices(hand.concealed)) {
    actions.push({
      id: `an-${tile.id}`,
      label: `杠 ${tileLabel(tile.kind)}`,
      command: { type: 'anGang', tileId: tile.id },
    })
  }
  for (const tile of onePerFace(listBuGangTiles(hand.melds, hand.concealed))) {
    actions.push({
      id: `bu-${tile.id}`,
      label: `补杠 ${tileLabel(tile.kind)}`,
      command: { type: 'buGang', tileId: tile.id },
    })
  }
  return actions
}

function claimActions(state: RoundState, seat: PlayerIndex, tile: Tile, discarder: PlayerIndex): LegalAction[] {
  const hand = state.players[seat]
  const actions: LegalAction[] = []
  if (canHu(hand.concealed, tile, hand.melds) !== null) {
    actions.push({ id: 'hu', label: '胡', command: { type: 'hu' } })
  }
  if (state.wall.length > 0 && canMingGang(hand.concealed, tile, seat, discarder)) {
    actions.push({
      id: 'ming',
      label: `杠 ${tileLabel(tile.kind)}`,
      command: { type: 'mingGang' },
    })
  }
  if (canPeng(hand.concealed, tile, seat, discarder)) {
    actions.push({ id: 'peng', label: '碰', command: { type: 'peng' } })
  }
  for (const option of listChiOptions(hand.concealed, tile, seat, discarder)) {
      const first = option.handTiles[0]
      const second = option.handTiles[1]
      const tileIds: readonly [number, number] = [first.id, second.id]
      actions.push({
        id: `chi-${first.id}-${second.id}`,
        label: chiLabel(option),
        command: { type: 'chi', tileIds },
      })
  }
  if (actions.length > 0) {
    actions.push({ id: 'pass', label: '过', command: { type: 'pass' } })
  }
  return actions
}

function qiangActions(state: RoundState, seat: PlayerIndex, tile: Tile): LegalAction[] {
  const hand = state.players[seat]
  if (canHu(hand.concealed, tile, hand.melds) === null) {
    return []
  }
  return [
    { id: 'hu', label: '胡', command: { type: 'hu' } },
    { id: 'pass', label: '过', command: { type: 'pass' } },
  ]
}

function anGangChoices(hand: readonly Tile[]): Tile[] {
  const groups = new Map<string, Tile[]>()
  for (const tile of hand) {
    const key = faceKey(tile.kind)
    const list = groups.get(key)
    if (list === undefined) {
      groups.set(key, [tile])
    } else {
      list.push(tile)
    }
  }
  const result: Tile[] = []
  for (const list of groups.values()) {
    const first = list[0]
    if (list.length >= 4 && first !== undefined) {
      result.push(first)
    }
  }
  return result
}

function onePerFace(tiles: readonly Tile[]): Tile[] {
  const seen = new Set<string>()
  const result: Tile[] = []
  for (const tile of tiles) {
    const key = faceKey(tile.kind)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(tile)
  }
  return result
}

function chiLabel(option: ChiOption): string {
  const tile = option.handTiles[0]
  if (tile.kind.category !== 'number') {
    return '吃'
  }
  const ranks = option.ranks.map((rank) => RANK_TEXT[rank] ?? '').join('')
  return `吃${ranks}${SUIT_TEXT[tile.kind.suit]}`
}

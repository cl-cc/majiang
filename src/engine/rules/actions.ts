import { isSameFace } from '../tile/types'
import type { NumberSuit, Tile } from '../tile/types'
import type { PlayerIndex } from '../tile/deal'
import { countOfFace } from './face'
import type { Meld } from './meld'
import { isNextPlayer } from './seats'

export interface ChiOption {
  /** 顺子的点数，从小到大。 */
  readonly ranks: readonly [number, number, number]
  /** 从手里拿出的两张牌，按点数从小到大。 */
  readonly handTiles: readonly [Tile, Tile]
}

/** 只能吃上家打出的数牌，并且手里能配成顺子。 */
export function canChi(
  hand: readonly Tile[],
  tile: Tile,
  player: PlayerIndex,
  discarder: PlayerIndex,
): boolean {
  return listChiOptions(hand, tile, player, discarder).length > 0
}

export function listChiOptions(
  hand: readonly Tile[],
  tile: Tile,
  player: PlayerIndex,
  discarder: PlayerIndex,
): readonly ChiOption[] {
  if (!isNextPlayer(discarder, player) || tile.kind.category !== 'number') {
    return []
  }

  const suit = tile.kind.suit
  const rank = tile.kind.rank
  const patterns: Array<readonly [number, number, number]> = []
  if (rank >= 3) {
    patterns.push([rank - 2, rank - 1, rank])
  }
  if (rank >= 2 && rank <= 8) {
    patterns.push([rank - 1, rank, rank + 1])
  }
  if (rank <= 7) {
    patterns.push([rank, rank + 1, rank + 2])
  }

  const options: ChiOption[] = []
  for (const pattern of patterns) {
    const needed = pattern.filter((value) => value !== rank)
    const low = needed[0]
    const high = needed[1]
    if (low === undefined || high === undefined) {
      continue
    }
    const first = findNumberTile(hand, suit, low)
    const second = findNumberTile(hand, suit, high, first?.id)
    if (
      first === undefined ||
      second === undefined ||
      first.kind.category !== 'number' ||
      second.kind.category !== 'number'
    ) {
      continue
    }
    const handTiles: readonly [Tile, Tile] = first.kind.rank <= second.kind.rank
      ? [first, second]
      : [second, first]
    options.push({ ranks: pattern, handTiles })
  }

  return options
}

/** 两张手牌和打出的牌是否能组成顺子。座位要另外判断。 */
export function chiHandTiles(
  hand: readonly Tile[],
  claimed: Tile,
  tileIds: readonly [number, number],
): readonly [Tile, Tile] | null {
  if (claimed.kind.category !== 'number' || tileIds[0] === tileIds[1]) {
    return null
  }
  const first = hand.find((tile) => tile.id === tileIds[0])
  const second = hand.find((tile) => tile.id === tileIds[1])
  if (first === undefined || second === undefined) {
    return null
  }
  if (first.kind.category !== 'number' || second.kind.category !== 'number') {
    return null
  }
  if (first.kind.suit !== claimed.kind.suit || second.kind.suit !== claimed.kind.suit) {
    return null
  }
  const ranks = [first.kind.rank, second.kind.rank, claimed.kind.rank].sort((left, right) => left - right)
  const low = ranks[0]
  const middle = ranks[1]
  const high = ranks[2]
  if (low === undefined || middle === undefined || high === undefined) {
    return null
  }
  if (middle !== low + 1 || high !== middle + 1) {
    return null
  }
  return [first, second]
}

/** 手里有两张相同的牌，才能碰别人打出的牌。 */
export function canPeng(
  hand: readonly Tile[],
  tile: Tile,
  player: PlayerIndex,
  discarder: PlayerIndex,
): boolean {
  return player !== discarder && countOfFace(hand, tile.kind) >= 2
}

/** 手里有三张相同的牌，才能明杠别人打出的牌。 */
export function canMingGang(
  hand: readonly Tile[],
  tile: Tile,
  player: PlayerIndex,
  discarder: PlayerIndex,
): boolean {
  return player !== discarder && countOfFace(hand, tile.kind) >= 3
}

/** 自己手里有四张相同的牌，才能暗杠。 */
export function canAnGang(hand: readonly Tile[]): boolean {
  const counts = new Map<string, number>()
  for (const tile of hand) {
    const key = faceKeyOf(tile)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  for (const count of counts.values()) {
    if (count === 4) {
      return true
    }
  }
  return false
}

/** 已经碰过，手里又有第四张，才能补杠。 */
export function canBuGang(melds: readonly Meld[], hand: readonly Tile[]): boolean {
  return listBuGangTiles(melds, hand).length > 0
}

export function listBuGangTiles(melds: readonly Meld[], hand: readonly Tile[]): readonly Tile[] {
  const tiles: Tile[] = []
  for (const meld of melds) {
    if (meld.type !== 'peng') {
      continue
    }
    const face = meld.tiles[0].kind
    for (const tile of hand) {
      if (isSameFace(tile.kind, face)) {
        tiles.push(tile)
      }
    }
  }
  return tiles
}

function findNumberTile(
  hand: readonly Tile[],
  suit: NumberSuit,
  rank: number,
  exceptId?: number,
): Tile | undefined {
  return hand.find((tile) => {
    if (tile.id === exceptId || tile.kind.category !== 'number') {
      return false
    }
    return tile.kind.suit === suit && tile.kind.rank === rank
  })
}

function faceKeyOf(tile: Tile): string {
  switch (tile.kind.category) {
    case 'number':
      return `${tile.kind.suit}:${tile.kind.rank}`
    case 'wind':
      return tile.kind.wind
    case 'dragon':
      return tile.kind.dragon
  }
}

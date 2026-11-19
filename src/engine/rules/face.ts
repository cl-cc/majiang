import { DRAGONS, FACE_COUNT, NUMBER_SUITS, WINDS } from '../tile/types'
import type { Tile, TileKind } from '../tile/types'

/** 34 种牌面的固定下标：万、条、筒、东南西北、中发白。 */
export function faceIndex(kind: TileKind): number {
  switch (kind.category) {
    case 'number':
      return NUMBER_SUITS.indexOf(kind.suit) * 9 + (kind.rank - 1)
    case 'wind':
      return 27 + WINDS.indexOf(kind.wind)
    case 'dragon':
      return 31 + DRAGONS.indexOf(kind.dragon)
  }
}

export function faceCounts(tiles: readonly Tile[]): number[] {
  const counts = Array.from({ length: FACE_COUNT }, () => 0)
  const seen = new Set<number>()

  for (const tile of tiles) {
    if (seen.has(tile.id)) {
      throw new Error(`手牌里有重复的牌：${tile.id}`)
    }
    seen.add(tile.id)
    const index = faceIndex(tile.kind)
    const current = counts[index]
    if (current === undefined) {
      throw new Error('牌面下标错误')
    }
    counts[index] = current + 1
  }

  return counts
}

export function addFace(counts: number[], kind: TileKind): void {
  const index = faceIndex(kind)
  const current = counts[index]
  if (current === undefined) {
    throw new Error('牌面下标错误')
  }
  counts[index] = current + 1
}

export function countOfFace(tiles: readonly Tile[], kind: TileKind): number {
  return tiles.filter((tile) => faceIndex(tile.kind) === faceIndex(kind)).length
}

/** 数牌才能成顺。返回花色内的 0 到 8，字牌返回 null。 */
export function numberRankIndex(kind: TileKind): { readonly suitGroup: number; readonly rank: number } | null {
  if (kind.category !== 'number') {
    return null
  }
  return {
    suitGroup: NUMBER_SUITS.indexOf(kind.suit),
    rank: kind.rank - 1,
  }
}

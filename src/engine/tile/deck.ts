import {
  COPIES_PER_FACE,
  DRAGONS,
  FACE_COUNT,
  NUMBER_SUITS,
  RANKS,
  TILE_COUNT,
  WINDS,
} from './types'
import type { Tile, TileKind } from './types'

function createFaces(): readonly TileKind[] {
  const faces: TileKind[] = []

  for (const suit of NUMBER_SUITS) {
    for (const rank of RANKS) {
      faces.push(Object.freeze({ category: 'number', suit, rank }))
    }
  }

  for (const wind of WINDS) {
    faces.push(Object.freeze({ category: 'wind', wind }))
  }

  for (const dragon of DRAGONS) {
    faces.push(Object.freeze({ category: 'dragon', dragon }))
  }

  return faces
}

/**
 * 生成一副新的 136 张牌。
 * 每次调用都是独立的一副牌，牌面顺序固定为万、条、筒、东南西北、中发白。
 * 洗牌之前不要把这个顺序当作牌墙。
 */
export function createDeck(): readonly Tile[] {
  const faces = createFaces()
  if (faces.length !== FACE_COUNT) {
    throw new Error(`牌面数量错误：期望 ${FACE_COUNT} 种，实际 ${faces.length} 种`)
  }

  const tiles: Tile[] = []
  let id = 0

  for (const kind of faces) {
    for (let copy = 0; copy < COPIES_PER_FACE; copy += 1) {
      tiles.push(Object.freeze({ id, kind }))
      id += 1
    }
  }

  if (tiles.length !== TILE_COUNT) {
    throw new Error(`牌组数量错误：期望 ${TILE_COUNT} 张，实际 ${tiles.length} 张`)
  }

  return Object.freeze(tiles)
}

/** 数牌花色。不含花牌。 */
export const NUMBER_SUITS = ['wan', 'tiao', 'tong'] as const
export type NumberSuit = (typeof NUMBER_SUITS)[number]

/** 风牌，顺序为东南西北。 */
export const WINDS = ['east', 'south', 'west', 'north'] as const
export type Wind = (typeof WINDS)[number]

/** 箭牌，顺序为中发白。 */
export const DRAGONS = ['zhong', 'fa', 'bai'] as const
export type Dragon = (typeof DRAGONS)[number]

export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export type Rank = (typeof RANKS)[number]

/** 每种牌面 4 张。 */
export const COPIES_PER_FACE = 4

/** 34 种牌面：万条筒各 9 种，风牌 4 种，箭牌 3 种。 */
export const FACE_COUNT = NUMBER_SUITS.length * RANKS.length + WINDS.length + DRAGONS.length

/** 标准麻将 136 张，不含花牌。 */
export const TILE_COUNT = FACE_COUNT * COPIES_PER_FACE

export interface NumberTileKind {
  readonly category: 'number'
  readonly suit: NumberSuit
  readonly rank: Rank
}

export interface WindTileKind {
  readonly category: 'wind'
  readonly wind: Wind
}

export interface DragonTileKind {
  readonly category: 'dragon'
  readonly dragon: Dragon
}

/** 牌面。四张相同的实体牌共用同一种牌面。 */
export type TileKind = NumberTileKind | WindTileKind | DragonTileKind

/**
 * 一张实体牌。
 * `id` 只在同一副牌里唯一，不能用来判断牌面是否相同。
 */
export interface Tile {
  readonly id: number
  readonly kind: TileKind
}

const NUMBER_SUIT_LABEL: Record<NumberSuit, string> = {
  wan: '万',
  tiao: '条',
  tong: '筒',
}

const RANK_LABEL: Record<Rank, string> = {
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
  7: '七',
  8: '八',
  9: '九',
}

const WIND_LABEL: Record<Wind, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
}

const DRAGON_LABEL: Record<Dragon, string> = {
  zhong: '中',
  fa: '发',
  bai: '白',
}

/** 给玩家看的牌名，例如「一万」「东」「中」。 */
export function tileLabel(kind: TileKind): string {
  switch (kind.category) {
    case 'number':
      return `${RANK_LABEL[kind.rank]}${NUMBER_SUIT_LABEL[kind.suit]}`
    case 'wind':
      return WIND_LABEL[kind.wind]
    case 'dragon':
      return DRAGON_LABEL[kind.dragon]
  }
}

/** 牌面标识。相同牌面得到相同字符串，与第几张副本无关。 */
export function faceKey(kind: TileKind): string {
  switch (kind.category) {
    case 'number':
      return `number:${kind.suit}:${kind.rank}`
    case 'wind':
      return `wind:${kind.wind}`
    case 'dragon':
      return `dragon:${kind.dragon}`
  }
}

export function isSameFace(left: TileKind, right: TileKind): boolean {
  return faceKey(left) === faceKey(right)
}

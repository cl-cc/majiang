import type { Meld, Tile, TileKind } from '../engine'
import type { MeldFace, TileFace, TileSuit, WinningHandView } from './types'

const RANK_TEXT = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const

const SUIT_TEXT = {
  wan: '万',
  tiao: '条',
  tong: '筒',
} as const

const WIND_TEXT = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
} as const

export function presentTile(tile: Tile, drawn = false): TileFace {
  return { ...faceOf(tile.kind), id: tile.id, drawn }
}

export function meldLabel(type: Meld['type']): string {
  switch (type) {
    case 'chi':
      return '吃'
    case 'peng':
      return '碰'
    case 'mingGang':
      return '明杠'
    case 'anGang':
      return '暗杠'
    case 'buGang':
      return '补杠'
  }
}

export function presentMeld(meld: Meld, owner: boolean): MeldFace {
  if (meld.type === 'anGang' && !owner) {
    return { hidden: true, label: '暗杠', count: meld.tiles.length }
  }
  return {
    hidden: false,
    label: meldLabel(meld.type),
    tiles: meld.tiles.map((tile) => presentTile(tile)),
  }
}

export function presentWinningHand(
  name: string,
  concealed: readonly Tile[],
  melds: readonly Meld[],
  winningTile: Tile,
): WinningHandView {
  const held = concealed.some((tile) => tile.id === winningTile.id)
  const tiles = held ? sortHand(concealed, winningTile.id) : [...sortHand(concealed, null), winningTile]
  return {
    name,
    tiles: tiles.map((tile) => presentTile(tile, tile.id === winningTile.id)),
    melds: melds.map((meld) => presentMeld(meld, true)),
  }
}

export function sortHand(tiles: readonly Tile[], drawnId: number | null): Tile[] {
  const rest = tiles.filter((tile) => tile.id !== drawnId)
  rest.sort((left, right) => kindOrder(left.kind) - kindOrder(right.kind) || left.id - right.id)
  if (drawnId === null) {
    return rest
  }
  const drawn = tiles.find((tile) => tile.id === drawnId)
  return drawn === undefined ? rest : [...rest, drawn]
}

export function formatScore(value: number): string {
  if (value > 0) {
    return `+${value}`
  }
  return String(value)
}

function faceOf(kind: TileKind): { readonly primary: string; readonly secondary: string; readonly suit: TileSuit } {
  switch (kind.category) {
    case 'number':
      return {
        primary: RANK_TEXT[kind.rank] ?? '',
        secondary: SUIT_TEXT[kind.suit],
        suit: kind.suit,
      }
    case 'wind':
      return { primary: WIND_TEXT[kind.wind], secondary: '', suit: 'wind' }
    case 'dragon':
      if (kind.dragon === 'zhong') {
        return { primary: '中', secondary: '', suit: 'zhong' }
      }
      if (kind.dragon === 'fa') {
        return { primary: '发', secondary: '', suit: 'fa' }
      }
      return { primary: '白', secondary: '', suit: 'bai' }
  }
}

function kindOrder(kind: TileKind): number {
  switch (kind.category) {
    case 'number': {
      const suit = kind.suit === 'wan' ? 0 : kind.suit === 'tiao' ? 1 : 2
      return suit * 9 + kind.rank
    }
    case 'wind':
      return 40 + ['east', 'south', 'west', 'north'].indexOf(kind.wind)
    case 'dragon':
      return 50 + ['zhong', 'fa', 'bai'].indexOf(kind.dragon)
  }
}

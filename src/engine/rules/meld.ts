import { isSameFace } from '../tile/types'
import type { Tile, TileKind } from '../tile/types'
import type { PlayerIndex } from '../tile/deal'
import { numberRankIndex } from './face'

export interface ChiMeld {
  readonly type: 'chi'
  readonly tiles: readonly [Tile, Tile, Tile]
  readonly from: PlayerIndex
  readonly claimed: Tile
}

export interface PengMeld {
  readonly type: 'peng'
  readonly tiles: readonly [Tile, Tile, Tile]
  readonly from: PlayerIndex
  readonly claimed: Tile
}

export interface MingGangMeld {
  readonly type: 'mingGang'
  readonly tiles: readonly [Tile, Tile, Tile, Tile]
  readonly from: PlayerIndex
  readonly claimed: Tile
}

export interface AnGangMeld {
  readonly type: 'anGang'
  readonly tiles: readonly [Tile, Tile, Tile, Tile]
}

export interface BuGangMeld {
  readonly type: 'buGang'
  readonly tiles: readonly [Tile, Tile, Tile, Tile]
  readonly from: PlayerIndex
  /** 当初碰来的那张牌。 */
  readonly claimed: Tile
  /** 后来补上的第四张。抢杠成功时要把这张从杠里拿出去。 */
  readonly added: Tile
}

export type Meld = ChiMeld | PengMeld | MingGangMeld | AnGangMeld | BuGangMeld

export function isGang(meld: Meld): meld is MingGangMeld | AnGangMeld | BuGangMeld {
  return meld.type === 'mingGang' || meld.type === 'anGang' || meld.type === 'buGang'
}

/** 没有吃、碰、明杠、补杠。暗杠仍然算门清。 */
export function isMenqing(melds: readonly Meld[]): boolean {
  return melds.every((meld) => meld.type === 'anGang')
}

export function gangCount(melds: readonly Meld[]): number {
  return melds.filter(isGang).length
}

export function isPungMeld(meld: Meld): boolean {
  return meld.type === 'peng' || isGang(meld)
}

export function meldFace(meld: PengMeld | MingGangMeld | AnGangMeld | BuGangMeld): TileKind {
  return meld.tiles[0].kind
}

export function assertValidMeld(meld: Meld): void {
  const ids = new Set(meld.tiles.map((tile) => tile.id))
  if (ids.size !== meld.tiles.length) {
    throw new Error('公开牌组里有重复的牌')
  }

  switch (meld.type) {
    case 'chi':
      assertChow(meld.tiles)
      if (!meld.tiles.some((tile) => tile.id === meld.claimed.id)) {
        throw new Error('吃进来的牌不在顺子里')
      }
      return
    case 'peng':
      assertSameFace(meld.tiles, 3)
      if (!meld.tiles.some((tile) => tile.id === meld.claimed.id)) {
        throw new Error('碰进来的牌不在刻子里')
      }
      return
    case 'mingGang':
      assertSameFace(meld.tiles, 4)
      if (!meld.tiles.some((tile) => tile.id === meld.claimed.id)) {
        throw new Error('明杠的牌不在杠子里')
      }
      return
    case 'anGang':
      assertSameFace(meld.tiles, 4)
      return
    case 'buGang':
      assertSameFace(meld.tiles, 4)
      if (!isSameFace(meld.added.kind, meld.tiles[0].kind)) {
        throw new Error('补杠的牌和碰牌不是同一种')
      }
      if (!meld.tiles.some((tile) => tile.id === meld.added.id)) {
        throw new Error('补杠的第四张不在杠子里')
      }
      if (!meld.tiles.some((tile) => tile.id === meld.claimed.id)) {
        throw new Error('补杠里缺少原来碰来的牌')
      }
      return
  }
}

function assertSameFace(tiles: readonly Tile[], count: number): void {
  if (tiles.length !== count) {
    throw new Error('公开牌组张数不正确')
  }
  const first = tiles[0]
  if (first === undefined || !tiles.every((tile) => isSameFace(tile.kind, first.kind))) {
    throw new Error('刻子或杠子必须是同一种牌')
  }
}

function assertChow(tiles: readonly [Tile, Tile, Tile]): void {
  const indexed = tiles.map((tile) => {
    const rank = numberRankIndex(tile.kind)
    if (rank === null) {
      throw new Error('字牌不能成顺')
    }
    return rank
  })
  const first = indexed[0]
  const second = indexed[1]
  const third = indexed[2]
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error('顺子不完整')
  }
  if (first.suitGroup !== second.suitGroup || first.suitGroup !== third.suitGroup) {
    throw new Error('顺子必须是同一种花色')
  }
  const ranks = [first.rank, second.rank, third.rank].sort((left, right) => left - right)
  if (ranks[1] !== ranks[0]! + 1 || ranks[2] !== ranks[1]! + 1) {
    throw new Error('顺子必须是连续的三张牌')
  }
}

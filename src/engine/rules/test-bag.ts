import { createDeck } from '../tile/deck'
import { tileLabel } from '../tile/types'
import type { Tile } from '../tile/types'

export function createBag() {
  let tiles = [...createDeck()]

  return {
    take(label: string, count = 1): Tile[] {
      const picked: Tile[] = []
      const rest: Tile[] = []
      for (const tile of tiles) {
        if (picked.length < count && tileLabel(tile.kind) === label) {
          picked.push(tile)
        } else {
          rest.push(tile)
        }
      }
      if (picked.length !== count) {
        throw new Error(`牌不够：${label}，需要 ${count} 张，只找到 ${picked.length} 张`)
      }
      tiles = rest
      return picked
    },
  }
}

export function takeAll(
  bag: ReturnType<typeof createBag>,
  groups: readonly (readonly [string, number])[],
): Tile[] {
  return groups.flatMap(([label, count]) => bag.take(label, count))
}

export function ids(tiles: readonly { readonly id: number }[]): number[] {
  return tiles.map((tile) => tile.id)
}

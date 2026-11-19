import type { Tile } from '../engine'
import { faceIndex } from '../engine/rules/face'
import { calculateShanten } from './handAnalyzer'
import type { AIView } from './types'
import { visibleFaceCounts } from './view'

/**
 * 从手里选一张打出。
 * 先让向听数下降，再保留对子、搭子和还能进张的牌，孤张字牌和边张优先打掉。
 */
export function chooseDiscard(view: AIView): Tile {
  if (view.concealed.length === 0) throw new Error('没有可以打出的牌')
  const counts = faceCountsOf(view.concealed)
  const visible = visibleFaceCounts(view)
  let best: Tile | null = null
  let bestScore: Score | null = null
  const seen = new Set<number>()

  for (const tile of view.concealed) {
    const index = faceIndex(tile.kind)
    if (seen.has(index)) continue
    seen.add(index)
    const without = view.concealed.filter((item) => item.id !== tile.id)
    const score: Score = {
      shanten: calculateShanten(without, view.melds),
      flexibility: flexibility(faceCountsOf(without), visible),
      role: discardRole(index, counts),
      face: index,
    }
    if (best === null || bestScore === null || better(score, bestScore)) {
      best = tile
      bestScore = score
    }
  }

  if (best === null || !view.concealed.some((tile) => tile.id === best?.id)) {
    throw new Error('没有可以打出的牌')
  }
  return best
}

interface Score {
  readonly shanten: number
  readonly flexibility: number
  readonly role: number
  readonly face: number
}

function better(candidate: Score, current: Score): boolean {
  if (candidate.shanten !== current.shanten) return candidate.shanten < current.shanten
  if (candidate.flexibility !== current.flexibility) return candidate.flexibility > current.flexibility
  if (candidate.role !== current.role) return candidate.role > current.role
  return candidate.face > current.face
}

function faceCountsOf(tiles: readonly Tile[]): number[] {
  const counts = Array.from({ length: 34 }, () => 0)
  for (const tile of tiles) {
    const index = faceIndex(tile.kind)
    counts[index] = (counts[index] ?? 0) + 1
  }
  return counts
}

/** 越大越适合打出。完整的顺子、刻子最低，孤张字牌最高。 */
function discardRole(index: number, counts: readonly number[]): number {
  const count = counts[index] ?? 0
  if (count >= 3 || inChow(index, counts)) return 0
  if (count === 2) return 1
  if (inTaatsu(index, counts)) return 2
  if (index >= 27) return 6
  const rank = index % 9
  if (rank === 0 || rank === 8) return 5
  if (rank === 1 || rank === 7) return 4
  return 3
}

function inChow(index: number, counts: readonly number[]): boolean {
  if (index >= 27) return false
  const rank = index % 9
  const base = index - rank
  const start = Math.max(base, index - 2)
  const end = Math.min(base + 6, index)
  for (let cursor = start; cursor <= end; cursor += 1) {
    if ((counts[cursor] ?? 0) >= 1 && (counts[cursor + 1] ?? 0) >= 1 && (counts[cursor + 2] ?? 0) >= 1) {
      return true
    }
  }
  return false
}

function inTaatsu(index: number, counts: readonly number[]): boolean {
  if (index >= 27) return false
  const rank = index % 9
  const base = index - rank
  const has = (face: number): boolean => face >= base && face < base + 9 && (counts[face] ?? 0) >= 1
  if (rank > 0 && has(index - 1)) return true
  if (rank < 8 && has(index + 1)) return true
  if (rank > 1 && has(index - 2)) return true
  if (rank < 7 && has(index + 2)) return true
  return false
}

function flexibility(counts: readonly number[], visible: readonly number[]): number {
  let score = 0
  const remain = (index: number): number => Math.max(0, 4 - (visible[index] ?? 0))
  for (let index = 0; index < counts.length; index += 1) {
    const count = counts[index] ?? 0
    if (count >= 2) score += remain(index) * 3
    if (index >= 27 || count === 0) continue
    const rank = index % 9
    if (rank <= 7 && (counts[index + 1] ?? 0) > 0) {
      if (rank === 0) score += remain(index + 2)
      else if (rank === 7) score += remain(index - 1)
      else score += remain(index - 1) + remain(index + 2)
    } else if (rank <= 6 && (counts[index + 2] ?? 0) > 0) {
      score += remain(index + 1)
    }
  }
  return score
}

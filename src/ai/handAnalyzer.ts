import type { Meld, Tile } from '../engine'
import { faceCounts } from '../engine/rules/face'
import type { HandAnalysis, Taatsu } from './types'

interface Pattern {
  readonly melds: number
  readonly taatsu: number
  readonly pair: 0 | 1
}

const suitCache = new Map<string, readonly Pattern[]>()
const shantenCache = new Map<string, number>()

/**
 * 向听数。0 是听牌，-1 是已经胡牌。
 * 标准形、七对、碰碰胡都算，取最小的那个。
 */
export function calculateShanten(concealed: readonly Tile[], melds: readonly Meld[] = []): number {
  const counts = faceCounts(concealed)
  const hasChi = melds.some((meld) => meld.type === 'chi')
  const key = `${counts.join('')}|${melds.length}|${hasChi ? 1 : 0}`
  const cached = shantenCache.get(key)
  if (cached !== undefined) return cached

  const value = Math.min(
    standardShanten(counts, Math.max(0, 4 - melds.length)),
    sevenPairsShanten(counts, melds) ?? Number.POSITIVE_INFINITY,
    pengPengShanten(counts, melds) ?? Number.POSITIVE_INFINITY,
  )
  shantenCache.set(key, value)
  return value
}

/** 拆出手牌里的顺子、刻子、对子、搭子和孤张，并给出向听数。 */
export function analyzeHand(concealed: readonly Tile[], melds: readonly Meld[] = []): HandAnalysis {
  const counts = faceCounts(concealed)
  const blocks = extractBlocks(counts)
  return {
    shanten: calculateShanten(concealed, melds),
    standardShanten: standardShanten(counts, Math.max(0, 4 - melds.length)),
    sevenPairsShanten: sevenPairsShanten(counts, melds),
    pengPengShanten: pengPengShanten(counts, melds),
    chows: blocks.chows,
    pungs: blocks.pungs,
    pairs: blocks.pairs,
    taatsu: blocks.taatsu,
    isolated: blocks.isolated,
  }
}

function sevenPairsShanten(counts: readonly number[], melds: readonly Meld[]): number | null {
  if (melds.length > 0) return null
  let pairUnits = 0
  for (const count of counts) pairUnits += Math.floor(count / 2)
  if (pairUnits > 7) pairUnits = 7
  return 6 - pairUnits
}

function pengPengShanten(counts: readonly number[], melds: readonly Meld[]): number | null {
  if (melds.some((meld) => meld.type === 'chi')) return null
  let pungs = melds.length
  let pairs = 0
  for (const count of counts) {
    if (count >= 3) pungs += 1
    if (count === 2 || count === 4) pairs += 1
  }
  if (pungs > 4) pungs = 4
  if (pungs + pairs > 5) pairs = 5 - pungs
  if (pairs < 0) pairs = 0
  return 8 - pungs * 2 - pairs
}

function standardShanten(counts: readonly number[], targetSets: number): number {
  const groups = [
    suitPatterns(counts, 0, 9, true),
    suitPatterns(counts, 9, 9, true),
    suitPatterns(counts, 18, 9, true),
    suitPatterns(counts, 27, 7, false),
  ]
  return combinePatterns(groups, targetSets)
}

function combinePatterns(groups: readonly (readonly Pattern[])[], targetSets: number): number {
  let best = targetSets * 2
  const walk = (groupIndex: number, melds: number, taatsu: number, pair: 0 | 1): void => {
    if (groupIndex === groups.length) {
      const cappedMelds = melds > targetSets ? targetSets : melds
      const slots = targetSets - cappedMelds
      const used = Math.min(taatsu, Math.max(slots, 0))
      const value = slots * 2 - used - pair
      if (value < best) best = value
      return
    }
    const options = groups[groupIndex]
    if (options === undefined) return
    for (const option of options) {
      if (pair === 1 && option.pair === 1) {
        walk(groupIndex + 1, melds + option.melds, taatsu + option.taatsu + 1, 1)
      } else {
        const nextPair: 0 | 1 = pair === 1 || option.pair === 1 ? 1 : 0
        walk(groupIndex + 1, melds + option.melds, taatsu + option.taatsu, nextPair)
      }
    }
  }
  walk(0, 0, 0, 0)
  return best
}

function suitPatterns(
  source: readonly number[],
  offset: number,
  length: number,
  allowChow: boolean,
): readonly Pattern[] {
  let key = allowChow ? 'c' : 'h'
  for (let index = 0; index < length; index += 1) key += source[offset + index] ?? 0
  const cached = suitCache.get(key)
  if (cached !== undefined) return cached

  const counts = source.slice(offset, offset + length)
  const found: Pattern[] = []
  const seen = new Set<string>()
  const visiting = new Set<string>()
  let steps = 0

  const record = (melds: number, taatsu: number, pair: 0 | 1): void => {
    const cappedMelds = Math.min(melds, 4)
    const cappedTaatsu = Math.min(taatsu, Math.max(0, 4 - cappedMelds))
    const id = `${cappedMelds},${cappedTaatsu},${pair}`
    if (seen.has(id)) return
    seen.add(id)
    found.push({ melds: cappedMelds, taatsu: cappedTaatsu, pair })
  }

  const visit = (index: number, melds: number, taatsu: number, pair: 0 | 1): void => {
    steps += 1
    if (steps > 200000) throw new Error('顺子拆分过多')
    while (index < length && counts[index] === 0) index += 1
    const state = `${index},${melds},${taatsu},${pair},${counts.join('')}`
    if (visiting.has(state)) return
    visiting.add(state)

    if (index >= length || melds >= 4) {
      if (melds >= 4 && pair === 0) {
        for (let cursor = index; cursor < length; cursor += 1) {
          if ((counts[cursor] ?? 0) >= 2) {
            record(melds, taatsu, 1)
            return
          }
        }
      }
      record(melds, taatsu, pair)
      return
    }

    const count = counts[index] ?? 0
    visit(index + 1, melds, taatsu, pair)

    if (count >= 3) {
      counts[index] = count - 3
      visit(index, melds + 1, taatsu, pair)
      counts[index] = count
    }
    if (count >= 2 && pair === 0) {
      counts[index] = count - 2
      visit(index, melds, taatsu, 1)
      counts[index] = count
    }
    if (count >= 2 && melds + taatsu < 4) {
      counts[index] = count - 2
      visit(index, melds, taatsu + 1, pair)
      counts[index] = count
    }
    if (!allowChow || count < 1) return

    const rank = index % 9
    if (rank <= 7 && index + 1 < length && (counts[index + 1] ?? 0) >= 1 && melds + taatsu < 4) {
      const next = counts[index + 1] ?? 0
      counts[index] = count - 1
      counts[index + 1] = next - 1
      visit(index, melds, taatsu + 1, pair)
      counts[index] = count
      counts[index + 1] = next
    }
    if (rank <= 6 && index + 2 < length && (counts[index + 2] ?? 0) >= 1) {
      const gap = counts[index + 2] ?? 0
      if (melds + taatsu < 4) {
        counts[index] = count - 1
        counts[index + 2] = gap - 1
        visit(index, melds, taatsu + 1, pair)
        counts[index] = count
        counts[index + 2] = gap
      }
      const middle = counts[index + 1] ?? 0
      if (middle >= 1) {
        counts[index] = count - 1
        counts[index + 1] = middle - 1
        counts[index + 2] = gap - 1
        visit(index, melds + 1, taatsu, pair)
        counts[index] = count
        counts[index + 1] = middle
        counts[index + 2] = gap
      }
    }
  }

  visit(0, 0, 0, 0)
  const patterns = pareto(found.length > 0 ? found : [{ melds: 0, taatsu: 0, pair: 0 }])
  suitCache.set(key, patterns)
  return patterns
}

function pareto(patterns: readonly Pattern[]): readonly Pattern[] {
  return patterns.filter((pattern) => !patterns.some((other) => (
    other !== pattern
    && other.pair === pattern.pair
    && other.melds >= pattern.melds
    && other.taatsu >= pattern.taatsu
    && (other.melds > pattern.melds || other.taatsu > pattern.taatsu)
  )))
}

function extractBlocks(counts: readonly number[]): Pick<HandAnalysis, 'chows' | 'pungs' | 'pairs' | 'taatsu' | 'isolated'> {
  const working = counts.slice()
  const pungs: number[] = []
  const pairs: number[] = []
  for (let index = 0; index < working.length; index += 1) {
    const count = working[index] ?? 0
    if (count >= 3) {
      pungs.push(index)
      working[index] = count - 3
    } else if (count === 2) {
      pairs.push(index)
      working[index] = 0
    }
  }

  const chows: number[] = []
  for (let index = 0; index <= 24; index += 1) {
    if (index % 9 > 6) continue
    while ((working[index] ?? 0) > 0 && (working[index + 1] ?? 0) > 0 && (working[index + 2] ?? 0) > 0) {
      chows.push(index)
      working[index] = (working[index] ?? 0) - 1
      working[index + 1] = (working[index + 1] ?? 0) - 1
      working[index + 2] = (working[index + 2] ?? 0) - 1
    }
  }

  const taatsu: Taatsu[] = []
  for (let index = 0; index <= 25; index += 1) {
    if (index >= 27 || index % 9 > 7) continue
    if ((working[index] ?? 0) > 0 && (working[index + 1] ?? 0) > 0) {
      const kind = index % 9 === 0 || index % 9 === 7 ? 'penchan' : 'ryanmen'
      taatsu.push({ kind, faces: [index, index + 1] })
      working[index] = (working[index] ?? 0) - 1
      working[index + 1] = (working[index + 1] ?? 0) - 1
    }
  }
  for (let index = 0; index <= 24; index += 1) {
    if (index >= 27 || index % 9 > 6) continue
    if ((working[index] ?? 0) > 0 && (working[index + 2] ?? 0) > 0) {
      taatsu.push({ kind: 'kanchan', faces: [index, index + 2] })
      working[index] = (working[index] ?? 0) - 1
      working[index + 2] = (working[index + 2] ?? 0) - 1
    }
  }

  const isolated: number[] = []
  for (let index = 0; index < working.length; index += 1) {
    const count = working[index] ?? 0
    for (let copy = 0; copy < count; copy += 1) isolated.push(index)
  }
  return { chows, pungs, pairs, taatsu, isolated }
}

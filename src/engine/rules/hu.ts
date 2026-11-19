import type { Tile } from '../tile/types'
import { addFace, faceCounts } from './face'
import { assertValidMeld, gangCount, isPungMeld } from './meld'
import type { Meld } from './meld'

export type WinPattern = 'standard' | 'sevenPairs' | 'pengPeng'

export interface HuResult {
  /** 计分用的牌型。七对优先，其次碰碰胡，否则是平胡。 */
  readonly pattern: WinPattern
  readonly standard: boolean
  readonly sevenPairs: boolean
  readonly pengPeng: boolean
}

/**
 * 统一胡牌判断。
 * 不会改动手牌。候选牌已经在手里时，按自摸这手牌判断；否则把候选牌加进一份副本。
 * 公开的吃、碰、杠各算一组。七对必须没有公开牌组，手里正好七对。
 */
export function canHu(
  concealed: readonly Tile[],
  tile: Tile,
  melds: readonly Meld[] = [],
): HuResult | null {
  for (const meld of melds) {
    assertValidMeld(meld)
  }

  const counts = faceCounts(concealed)
  const tileAlreadyInHand = concealed.some((item) => item.id === tile.id)
  if (!tileAlreadyInHand) {
    addFace(counts, tile.kind)
  }

  return judgeCounts(counts, melds)
}

function judgeCounts(counts: number[], melds: readonly Meld[]): HuResult | null {
  const gangs = gangCount(melds)
  const physicalInMelds = melds.reduce((total, meld) => total + meld.tiles.length, 0)
  const physicalInHand = counts.reduce((total, count) => total + count, 0)
  if (physicalInHand + physicalInMelds !== 14 + gangs) {
    return null
  }
  if (melds.length > 4) {
    return null
  }

  const sevenPairs = melds.length === 0 && isSevenPairs(counts)
  const needSets = 4 - melds.length
  const pengPeng = melds.every(isPungMeld) && canPengPeng(counts, needSets)
  const standard = canStandard(counts, needSets) || pengPeng

  if (!standard && !sevenPairs) {
    return null
  }

  const pattern: WinPattern = sevenPairs ? 'sevenPairs' : pengPeng ? 'pengPeng' : 'standard'
  return {
    pattern,
    standard,
    sevenPairs,
    pengPeng,
  }
}

/** 每种牌面 2 张或 4 张，一共凑成 7 对。4 张相同的牌算两对，不算七对以外的牌型加分。 */
function isSevenPairs(counts: readonly number[]): boolean {
  let pairs = 0
  for (const count of counts) {
    if (count === 0) {
      continue
    }
    if (count % 2 !== 0) {
      return false
    }
    pairs += count / 2
  }
  return pairs === 7
}

function canStandard(counts: readonly number[], needSets: number): boolean {
  if (needSets < 0) {
    return false
  }
  const working = counts.slice()
  for (let index = 0; index < working.length; index += 1) {
    const count = working[index]
    if (count === undefined || count < 2) {
      continue
    }
    working[index] = count - 2
    if (canFormSets(working, needSets)) {
      return true
    }
    working[index] = count
  }
  return false
}

function canPengPeng(counts: readonly number[], needSets: number): boolean {
  if (needSets < 0) {
    return false
  }
  const working = counts.slice()
  for (let index = 0; index < working.length; index += 1) {
    const count = working[index]
    if (count === undefined || count < 2) {
      continue
    }
    working[index] = count - 2
    if (canFormPungs(working, needSets)) {
      return true
    }
    working[index] = count
  }
  return false
}

/**
 * 递归把剩余的牌拆成顺子或刻子。
 * 每次处理还没拆完的最小牌面，尝试刻子和顺子，失败就退回。
 */
function canFormSets(counts: number[], needSets: number): boolean {
  if (needSets === 0) {
    return counts.every((count) => count === 0)
  }

  const start = counts.findIndex((count) => count > 0)
  const startCount = counts[start]
  if (start < 0 || startCount === undefined) {
    return false
  }

  if (startCount >= 3) {
    counts[start] = startCount - 3
    if (canFormSets(counts, needSets - 1)) {
      return true
    }
    counts[start] = startCount
  }

  if (startCount >= 1 && canStartChow(counts, start)) {
    changeChow(counts, start, -1)
    if (canFormSets(counts, needSets - 1)) {
      return true
    }
    changeChow(counts, start, 1)
  }

  return false
}

/** 碰碰胡的剩余牌只能拆成刻子，不能拆顺子。 */
function canFormPungs(counts: number[], needSets: number): boolean {
  if (needSets === 0) {
    return counts.every((count) => count === 0)
  }

  const start = counts.findIndex((count) => count > 0)
  const startCount = counts[start]
  if (start < 0 || startCount === undefined || startCount < 3) {
    return false
  }

  counts[start] = startCount - 3
  const formed = canFormPungs(counts, needSets - 1)
  counts[start] = startCount
  return formed
}

function canStartChow(counts: readonly number[], start: number): boolean {
  const next = counts[start + 1]
  const after = counts[start + 2]
  if (next === undefined || after === undefined || next < 1 || after < 1) {
    return false
  }
  if (start >= 27) {
    return false
  }
  const rank = start % 9
  return rank <= 6
}

function changeChow(counts: number[], start: number, direction: -1 | 1): void {
  for (const offset of [0, 1, 2]) {
    const index = start + offset
    const current = counts[index]
    if (current === undefined) {
      throw new Error('顺子下标错误')
    }
    counts[index] = current + direction
  }
}

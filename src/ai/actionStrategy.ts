import type { AnGangMeld, ChiMeld, Meld, MingGangMeld, PengMeld, Response, Tile, TileKind } from '../engine'
import {
  canAnGang,
  canBuGang,
  canHu,
  canMingGang,
  canPeng,
  listBuGangTiles,
  listChiOptions,
} from '../engine'
import { isSameFace } from '../engine'
import { faceIndex } from '../engine/rules/face'
import { calculateShanten } from './handAnalyzer'
import type { AIView } from './types'

export type SelfDecision =
  | { readonly type: 'selfHu' }
  | { readonly type: 'anGang'; readonly tileId: number }
  | { readonly type: 'buGang'; readonly tileId: number }
  | { readonly type: 'discard' }

/**
 * 别人出牌或补杠时，选择胡、杠、碰、吃或过。
 * 能不能做，都交给规则引擎；这里只比较做完以后的向听数。
 */
export function chooseAction(view: AIView): Response {
  if (view.phase.type !== 'response' && view.phase.type !== 'qiangGang') {
    throw new Error('现在没有可以响应的牌')
  }
  const tile = view.phase.tile
  const actor = view.phase.type === 'response' ? view.phase.discarder : view.phase.player
  if (actor === view.seat) {
    throw new Error(view.phase.type === 'qiangGang' ? '不能抢自己的杠' : '不能响应自己打出的牌')
  }
  if (canHu(view.concealed, tile, view.melds) !== null) {
    return { player: view.seat, action: 'hu' }
  }
  if (view.phase.type === 'qiangGang') {
    return { player: view.seat, action: 'pass' }
  }

  const current = calculateShanten(view.concealed, view.melds)
  let best: Claim | null = null

  if (view.wallCount > 0 && canMingGang(view.concealed, tile, view.seat, actor)) {
    const removed = takeFace(view.concealed, tile.kind, 3)
    const gang: MingGangMeld = {
      type: 'mingGang',
      tiles: asFour([...removed.taken, tile]),
      from: actor,
      claimed: tile,
    }
    const shanten = calculateShanten(removed.kept, [...view.melds, gang])
    if (shanten <= current) best = consider(best, { kind: 'gang', shanten })
  }

  if (canPeng(view.concealed, tile, view.seat, actor)) {
    const removed = takeFace(view.concealed, tile.kind, 2)
    const peng: PengMeld = {
      type: 'peng',
      tiles: asThree([...removed.taken, tile]),
      from: actor,
      claimed: tile,
    }
    const shanten = bestDiscardShanten(removed.kept, [...view.melds, peng])
    if (shanten < current) best = consider(best, { kind: 'peng', shanten })
  }

  for (const option of listChiOptions(view.concealed, tile, view.seat, actor)) {
    const ids = new Set([option.handTiles[0].id, option.handTiles[1].id])
    const kept = view.concealed.filter((item) => !ids.has(item.id))
    const chi: ChiMeld = {
      type: 'chi',
      tiles: [option.handTiles[0], option.handTiles[1], tile],
      from: actor,
      claimed: tile,
    }
    const shanten = bestDiscardShanten(kept, [...view.melds, chi])
    if (shanten < current) {
      best = consider(best, {
        kind: 'chi',
        shanten,
        tileIds: [option.handTiles[0].id, option.handTiles[1].id],
      })
    }
  }

  if (best?.kind === 'gang') return { player: view.seat, action: 'gang' }
  if (best?.kind === 'peng') return { player: view.seat, action: 'peng' }
  if (best?.kind === 'chi') return { player: view.seat, action: 'chi', tileIds: best.tileIds }
  return { player: view.seat, action: 'pass' }
}

/** 轮到自己，并且刚摸过牌时，先看胡，再看暗杠和补杠。 */
export function chooseSelfAction(view: AIView): SelfDecision {
  const sample = view.concealed[0]
  if (sample !== undefined && canHu(view.concealed, sample, view.melds) !== null) {
    return { type: 'selfHu' }
  }

  const gang = chooseGang(view)
  if (gang !== null) return gang
  return { type: 'discard' }
}

function chooseGang(view: AIView): SelfDecision | null {
  if (view.wallCount <= 0) return null
  const baseline = bestDiscardShanten(view.concealed, view.melds)
  let best: { readonly shanten: number; readonly decision: SelfDecision } | null = null

  if (canAnGang(view.concealed)) {
    for (const group of groupsOf(view.concealed)) {
      if (group.length !== 4) continue
      const ids = new Set(group.map((tile) => tile.id))
      const kept = view.concealed.filter((tile) => !ids.has(tile.id))
      const gang: AnGangMeld = { type: 'anGang', tiles: asFour(group) }
      const shanten = calculateShanten(kept, [...view.melds, gang])
      const tile = group[0]
      if (tile === undefined || shanten > baseline) continue
      best = preferGang(best, shanten, { type: 'anGang', tileId: tile.id })
    }
  }

  if (canBuGang(view.melds, view.concealed)) {
    for (const tile of listBuGangTiles(view.melds, view.concealed)) {
      const kept = view.concealed.filter((item) => item.id !== tile.id)
      const shanten = calculateShanten(kept, view.melds)
      if (shanten > baseline) continue
      best = preferGang(best, shanten, { type: 'buGang', tileId: tile.id })
    }
  }

  return best?.decision ?? null
}

function preferGang(
  current: { readonly shanten: number; readonly decision: SelfDecision } | null,
  shanten: number,
  decision: SelfDecision,
): { readonly shanten: number; readonly decision: SelfDecision } {
  if (current === null || shanten < current.shanten) return { shanten, decision }
  if (shanten === current.shanten && decision.type === 'anGang' && current.decision.type !== 'anGang') {
    return { shanten, decision }
  }
  return current
}

function bestDiscardShanten(hand: readonly Tile[], melds: readonly Meld[]): number {
  if (hand.length === 0) return calculateShanten(hand, melds)
  let best = Number.POSITIVE_INFINITY
  const seen = new Set<number>()
  for (const tile of hand) {
    const index = faceIndex(tile.kind)
    if (seen.has(index)) continue
    seen.add(index)
    const kept = hand.filter((item) => item.id !== tile.id)
    best = Math.min(best, calculateShanten(kept, melds))
  }
  return best
}

type Claim =
  | { readonly kind: 'gang'; readonly shanten: number }
  | { readonly kind: 'peng'; readonly shanten: number }
  | { readonly kind: 'chi'; readonly shanten: number; readonly tileIds: readonly [number, number] }

function consider(current: Claim | null, candidate: Claim): Claim {
  if (current === null || candidate.shanten < current.shanten) return candidate
  if (candidate.shanten === current.shanten && claimRank(candidate) > claimRank(current)) return candidate
  return current
}

function claimRank(claim: Claim): number {
  if (claim.kind === 'gang') return 3
  if (claim.kind === 'peng') return 2
  return 1
}

function takeFace(
  hand: readonly Tile[],
  kind: TileKind,
  count: number,
): { readonly taken: Tile[]; readonly kept: Tile[] } {
  const taken: Tile[] = []
  const kept: Tile[] = []
  for (const tile of hand) {
    if (taken.length < count && isSameFace(tile.kind, kind)) taken.push(tile)
    else kept.push(tile)
  }
  if (taken.length !== count) throw new Error('手里没有足够的牌')
  return { taken, kept }
}

function groupsOf(hand: readonly Tile[]): Tile[][] {
  const groups: Tile[][] = []
  const seen = new Map<string, Tile[]>()
  for (const tile of hand) {
    const key = faceKey(tile.kind)
    const group = seen.get(key)
    if (group === undefined) {
      const created = [tile]
      seen.set(key, created)
      groups.push(created)
    } else {
      group.push(tile)
    }
  }
  return groups
}

function faceKey(kind: TileKind): string {
  if (kind.category === 'number') return `${kind.suit}${kind.rank}`
  if (kind.category === 'wind') return kind.wind
  return kind.dragon
}

function asThree(tiles: readonly Tile[]): readonly [Tile, Tile, Tile] {
  const first = tiles[0]
  const second = tiles[1]
  const third = tiles[2]
  if (first === undefined || second === undefined || third === undefined || tiles.length < 3) {
    throw new Error('牌组张数不正确')
  }
  return [first, second, third]
}

function asFour(tiles: readonly Tile[]): readonly [Tile, Tile, Tile, Tile] {
  const first = tiles[0]
  const second = tiles[1]
  const third = tiles[2]
  const fourth = tiles[3]
  if (
    first === undefined
    || second === undefined
    || third === undefined
    || fourth === undefined
    || tiles.length < 4
  ) {
    throw new Error('杠牌张数不正确')
  }
  return [first, second, third, fourth]
}

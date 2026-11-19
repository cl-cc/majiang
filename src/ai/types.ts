import type { AnGangMeld, Meld, PlayerIndex, Tile } from '../engine'

/** 别人的暗杠只公开「杠过」，不公开牌面。 */
export interface HiddenGang {
  readonly type: 'anGang'
}

export type PublicMeld = Exclude<Meld, AnGangMeld> | HiddenGang

/**
 * AI 能看到的一桌牌。
 * 只有自己的暗手、公开副露、弃牌、牌墙张数和当前阶段。
 * 没有其他玩家的暗手，也没有牌墙里的牌。
 */
export interface AIView {
  readonly seat: PlayerIndex
  readonly concealed: readonly Tile[]
  readonly melds: readonly Meld[]
  readonly publicMelds: readonly [
    readonly PublicMeld[],
    readonly PublicMeld[],
    readonly PublicMeld[],
    readonly PublicMeld[],
  ]
  readonly discards: readonly Tile[]
  readonly wallCount: number
  readonly current: PlayerIndex
  readonly phase: AIPhase
  readonly token: string
}

export type AIPhase =
  | { readonly type: 'discard'; readonly selfTurn: boolean; readonly from: 'deal' | 'draw' | 'kong' | 'claim' }
  | { readonly type: 'response'; readonly discarder: PlayerIndex; readonly tile: Tile }
  | { readonly type: 'qiangGang'; readonly player: PlayerIndex; readonly tile: Tile }
  | { readonly type: 'draw'; readonly player: PlayerIndex }
  | { readonly type: 'over' }

export interface Taatsu {
  readonly kind: 'ryanmen' | 'penchan' | 'kanchan'
  /** 两张牌的牌面下标，从小到大。 */
  readonly faces: readonly [number, number]
}

export interface HandAnalysis {
  /** 标准、七对、碰碰胡里最小的向听数。听牌是 0，已经胡牌是 -1。 */
  readonly shanten: number
  readonly standardShanten: number
  readonly sevenPairsShanten: number | null
  readonly pengPengShanten: number | null
  /** 顺子起点的牌面下标。 */
  readonly chows: readonly number[]
  readonly pungs: readonly number[]
  readonly pairs: readonly number[]
  readonly taatsu: readonly Taatsu[]
  readonly isolated: readonly number[]
}

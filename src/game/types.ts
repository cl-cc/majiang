import type { PlayerIndex } from '../engine'

export type TileSuit = 'wan' | 'tiao' | 'tong' | 'wind' | 'zhong' | 'fa' | 'bai'

export interface TileFace {
  readonly id: number
  readonly primary: string
  readonly secondary: string
  readonly suit: TileSuit
  readonly drawn: boolean
}

export type MeldFace =
  | { readonly hidden: true; readonly label: string; readonly count: number }
  | { readonly hidden: false; readonly label: string; readonly tiles: readonly TileFace[] }

export type SeatPlace = 'self' | 'right' | 'top' | 'left'

export interface SeatView {
  readonly seat: PlayerIndex
  readonly name: string
  readonly place: SeatPlace
  readonly dealer: boolean
  readonly score: number
  readonly roundScore: number
  readonly concealedCount: number
  readonly hand: readonly TileFace[]
  readonly melds: readonly MeldFace[]
  readonly status: string
}

export interface RiverView {
  readonly name: string
  readonly place: SeatPlace
  readonly tiles: readonly TileFace[]
  readonly pending: TileFace | null
  readonly discarding: boolean
}

export type PlayerCommand =
  | { readonly type: 'discard'; readonly tileId: number }
  | { readonly type: 'pass' }
  | { readonly type: 'hu' }
  | { readonly type: 'peng' }
  | { readonly type: 'mingGang' }
  | { readonly type: 'anGang'; readonly tileId: number }
  | { readonly type: 'buGang'; readonly tileId: number }
  | { readonly type: 'chi'; readonly tileIds: readonly [number, number] }
  | { readonly type: 'nextRound' }

export type ClaimCommand = Exclude<PlayerCommand, { readonly type: 'discard' } | { readonly type: 'nextRound' }>

export interface LegalAction {
  readonly id: string
  readonly label: string
  readonly command: ClaimCommand
}

export interface ScoreRow {
  readonly name: string
  readonly round: number
  readonly total: number
}

export interface WinningHandView {
  readonly name: string
  readonly tiles: readonly TileFace[]
  readonly melds: readonly MeldFace[]
}

export interface SettlementView {
  readonly kind: 'hu' | 'draw'
  readonly title: string
  readonly lines: readonly string[]
  readonly hands: readonly WinningHandView[]
  readonly rows: readonly ScoreRow[]
}

export interface GameSnapshot {
  readonly round: number
  readonly dealerName: string
  readonly wallCount: number
  readonly notice: string
  readonly turnText: string
  readonly seats: readonly SeatView[]
  readonly rivers: readonly RiverView[]
  readonly actions: readonly LegalAction[]
  readonly canDiscard: boolean
  readonly settlement: SettlementView | null
}

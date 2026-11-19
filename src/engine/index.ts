export {
  COPIES_PER_FACE,
  DRAGONS,
  FACE_COUNT,
  NUMBER_SUITS,
  RANKS,
  TILE_COUNT,
  WINDS,
  faceKey,
  isSameFace,
  tileLabel,
} from './tile/types'
export type { Dragon, NumberSuit, Rank, Tile, TileKind, Wind } from './tile/types'

export { createDeck } from './tile/deck'

export { shuffle } from './tile/shuffle'
export type { RandomSource } from './tile/shuffle'

export {
  DEALER_HAND_SIZE,
  DEALT_TILE_COUNT,
  HAND_SIZE,
  PLAYER_COUNT,
  PLAYER_INDEXES,
  WALL_SIZE,
  deal,
  isPlayerIndex,
} from './tile/deal'
export type { DealResult, PlayerIndex } from './tile/deal'

export {
  canAnGang,
  canBuGang,
  canChi,
  canHu,
  canMingGang,
  canPeng,
  chiHandTiles,
  createTable,
  declareAnGang,
  declareBuGang,
  declareSelfWin,
  discardTile,
  drawTile,
  gangCount,
  isGang,
  isMenqing,
  isNextPlayer,
  listBuGangTiles,
  listChiOptions,
  nextPlayer,
  paymentDeltas,
  resolveResponses,
  respond,
  scoreWin,
  seatsAfter,
  startRound,
} from './rules'
export type {
  AnGangMeld,
  BuGangMeld,
  ChiMeld,
  ChiOption,
  Decision,
  HuResult,
  Meld,
  MingGangMeld,
  PengMeld,
  PlayerState,
  Response,
  RoundPhase,
  RoundState,
  WinAward,
  WinMethod,
  WinPattern,
} from './rules'


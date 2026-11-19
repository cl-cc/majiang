import { TILE_COUNT } from './types'
import type { Tile } from './types'

export const PLAYER_COUNT = 4
export const HAND_SIZE = 13
export const DEALER_HAND_SIZE = HAND_SIZE + 1

/** 三轮四张、一轮一张，再给庄家补一张，一共发出 53 张。 */
export const DEALT_TILE_COUNT = HAND_SIZE * PLAYER_COUNT + 1
export const WALL_SIZE = TILE_COUNT - DEALT_TILE_COUNT

const DEAL_ROUNDS = [4, 4, 4, 1] as const

export const PLAYER_INDEXES = [0, 1, 2, 3] as const
export type PlayerIndex = (typeof PLAYER_INDEXES)[number]

export function isPlayerIndex(value: number): value is PlayerIndex {
  return value === 0 || value === 1 || value === 2 || value === 3
}

export interface DealResult {
  readonly dealerIndex: PlayerIndex
  /** 四家手牌。下标与座位一致。庄家 14 张，其余各 13 张。 */
  readonly hands: readonly [
    readonly Tile[],
    readonly Tile[],
    readonly Tile[],
    readonly Tile[],
  ]
  /**
   * 剩下的牌墙，保持洗牌后的相对顺序。
   * 下标 0 是下一张要摸的牌。
   */
  readonly wall: readonly Tile[]
}

/**
 * 四人发牌。
 * 从庄家起按座位编号循环，发三轮四张、一轮一张，然后庄家再拿一张。
 * 只使用传入牌墙的顺序，发牌过程不再取随机数。
 */
export function deal(deck: readonly Tile[], dealerIndex: number = 0): DealResult {
  if (!isPlayerIndex(dealerIndex)) {
    throw new Error('庄家座位必须是 0、1、2 或 3')
  }
  assertDeck(deck)

  const hands: [Tile[], Tile[], Tile[], Tile[]] = [[], [], [], []]
  let cursor = 0

  for (const count of DEAL_ROUNDS) {
    for (let offset = 0; offset < PLAYER_COUNT; offset += 1) {
      const seat = seatAt(dealerIndex, offset)
      for (let drawn = 0; drawn < count; drawn += 1) {
        hands[seat].push(takeTile(deck, cursor))
        cursor += 1
      }
    }
  }

  hands[dealerIndex].push(takeTile(deck, cursor))
  cursor += 1

  if (cursor !== DEALT_TILE_COUNT) {
    throw new Error(`发牌数量错误：实际发出 ${cursor} 张`)
  }

  const wall = deck.slice(cursor)
  if (wall.length !== WALL_SIZE) {
    throw new Error(`牌墙数量错误：实际剩余 ${wall.length} 张`)
  }

  for (const [seat, hand] of hands.entries()) {
    const expected = seat === dealerIndex ? DEALER_HAND_SIZE : HAND_SIZE
    if (hand.length !== expected) {
      throw new Error(`座位 ${seat} 的手牌数量错误：${hand.length}`)
    }
  }

  const frozenHands: DealResult['hands'] = [
    Object.freeze(hands[0]),
    Object.freeze(hands[1]),
    Object.freeze(hands[2]),
    Object.freeze(hands[3]),
  ]

  return {
    dealerIndex,
    hands: frozenHands,
    wall: Object.freeze(wall),
  }
}

function assertDeck(deck: readonly Tile[]): void {
  if (deck.length !== TILE_COUNT) {
    throw new Error(`发牌需要 ${TILE_COUNT} 张牌，实际收到 ${deck.length} 张`)
  }

  const seen = new Set<number>()
  for (const tile of deck) {
    if (seen.has(tile.id)) {
      throw new Error(`牌墙里有重复的牌：${tile.id}`)
    }
    seen.add(tile.id)
  }
}

function seatAt(dealerIndex: PlayerIndex, offset: number): PlayerIndex {
  const seat = (dealerIndex + offset) % PLAYER_COUNT
  if (!isPlayerIndex(seat)) {
    throw new Error('座位计算错误')
  }
  return seat
}

function takeTile(deck: readonly Tile[], index: number): Tile {
  const tile = deck[index]
  if (tile === undefined) {
    throw new Error('发牌失败')
  }
  return tile
}

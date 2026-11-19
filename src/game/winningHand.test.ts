import { describe, expect, it } from 'vitest'
import { createTable, declareSelfWin, discardTile, respond } from '../engine'
import type { AnGangMeld } from '../engine'
import { createBag, takeAll } from '../engine/rules/test-bag'
import { presentWinningHand } from './labels'

describe('胡牌摊牌', () => {
  it('自摸的胡张已经在手里，只标出来，不重复', () => {
    const bag = createBag()
    const hand = takeAll(bag, [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 1], ['二条', 1], ['三条', 1],
      ['九筒', 2],
    ])
    const winning = hand[13]
    if (winning === undefined) {
      throw new Error('没有胡张')
    }
    const won = declareSelfWin(createTable({
      hands: [hand, [], [], []],
      wall: [],
      from: 'draw',
      pendingDrawId: winning.id,
    }))
    const shown = presentWinningHand('你', won.players[0].concealed, won.players[0].melds, winning)

    expect(shown.tiles).toHaveLength(14)
    expect(shown.tiles.filter((tile) => tile.drawn).map((tile) => tile.id)).toEqual([winning.id])
    expect(shown.tiles[shown.tiles.length - 1]?.id).toBe(winning.id)
  })

  it('点炮的胡张不在手里，要补到牌尾', () => {
    const bag = createBag()
    const hand = takeAll(bag, [
      ['一万', 1], ['二万', 1], ['三万', 1],
      ['四万', 1], ['五万', 1], ['六万', 1],
      ['七万', 1], ['八万', 1], ['九万', 1],
      ['一条', 1], ['二条', 1], ['三条', 1],
      ['九筒', 2],
    ])
    const winning = hand[13]
    if (winning === undefined) {
      throw new Error('没有胡张')
    }
    const waiting = hand.filter((tile) => tile.id !== winning.id)
    const discarded = discardTile(createTable({
      hands: [waiting, [winning], [], []],
      wall: [],
      current: 1,
    }), 1, winning.id)
    const won = respond(discarded, [{ player: 0, action: 'hu' }])
    if (won.phase.type !== 'over') {
      throw new Error('没有胡')
    }
    const award = won.phase.wins[0]
    if (award === undefined) {
      throw new Error('没有和牌')
    }
    const shown = presentWinningHand('你', won.players[0].concealed, won.players[0].melds, award.tile)

    expect(shown.tiles).toHaveLength(14)
    expect(won.players[0].concealed).toHaveLength(13)
    expect(shown.tiles[shown.tiles.length - 1]).toMatchObject({ id: winning.id, drawn: true })
  })

  it('赢家的暗杠摊开牌面', () => {
    const bag = createBag()
    const tiles = bag.take('一万', 4)
    const gang: AnGangMeld = {
      type: 'anGang',
      tiles: [tiles[0]!, tiles[1]!, tiles[2]!, tiles[3]!],
    }
    const eye = bag.take('九筒')[0]!
    if (eye === undefined) {
      throw new Error('没有将牌')
    }
    const shown = presentWinningHand('下家', [eye], [gang], eye)
    const meld = shown.melds[0]
    if (meld === undefined || meld.hidden) {
      throw new Error('暗杠没有摊开')
    }
    expect(meld.tiles.map((tile) => tile.id)).toEqual(tiles.map((tile) => tile.id))
  })
})

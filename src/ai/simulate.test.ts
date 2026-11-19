import { describe, expect, it } from 'vitest'
import { createDeck, deal, discardTile, drawTile, respond, shuffle, startRound } from '../engine'
import { playMatches, playState } from './simulate'

describe('四个 AI 自动对局', () => {
  it('连续 100 局都能胡牌或流局', () => {
    const results = playMatches(100)
    const wins = results.filter((result) => result.ending === 'hu').length
    const draws = results.filter((result) => result.ending === 'draw').length

    expect(results).toHaveLength(100)
    expect(wins + draws).toBe(100)
    expect(wins).toBeGreaterThan(0)
    expect(results.every((result) => result.steps < 400)).toBe(true)
  }, 120_000)

  it('牌墙摸空时记为流局', () => {
    let state = startRound(deal(shuffle(createDeck(), () => 0), 0))
    for (let step = 0; step < 500; step += 1) {
      if (state.phase.type === 'draw' && state.wall.length === 0) break
      if (state.phase.type === 'draw') {
        state = drawTile(state)
        continue
      }
      if (state.phase.type === 'discard') {
        const tile = state.players[state.current].concealed[0]
        if (tile === undefined) throw new Error('没有手牌')
        state = discardTile(state, state.current, tile.id)
        continue
      }
      state = respond(state, [])
    }

    expect(state.phase.type).toBe('draw')
    expect(state.wall).toHaveLength(0)
    expect(playState(state)).toMatchObject({ ending: 'draw', wins: [] })
  })
})
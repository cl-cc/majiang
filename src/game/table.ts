import { createAIScheduler, projectAIView } from '../ai'
import type { AIDecision } from '../ai'
import {
  createDeck,
  deal,
  declareAnGang,
  declareBuGang,
  declareSelfWin,
  discardTile,
  drawTile,
  isPlayerIndex,
  respond,
  shuffle,
  startRound,
  tileLabel,
} from '../engine'
import type { PlayerIndex, RandomSource, Response, RoundState, Tile, WinAward } from '../engine'
import { presentMeld, presentTile, presentWinningHand, sortHand } from './labels'
import { canHumanDiscard, humanActions, isSameCommand } from './legal'
import type { ClaimCommand, GameSnapshot, PlayerCommand, RiverView, ScoreRow, SeatPlace, SeatView, SettlementView } from './types'

const HUMAN = 0 as const

const SEATS = [
  { seat: 0, name: '你', place: 'self' },
  { seat: 1, name: '下家', place: 'right' },
  { seat: 2, name: '对家', place: 'top' },
  { seat: 3, name: '上家', place: 'left' },
] as const satisfies readonly { readonly seat: PlayerIndex; readonly name: string; readonly place: SeatPlace }[]

const PATTERN_TEXT = {
  standard: '平胡',
  sevenPairs: '七对',
  pengPeng: '碰碰胡',
} as const

export interface GameOptions {
  readonly sleep?: (ms: number) => Promise<void>
  readonly random?: () => number
  readonly shuffleRandom?: RandomSource
}

export interface GameController {
  readonly snapshot: GameSnapshot
  subscribe(listener: (snapshot: GameSnapshot) => void): () => void
  start(): void
  act(command: PlayerCommand): void
  dispose(): void
}

export function createGame(options: GameOptions = {}): GameController {
  return new TableSession(options)
}

export function seatName(seat: PlayerIndex): string {
  return SEATS[seat].name
}

class TableSession implements GameController {
  private readonly scheduler: ReturnType<typeof createAIScheduler>
  private readonly shuffleRandom: RandomSource
  private readonly listeners = new Set<(snapshot: GameSnapshot) => void>()

  private state: RoundState | null = null
  private rivers: [Tile[], Tile[], Tile[], Tile[]] = [[], [], [], []]
  private totals: [number, number, number, number] = [0, 0, 0, 0]
  private status: Partial<Record<PlayerIndex, string>> = {}
  private answers: Response[] = []
  private expected: readonly PlayerIndex[] = []
  private settlement: SettlementView | null = null
  private responsible: PlayerIndex | null = null
  private notice = '正在发牌'
  private round = 1
  private dealer: PlayerIndex = 0
  private revision = 0
  private humanDone = false
  private accounted = false
  private started = false
  private disposed = false
  private busyAct = false
  private applyingAI = false
  private current = emptySnapshot()

  constructor(options: GameOptions) {
    this.shuffleRandom = options.shuffleRandom ?? Math.random
    this.scheduler = createAIScheduler({ sleep: options.sleep, random: options.random })
  }

  get snapshot(): GameSnapshot {
    return this.current
  }

  subscribe(listener: (snapshot: GameSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  start(): void {
    if (this.disposed || this.started) {
      return
    }
    this.started = true
    this.round = 1
    this.dealer = 0
    this.totals = [0, 0, 0, 0]
    this.beginRound()
  }

  act(command: PlayerCommand): void {
    if (this.disposed || this.busyAct) {
      return
    }
    if (command.type === 'nextRound') {
      this.nextRound()
      return
    }
    if (this.settlement !== null || this.state === null) {
      return
    }
    const seen = this.revision
    this.busyAct = true
    try {
      this.perform(command)
    } catch (error) {
      if (this.revision === seen) {
        this.humanDone = false
      }
      this.notice = error instanceof Error ? error.message : '这一步不能这样走'
      this.emit()
    } finally {
      this.busyAct = false
    }
  }

  dispose(): void {
    this.disposed = true
    this.scheduler.cancelAll()
    this.listeners.clear()
  }

  private nextRound(): void {
    if (this.settlement === null || this.disposed) {
      return
    }
    this.scheduler.cancelAll()
    this.dealer = this.dealerForNextRound()
    this.round += 1
    this.beginRound()
  }

  private beginRound(): void {
    this.revision += 1
    this.rivers = [[], [], [], []]
    this.answers = []
    this.expected = []
    this.humanDone = false
    this.accounted = false
    this.status = {}
    this.settlement = null
    this.responsible = null
    this.notice = '牌已发好'
    this.state = startRound(deal(shuffle(createDeck(), this.shuffleRandom), this.dealer))
    this.emit()
    this.pump()
  }

  private perform(command: PlayerCommand): void {
    if (command.type === 'discard') {
      this.discard(command.tileId)
      return
    }
    if (command.type === 'nextRound') {
      return
    }
    this.claim(command)
  }

  private discard(tileId: number): void {
    if (this.state === null || !canHumanDiscard(this.state, HUMAN)) {
      this.notice = '现在不能出牌'
      this.emit()
      return
    }
    const tile = this.state.players[HUMAN].concealed.find((item) => item.id === tileId)
    if (tile === undefined) {
      this.notice = '手牌里没有这张牌'
      this.emit()
      return
    }
    this.apply(discardTile(this.state, HUMAN, tileId), `你打出${tileLabel(tile.kind)}`)
  }

  private claim(command: ClaimCommand): void {
    if (this.state === null || this.humanDone) {
      return
    }
    const match = humanActions(this.state, HUMAN).find((action) => isSameCommand(action.command, command))
    if (match === undefined) {
      this.notice = '现在不能这样走'
      this.emit()
      return
    }
    const phase = this.state.phase
    if (phase.type === 'discard') {
      if (command.type === 'hu') {
        this.apply(declareSelfWin(this.state), '你胡牌')
        return
      }
      if (command.type === 'anGang') {
        this.apply(declareAnGang(this.state, command.tileId), '你暗杠，补了一张牌')
        return
      }
      if (command.type === 'buGang') {
        this.apply(declareBuGang(this.state, command.tileId), '你补杠')
        return
      }
      this.notice = '现在不能这样走'
      this.emit()
      return
    }
    if (phase.type !== 'response' && phase.type !== 'qiangGang') {
      this.notice = '现在不能这样走'
      this.emit()
      return
    }
    this.collect(toResponse(command))
  }

  private applyDecision(seat: PlayerIndex, decision: AIDecision): void {
    if (this.state === null) {
      return
    }
    this.applyingAI = true
    try {
      this.applyDecisionNow(seat, decision)
    } finally {
      this.applyingAI = false
    }
  }

  private applyDecisionNow(seat: PlayerIndex, decision: AIDecision): void {
    if (this.state === null) {
      return
    }
    const name = seatName(seat)
    switch (decision.type) {
      case 'discard':
        this.apply(discardTile(this.state, seat, decision.tile.id), `${name}打出${tileLabel(decision.tile.kind)}`)
        return
      case 'selfHu':
        this.apply(declareSelfWin(this.state), `${name}胡牌`)
        return
      case 'anGang':
        this.apply(declareAnGang(this.state, decision.tileId), `${name}暗杠，补了一张牌`)
        return
      case 'buGang':
        this.apply(declareBuGang(this.state, decision.tileId), `${name}补杠`)
        return
      case 'response':
        if (decision.response.player !== seat) {
          return
        }
        this.collect(decision.response)
        return
    }
  }

  private collect(response: Response): void {
    if (this.state === null || this.answers.some((item) => item.player === response.player)) {
      return
    }
    const answers = [...this.answers, response]
    if (response.player === HUMAN) {
      this.humanDone = true
    }
    if (answers.length < this.expected.length) {
      this.answers = answers
      this.emit()
      return
    }
    const prev = this.state
    const next = respond(prev, answers)
    this.answers = answers
    this.apply(next, describeTransition(prev, next))
  }

  private apply(next: RoundState, notice: string): void {
    if (this.state === null || this.disposed) {
      return
    }
    const prev = this.state
    if (prev.phase.type === 'response') {
      this.responsible = prev.phase.discarder
    } else if (prev.phase.type === 'qiangGang') {
      this.responsible = prev.phase.player
    }
    this.absorb(prev, next)
    this.revision += 1
    this.state = next
    this.status = {}
    this.answers = []
    this.expected = []
    this.humanDone = false
    if (next.phase.type === 'over') {
      this.notice = '本局结束'
    } else if (notice) {
      this.notice = notice
    }
    this.pump()
  }

  private pump(): void {
    if (this.disposed || this.state === null) {
      return
    }
    const phase = this.state.phase
    if (phase.type === 'over') {
      this.finishHu()
      this.emit()
      return
    }
    if (phase.type === 'draw') {
      if (this.state.wall.length === 0) {
        this.finishDraw()
        this.emit()
        return
      }
      const seat = phase.player
      const notice = seat === HUMAN ? '你摸了一张牌，请打出' : `${seatName(seat)}摸了一张牌`
      this.apply(drawTile(this.state), notice)
      return
    }
    if (phase.type === 'discard') {
      if (this.state.current === HUMAN) {
        if (phase.from === 'deal') {
          this.notice = '请选择要打出的牌'
        }
        this.emit()
        return
      }
      this.status = { [this.state.current]: '正在选择出牌' }
      if (phase.from === 'deal') {
        this.notice = `${seatName(this.state.current)}正在选择出牌`
      }
      this.schedule(this.state.current)
      this.emit()
      return
    }

    const actor = phase.type === 'response' ? phase.discarder : phase.player
    const thinking = phase.type === 'qiangGang' ? '正在判断是否胡牌' : '正在判断是否碰牌'
    const expected = ([0, 1, 2, 3] as const).filter((seat) => seat !== actor)
    this.expected = expected
    this.answers = []
    const status: Partial<Record<PlayerIndex, string>> = {}
    for (const seat of expected) {
      if (seat === HUMAN) {
        continue
      }
      status[seat] = thinking
      this.schedule(seat)
    }
    this.status = status
    if (expected.includes(HUMAN) && humanActions(this.state, HUMAN).length === 0) {
      const seen = this.revision
      this.collect({ player: HUMAN, action: 'pass' })
      if (this.revision !== seen) {
        return
      }
    }
    this.emit()
  }

  private schedule(seat: PlayerIndex): void {
    const seen = this.revision
    if (this.applyingAI) {
      queueMicrotask(() => {
        if (this.disposed || seen !== this.revision) {
          return
        }
        this.startSchedule(seat, seen)
      })
      return
    }
    this.startSchedule(seat, seen)
  }

  private startSchedule(seat: PlayerIndex, seen: number): void {
    const handle = this.scheduler.scheduleAIAction({
      seat,
      readView: () => {
        if (this.state === null) {
          throw new Error('对局还没开始')
        }
        return projectAIView(this.state, seat)
      },
      apply: (decision) => {
        if (this.disposed || seen !== this.revision) {
          return
        }
        this.applyDecision(seat, decision)
      },
    })
    void handle.status.catch((error: unknown) => {
      if (this.disposed || seen !== this.revision) {
        return
      }
      this.notice = error instanceof Error ? error.message : '自动出牌中断'
      this.emit()
    })
  }

  private finishHu(): void {
    if (this.state === null || this.state.phase.type !== 'over') {
      return
    }
    this.rememberScores()
    const wins = this.state.phase.wins
    const first = wins[0]
    this.settlement = {
      kind: 'hu',
      title: wins.length > 1 ? '一炮多响' : `${seatName(first?.player ?? HUMAN)}胡了`,
      lines: wins.map(describeAward),
      hands: wins.map((award) => {
        const player = this.state?.players[award.player]
        if (player === undefined) {
          return { name: seatName(award.player), tiles: [], melds: [] }
        }
        return presentWinningHand(seatName(award.player), player.concealed, player.melds, award.tile)
      }),
      rows: this.scoreRows(),
    }
  }

  private finishDraw(): void {
    this.rememberScores()
    this.settlement = {
      kind: 'draw',
      title: '流局',
      lines: ['牌墙已经摸完，这一局没有人胡牌。'],
      hands: [],
      rows: this.scoreRows(),
    }
    this.notice = '流局'
  }

  private rememberScores(): void {
    if (this.accounted || this.state === null) {
      return
    }
    this.accounted = true
    const scores = this.state.players.map((player) => player.score)
    this.totals = [
      this.totals[0] + (scores[0] ?? 0),
      this.totals[1] + (scores[1] ?? 0),
      this.totals[2] + (scores[2] ?? 0),
      this.totals[3] + (scores[3] ?? 0),
    ]
  }

  private scoreRows(): ScoreRow[] {
    return SEATS.map((seat) => ({
      name: seat.name,
      round: this.state?.players[seat.seat].score ?? 0,
      total: this.totals[seat.seat],
    }))
  }

  private dealerForNextRound(): PlayerIndex {
    if (this.settlement?.kind !== 'hu' || this.state === null || this.state.phase.type !== 'over') {
      return this.dealer
    }
    const wins = this.state.phase.wins
    const only = wins[0]
    if (wins.length === 1 && only !== undefined) {
      return only.player
    }
    if (this.responsible === null) {
      return this.dealer
    }
    for (let step = 1; step < 4; step += 1) {
      const seat = this.responsible + step
      const index = seat > 3 ? seat - 4 : seat
      if (isPlayerIndex(index) && wins.some((win) => win.player === index)) {
        return index
      }
    }
    return this.dealer
  }

  private absorb(prev: RoundState, next: RoundState): void {
    if (prev.phase.type !== 'response' || next.discards.length !== prev.discards.length + 1) {
      return
    }
    const tile = next.discards[next.discards.length - 1]
    if (tile === undefined) {
      return
    }
    const seat = prev.phase.discarder
    const river = [...this.rivers[seat], tile]
    this.rivers = [
      seat === 0 ? river : this.rivers[0],
      seat === 1 ? river : this.rivers[1],
      seat === 2 ? river : this.rivers[2],
      seat === 3 ? river : this.rivers[3],
    ]
  }

  private emit(): void {
    this.current = this.build()
    for (const listener of this.listeners) {
      listener(this.current)
    }
  }

  private build(): GameSnapshot {
    if (this.state === null) {
      return emptySnapshot(this.round)
    }
    const state = this.state
    return {
      round: this.round,
      dealerName: seatName(this.dealer),
      wallCount: state.wall.length,
      notice: this.notice,
      turnText: this.turnText(),
      seats: SEATS.map((meta) => this.seatView(meta.seat, meta.name, meta.place)),
      rivers: SEATS.map((meta) => this.riverView(meta.seat, meta.name, meta.place)),
      actions: this.humanDone ? [] : humanActions(state, HUMAN),
      canDiscard: canHumanDiscard(state, HUMAN) && this.settlement === null,
      settlement: this.settlement,
    }
  }

  private seatView(seat: PlayerIndex, name: string, place: SeatPlace): SeatView {
    const state = this.state
    if (state === null) {
      return emptySeat(seat, name, place)
    }
    const player = state.players[seat]
    const owner = seat === HUMAN
    const drawnId = owner && state.phase.type === 'discard' && state.phase.selfTurn
      ? state.pendingDraw?.id ?? null
      : null
    return {
      seat,
      name,
      place,
      dealer: seat === this.dealer,
      score: this.totals[seat],
      roundScore: player.score,
      concealedCount: player.concealed.length,
      hand: owner ? sortHand(player.concealed, drawnId).map((tile) => presentTile(tile, tile.id === drawnId)) : [],
      melds: player.melds.map((meld) => presentMeld(meld, owner)),
      status: this.status[seat] ?? '',
    }
  }

  private riverView(seat: PlayerIndex, name: string, place: SeatPlace): RiverView {
    const pending = this.pendingDiscard(seat)
    return {
      name,
      place,
      tiles: this.rivers[seat].map((tile) => presentTile(tile)),
      pending: pending === null ? null : presentTile(pending),
    }
  }

  private pendingDiscard(seat: PlayerIndex): Tile | null {
    if (this.state === null || this.state.phase.type !== 'response' || this.state.phase.discarder !== seat) {
      return null
    }
    return this.state.phase.tile
  }

  private turnText(): string {
    if (this.settlement !== null || this.state === null) {
      return '本局结束'
    }
    const phase = this.state.phase
    if (phase.type === 'discard') {
      if (this.state.current === HUMAN) {
        return phase.selfTurn ? '请选择要打出的牌' : '请打出一张牌'
      }
      return `${seatName(this.state.current)}正在选择出牌`
    }
    if (phase.type === 'response' || phase.type === 'qiangGang') {
      if (!this.humanDone && humanActions(this.state, HUMAN).length > 0) {
        return phase.type === 'qiangGang' ? '可以抢杠，胡或者过' : '请选择吃、碰、杠或过'
      }
      return '其他玩家正在判断'
    }
    if (phase.type === 'draw') {
      return '等待摸牌'
    }
    return '本局结束'
  }
}

function toResponse(command: ClaimCommand): Response {
  switch (command.type) {
    case 'hu':
      return { player: HUMAN, action: 'hu' }
    case 'pass':
      return { player: HUMAN, action: 'pass' }
    case 'peng':
      return { player: HUMAN, action: 'peng' }
    case 'mingGang':
      return { player: HUMAN, action: 'gang' }
    case 'chi':
      return { player: HUMAN, action: 'chi', tileIds: command.tileIds }
    case 'anGang':
    case 'buGang':
      throw new Error('现在不能这样走')
  }
}

function describeTransition(prev: RoundState, next: RoundState): string {
  if (next.phase.type === 'over') {
    return '本局结束'
  }
  if (next.phase.type === 'draw') {
    return '这一轮都过了'
  }
  if (next.phase.type === 'qiangGang') {
    return `${seatName(next.phase.player)}补杠`
  }
  if (next.phase.type === 'discard' && next.phase.from === 'kong') {
    return `${seatName(next.current)}杠了，补了一张牌`
  }
  if (next.phase.type === 'discard' && next.phase.from === 'claim') {
    const melds = next.players[next.current].melds
    const meld = melds[melds.length - 1]
    return `${seatName(next.current)}${meld?.type === 'chi' ? '吃' : '碰'}`
  }
  if (prev.phase.type === 'response') {
    return `${seatName(prev.phase.discarder)}打出的牌没有人要`
  }
  return '进行中'
}

function describeAward(award: WinAward): string {
  const who = seatName(award.player)
  const pattern = PATTERN_TEXT[award.pattern]
  const tile = tileLabel(award.tile.kind)
  switch (award.method) {
    case 'zimo':
      return `${who}自摸${pattern}，胡 ${tile}，三家各付 ${award.points} 分`
    case 'gangShang':
      return `${who}杠上开花，${pattern}，胡 ${tile}，三家各付 ${award.points} 分`
    case 'qiangGang':
      return `${who}抢杠胡，${pattern}，胡 ${tile}，得 ${award.points} 分`
    case 'dianpao':
      return `${who}点炮胡，${pattern}，胡 ${tile}，得 ${award.points} 分`
  }
}

function emptySeat(seat: PlayerIndex, name: string, place: SeatPlace): SeatView {
  return {
    seat,
    name,
    place,
    dealer: false,
    score: 0,
    roundScore: 0,
    concealedCount: 0,
    hand: [],
    melds: [],
    status: '',
  }
}

function emptySnapshot(round = 1): GameSnapshot {
  return {
    round,
    dealerName: '你',
    wallCount: 0,
    notice: '正在发牌',
    turnText: '正在发牌',
    seats: SEATS.map((seat) => emptySeat(seat.seat, seat.name, seat.place)),
    rivers: SEATS.map((seat) => ({ name: seat.name, place: seat.place, tiles: [], pending: null })),
    actions: [],
    canDiscard: false,
    settlement: null,
  }
}

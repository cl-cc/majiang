<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { formatScore } from '../game/labels'
import type { PlayerCommand, SeatPlace } from '../game/types'
import { useGame } from '../game/useGame'
import ActionBar from './ActionBar.vue'
import MahjongTile from './MahjongTile.vue'
import MeldGroup from './MeldGroup.vue'
import SeatPanel from './SeatPanel.vue'
import SettlementPanel from './SettlementPanel.vue'
import MusicToggle from './MusicToggle.vue'

const { snapshot, act } = useGame()
const selectedId = ref<number | null>(null)
const hint = ref('')

const self = computed(() => snapshot.value.seats.find((seat) => seat.place === 'self'))
const opponents = computed(() => snapshot.value.seats.filter((seat) => seat.place !== 'self'))
function meldsOf(place: SeatPlace) {
  return snapshot.value.seats.find((seat) => seat.place === place)?.melds ?? []
}

watch(
  () => self.value?.hand.map((tile) => tile.id).join(','),
  () => {
    if (!self.value?.hand.some((tile) => tile.id === selectedId.value)) {
      selectedId.value = null
    }
  },
)

watch(
  () => snapshot.value.notice,
  () => {
    hint.value = ''
  },
)

function revealLatestDiscard() {
  for (const node of document.querySelectorAll<HTMLElement>('.river-tiles')) {
    const tile = node.lastElementChild
    if (!(tile instanceof HTMLElement)) continue
    const box = node.getBoundingClientRect()
    const face = tile.getBoundingClientRect()
    if (face.top < box.top - 0.5) node.scrollTop -= box.top - face.top
    if (face.bottom > box.bottom + 0.5) node.scrollTop += face.bottom - box.bottom
    if (face.left < box.left - 0.5) node.scrollLeft -= box.left - face.left
    if (face.right > box.right + 0.5) node.scrollLeft += face.right - box.right
  }
}

watch(
  () => snapshot.value.rivers.map((river) => `${river.tiles.at(-1)?.id ?? ''}:${river.pending?.id ?? ''}`).join('|'),
  () => {
    void nextTick(revealLatestDiscard)
  },
)

function chooseTile(id: number) {
  if (!snapshot.value.canDiscard) {
    hint.value = '还没轮到你出牌'
    return
  }
  if (selectedId.value === id) {
    act({ type: 'discard', tileId: id })
    return
  }
  selectedId.value = id
  hint.value = '再次点击这张牌，或点出牌'
}

function discardSelected() {
  if (selectedId.value === null) {
    hint.value = '请先点选一张牌'
    return
  }
  act({ type: 'discard', tileId: selectedId.value })
}

function run(command: PlayerCommand) {
  hint.value = ''
  selectedId.value = null
  act(command)
}
</script>

<template>
  <main class="table">
    <p class="rotate-hint">竖屏也能玩，横过来看牌更清楚。</p>
    <SeatPanel v-for="seat in opponents" :key="seat.seat" :seat="seat" />

    <section class="center" aria-label="牌桌">
      <div class="river-board">
        <div
          v-for="river in snapshot.rivers"
          :key="river.place"
          class="river"
          :class="`river-${river.place}`"
          :aria-label="`${river.name}的出牌`"
        >
          <div class="river-melds">
            <MeldGroup v-for="(meld, index) in meldsOf(river.place)" :key="index" :meld="meld" />
          </div>
          <div class="river-tiles">
            <MahjongTile v-for="tile in river.tiles" :key="tile.id" :face="tile" size="river" />
            <MahjongTile v-if="river.pending" :face="river.pending" size="river" live />
          </div>
        </div>
        <div class="table-core">
          <h1>家常麻将</h1>
          <p class="wall-count"><strong>{{ snapshot.wallCount }}</strong><span>剩余</span></p>
          <p class="turn" aria-live="polite">{{ snapshot.notice !== '' && snapshot.notice !== snapshot.turnText ? snapshot.notice : snapshot.turnText }}</p>
          <p class="info">第 {{ snapshot.round }} 局 · 庄家 {{ snapshot.dealerName }}</p>
        </div>
      </div>
    </section>

    <section class="self" aria-label="你的手牌">
      <MusicToggle />
      <header class="seat-head self-head">
        <h2>你</h2>
        <span v-if="self?.dealer" class="dealer">庄</span>
        <span class="score">{{ formatScore(self?.score ?? 0) }}</span>
      </header>
      <ActionBar
        :actions="snapshot.actions"
        :can-discard="snapshot.canDiscard"
        :selected="selectedId !== null"
        :hint="hint"
        @command="run"
        @discard="discardSelected"
      />
      <div class="self-hand" :class="{ 'is-waiting': !snapshot.canDiscard }">
        <MahjongTile
          v-for="tile in self?.hand ?? []"
          :key="tile.id"
          :face="tile"
          size="hand"
          :selected="tile.id === selectedId"
          @choose="chooseTile"
        />
      </div>
    </section>

    <Teleport to="body">
      <SettlementPanel
        v-if="snapshot.settlement"
        :settlement="snapshot.settlement"
        @next="act({ type: 'nextRound' })"
      />
    </Teleport>
  </main>
</template>

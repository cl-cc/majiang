<script setup lang="ts">
import { formatScore } from '../game/labels'
import type { SeatView } from '../game/types'
import MahjongTile from './MahjongTile.vue'
import MeldGroup from './MeldGroup.vue'

defineProps<{
  seat: SeatView
}>()
</script>

<template>
  <section class="seat" :class="`seat-${seat.place}`" :aria-label="`${seat.name}，${seat.concealedCount}张手牌已隐藏`">
    <header class="seat-head">
      <h2>{{ seat.name }}</h2>
      <span v-if="seat.dealer" class="dealer">庄</span>
      <span class="score">{{ formatScore(seat.score) }}</span>
    </header>
    <div class="seat-melds" :aria-label="`${seat.name}的吃碰杠`">
      <MeldGroup v-for="(meld, index) in seat.melds" :key="index" :meld="meld" />
    </div>
    <p class="status">{{ seat.status }}</p>
    <div class="backs" aria-hidden="true">
      <MahjongTile v-for="index in seat.concealedCount" :key="index" back size="meld" />
    </div>
  </section>
</template>

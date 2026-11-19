<script setup lang="ts">
import { formatScore } from '../game/labels'
import type { SettlementView } from '../game/types'
import MahjongTile from './MahjongTile.vue'
import MeldGroup from './MeldGroup.vue'

defineProps<{
  settlement: SettlementView
}>()

const emit = defineEmits<{
  next: []
}>()
</script>

<template>
  <div class="settlement-layer">
    <section class="settlement" role="dialog" aria-modal="true" aria-labelledby="settlement-title">
      <h2 id="settlement-title">{{ settlement.title }}</h2>
      <p v-for="(line, index) in settlement.lines" :key="index" class="settlement-line">{{ line }}</p>
      <div v-for="hand in settlement.hands" :key="hand.name" class="winning-hand">
        <p class="winning-name">{{ hand.name }}的牌</p>
        <div class="winning-tiles">
          <MeldGroup v-for="(meld, index) in hand.melds" :key="index" :meld="meld" />
          <MahjongTile
            v-for="tile in hand.tiles"
            :key="tile.id"
            :face="tile"
            size="river"
            :live="tile.drawn"
          />
        </div>
      </div>
      <div class="score-table">
        <span>玩家</span>
        <span>本局</span>
        <span>累计</span>
        <template v-for="row in settlement.rows" :key="row.name">
          <span>{{ row.name }}</span>
          <span>{{ formatScore(row.round) }}</span>
          <span>{{ formatScore(row.total) }}</span>
        </template>
      </div>
      <button type="button" class="action action-discard settlement-next" @click="emit('next')">下一局</button>
    </section>
  </div>
</template>

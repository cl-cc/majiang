<script setup lang="ts">
import type { MeldFace } from '../game/types'
import MahjongTile from './MahjongTile.vue'

defineProps<{
  meld: MeldFace
}>()
</script>

<template>
  <div class="meld">
    <span class="meld-label">{{ meld.label }}</span>
    <div class="meld-tiles">
      <template v-if="meld.hidden">
        <MahjongTile v-for="index in meld.count" :key="index" back size="meld" />
      </template>
      <template v-else>
        <MahjongTile v-for="tile in meld.tiles" :key="tile.id" :face="tile" size="meld" />
      </template>
    </div>
  </div>
</template>

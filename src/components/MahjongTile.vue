<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { TILE_BACK_URL, tileImageUrl } from '../game/tileImage'
import type { TileFace } from '../game/types'

const props = defineProps<{
  face?: TileFace
  back?: boolean
  size: 'hand' | 'meld' | 'river'
  selected?: boolean
  live?: boolean
}>()

const emit = defineEmits<{
  choose: [id: number]
}>()

const broken = ref(false)

const src = computed(() => {
  if (props.back) {
    return TILE_BACK_URL
  }
  if (props.face === undefined) {
    return null
  }
  return tileImageUrl(props.face)
})

const label = computed(() => (props.face === undefined ? '' : `${props.face.primary}${props.face.secondary}`))

watch(
  () => [props.back, props.face?.id, props.face?.primary] as const,
  () => {
    broken.value = false
  },
)

function choose() {
  if (props.face === undefined) {
    return
  }
  emit('choose', props.face.id)
}

function markBroken() {
  broken.value = true
}
</script>

<template>
  <button
    v-if="size === 'hand' && face"
    type="button"
    class="tile tile-hand"
    :class="[`suit-${face.suit}`, { 'is-selected': selected, 'is-drawn': face.drawn, 'is-fallback': broken || src === null }]"
    :aria-pressed="selected === true"
    :aria-label="label"
    @click="choose"
  >
    <img v-if="src && !broken" :src="src" alt="" draggable="false" @error="markBroken" />
    <span v-else class="tile-fallback">
      <span class="tile-rank">{{ face.primary }}</span>
      <span v-if="face.secondary" class="tile-suit">{{ face.secondary }}</span>
    </span>
  </button>
  <span v-else-if="back" class="tile tile-back" :class="[`tile-${size}`, { 'is-fallback': broken }]" aria-hidden="true">
    <img v-if="!broken" :src="TILE_BACK_URL" alt="" draggable="false" @error="markBroken" />
  </span>
  <span
    v-else-if="face"
    class="tile"
    :class="[`tile-${size}`, `suit-${face.suit}`, { 'is-live': live, 'is-drawn': face.drawn, 'is-fallback': broken || src === null }]"
    :aria-label="label"
  >
    <img v-if="src && !broken" :src="src" alt="" draggable="false" @error="markBroken" />
    <span v-else class="tile-fallback">
      <span class="tile-rank">{{ face.primary }}</span>
      <span v-if="face.secondary" class="tile-suit">{{ face.secondary }}</span>
    </span>
  </span>
</template>

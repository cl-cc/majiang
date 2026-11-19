<script setup lang="ts">
import type { LegalAction, PlayerCommand } from '../game/types'

defineProps<{
  actions: readonly LegalAction[]
  canDiscard: boolean
  selected: boolean
  hint: string
}>()

const emit = defineEmits<{
  command: [command: PlayerCommand]
  discard: []
}>()
</script>

<template>
  <div class="actions" role="group" aria-label="操作">
    <div class="action-row">
      <button
        v-for="action in actions"
        :key="action.id"
        type="button"
        class="action"
        :class="{
          'action-hu': action.command.type === 'hu',
          'action-pass': action.command.type === 'pass',
        }"
        @click="emit('command', action.command)"
      >
        {{ action.label }}
      </button>
      <button
        v-if="canDiscard"
        type="button"
        class="action action-discard"
        :aria-disabled="selected ? 'false' : 'true'"
        @click="emit('discard')"
      >
        出牌
      </button>
    </div>
    <p class="hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { onScopeDispose, ref } from 'vue'

const TRACKS = ['ancient.mp3', 'flute.mp3', 'traditional.mp3'].map(
  (file) => `${import.meta.env.BASE_URL}audio/${file}`,
)

const on = ref(false)
const player = ref<HTMLAudioElement | null>(null)

let index = 0
let failed = 0

function load(next: number) {
  const audio = player.value
  if (audio === null) return
  index = (next + TRACKS.length) % TRACKS.length
  audio.src = TRACKS[index]
}

function playCurrent() {
  const audio = player.value
  if (audio === null) return
  void audio.play().catch((error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') return
    on.value = false
    audio.pause()
  })
}

function onEnded() {
  load(index + 1)
  if (on.value) playCurrent()
}

function onError() {
  failed += 1
  const audio = player.value
  if (!on.value || audio === null || failed >= TRACKS.length) {
    on.value = false
    audio?.pause()
    return
  }
  load(index + 1)
  playCurrent()
}

function onPlaying() {
  failed = 0
}

function toggle() {
  const audio = player.value
  if (audio === null) return
  if (on.value) {
    audio.pause()
    on.value = false
    return
  }
  if (audio.src === '') load(0)
  on.value = true
  playCurrent()
}

onScopeDispose(() => {
  const audio = player.value
  if (audio === null) return
  audio.pause()
  audio.src = ''
})
</script>

<template>
  <button
    type="button"
    class="music-toggle"
    :aria-pressed="on"
    :aria-label="on ? '关闭背景音乐' : '打开背景音乐'"
    @click="toggle"
  >
    <svg v-if="on" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 9h3l5-4v14l-5-4H4V9zm11.5 3a3.5 3.5 0 0 0-1.5-2.9v5.8a3.5 3.5 0 0 0 1.5-2.9zm2.2-5.2-1.4 1.4a6.5 6.5 0 0 1 0 7.6l1.4 1.4a8.5 8.5 0 0 0 0-10.4z"
      />
    </svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 9h3l5-4v14l-5-4H4V9zm12.2.8 1.4-1.4 1.4 1.4 1.4-1.4 1.4 1.4-1.4 1.4 1.4 1.4-1.4 1.4-1.4-1.4-1.4 1.4-1.4-1.4 1.4-1.4-1.4-1.4z"
      />
    </svg>
  </button>
  <audio ref="player" preload="none" @ended="onEnded" @error="onError" @playing="onPlaying" />
</template>

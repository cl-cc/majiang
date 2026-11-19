import { onScopeDispose, shallowRef } from 'vue'
import { createGame } from './table'
import type { GameSnapshot, PlayerCommand } from './types'

export function useGame() {
  const game = createGame()
  const snapshot = shallowRef<GameSnapshot>(game.snapshot)
  const stop = game.subscribe((next) => {
    snapshot.value = next
  })
  game.start()
  onScopeDispose(() => {
    stop()
    game.dispose()
  })

  return {
    snapshot,
    act(command: PlayerCommand) {
      game.act(command)
    },
  }
}

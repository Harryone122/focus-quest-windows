import type { ExplorerAnimationKey } from './MapDefinition'

// The brain depends only on this contract. A future Spine implementation can
// replace the Phaser shape adapter without changing planning or progress code.
export interface ExplorerAnimationAdapter {
  face(direction: -1 | 1): void
  play(key: ExplorerAnimationKey, durationMs?: number, onComplete?: () => void): void
  stop(): void
}

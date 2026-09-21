import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import hallUrl from './assets/disordered-reading-hall-v3.png'
import type { RpgState } from '../../shared/types'

interface ArchiveGameProps {
  rpg: RpgState
}

class ArchiveScene extends Phaser.Scene {
  constructor(private readonly node: number) {
    super('archive')
  }

  preload(): void {
    this.load.image('hall', hallUrl)
  }

  create(): void {
    const width = this.scale.width
    const height = this.scale.height
    const hall = this.add.image(width / 2, height / 2, 'hall')
    hall.setScale(Math.max(width / hall.width, height / hall.height))
    hall.setTint(0xe0d8cb)

    const veil = this.add.graphics()
    veil.fillGradientStyle(0x07111f, 0x07111f, 0x142238, 0x142238, 0.2, 0.08, 0.36, 0.54)
    veil.fillRect(0, 0, width, height)

    const glow = this.add.circle(width * 0.72, height * 0.56, 86, 0x83ded8, 0.1)
    this.tweens.add({ targets: glow, alpha: { from: 0.05, to: 0.22 }, scale: { from: 0.8, to: 1.2 }, yoyo: true, repeat: -1, duration: 2800 })

    const nodeLabel = this.add.text(width - 28, 28, `檔案修復  ${this.node} / 12`, {
      color: '#efe6d2',
      fontFamily: 'serif',
      fontSize: '15px',
      backgroundColor: '#091423bb',
      padding: { x: 12, y: 8 }
    })
    nodeLabel.setOrigin(1, 0)
  }
}

export function ArchiveGame({ rpg }: ArchiveGameProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!host.current) return
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      backgroundColor: '#07111f',
      width: host.current.clientWidth,
      height: host.current.clientHeight,
      transparent: false,
      scene: new ArchiveScene(rpg.node),
      render: { antialias: true },
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }
    })
    return () => game.destroy(true)
  }, [rpg.node])

  return <div className="archive-game" ref={host} aria-label="星光檔案館場景" />
}

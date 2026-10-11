export interface ExplorationProgressSnapshot {
  elapsedSeconds: number
  targetSeconds: number
  ratio: number
  dueLampCount: number
  nextMilestoneIndex: number | null
  nextMilestoneAt: number | null
  secondsUntilNext: number | null
}

export class ProgressController {
  private elapsedSeconds = 0

  constructor(
    private readonly targetSeconds: number,
    private readonly lampCount: number
  ) {}

  update(elapsedSeconds: number): ExplorationProgressSnapshot {
    this.elapsedSeconds = Math.max(0, elapsedSeconds)
    return this.snapshot()
  }

  snapshot(): ExplorationProgressSnapshot {
    const ratio = Math.min(1, this.elapsedSeconds / Math.max(1, this.targetSeconds))
    const dueLampCount = Math.min(this.lampCount, Math.floor(ratio * this.lampCount + 0.000001))
    const nextMilestoneIndex = dueLampCount < this.lampCount ? dueLampCount : null
    const nextMilestoneAt = nextMilestoneIndex === null
      ? null
      : ((nextMilestoneIndex + 1) / this.lampCount) * this.targetSeconds
    return {
      elapsedSeconds: this.elapsedSeconds,
      targetSeconds: this.targetSeconds,
      ratio,
      dueLampCount,
      nextMilestoneIndex,
      nextMilestoneAt,
      secondsUntilNext: nextMilestoneAt === null ? null : Math.max(0, nextMilestoneAt - this.elapsedSeconds)
    }
  }

  isMilestoneDue(index: number): boolean {
    return this.elapsedSeconds + 0.05 >= ((index + 1) / this.lampCount) * this.targetSeconds
  }

  shouldPrepare(index: number, travelSeconds: number, interactionLeadSeconds = 5): boolean {
    const milestoneAt = ((index + 1) / this.lampCount) * this.targetSeconds
    return milestoneAt - this.elapsedSeconds <= travelSeconds + interactionLeadSeconds
  }

  walkingSpeedScale(index: number, travelSeconds: number): number {
    const milestoneAt = ((index + 1) / this.lampCount) * this.targetSeconds
    const available = Math.max(0.5, milestoneAt - this.elapsedSeconds - 2.5)
    return Math.min(1.18, Math.max(1, travelSeconds / available))
  }
}

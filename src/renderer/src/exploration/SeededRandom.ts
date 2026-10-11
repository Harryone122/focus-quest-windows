export function hashExplorationSeed(runSeed: number, nodeId: string, sessionId: string): number {
  const text = `${runSeed}|${nodeId}|${sessionId}`
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x6d2b79f5
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let value = this.state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  range(minimum: number, maximum: number): number {
    return minimum + (maximum - minimum) * this.next()
  }

  jitter(amount: number): number {
    return this.range(-amount, amount)
  }

  skip(count: number): void {
    for (let index = 0; index < count; index += 1) this.next()
  }
}

export interface WindowFrameState { visible: boolean; focused: boolean }
export function setWindowFrameState(next: Partial<WindowFrameState>): void
export function frameIntervalMs(): number
export function frameDue(now: number, last: number): boolean
export function shouldRender(): boolean
export function onFrameVisible(fn: () => void): () => void
export const IFRAME_FRAME_SOURCE: string
export const PACED_IFRAME_FRAME_SOURCE: string

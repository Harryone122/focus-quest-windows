import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSnapshot } from '../src/shared/types'
import { canRetainFocus, isReviewReturn } from '../src/renderer/src/focusExitTransition'
import { leaveSceneForLobby, takeSceneForLobby } from '../src/renderer/src/cloudRuins/sceneHandoff'
import type { CloudRuinsSceneHandle } from '../src/renderer/src/cloudRuins/cloudRuinsScene'

const snapshot = (session: string | null, review: string | null): AppSnapshot => ({
  activeSession: session ? { id: session } : null,
  pendingDebrief: review ? { sessionId: review } : null
}) as AppSnapshot

describe('focus exit presentation boundaries', () => {
  it('retains only the same session, never an unrelated or new active focus', () => {
    expect(canRetainFocus(snapshot('a', null), snapshot(null, 'a'))).toBe(true)
    expect(canRetainFocus(snapshot('a', null), snapshot(null, 'b'))).toBe(false)
    expect(canRetainFocus(snapshot('a', null), snapshot('b', 'a'))).toBe(false)
    expect(canRetainFocus(snapshot('a', null), snapshot(null, null))).toBe(false)
    expect(canRetainFocus(null, snapshot(null, 'a'))).toBe(false)
  })
  it('animates only dismissal, not task answers, initial load, ticks or departure', () => {
    expect(isReviewReturn(snapshot(null, 'a'), snapshot(null, null))).toBe(true)
    expect(isReviewReturn(snapshot(null, 'a'), snapshot(null, 'a'))).toBe(false)
    expect(isReviewReturn(snapshot('a', null), snapshot(null, 'a'))).toBe(false)
    expect(isReviewReturn(snapshot(null, 'a'), snapshot('b', null))).toBe(false)
    expect(isReviewReturn(null, snapshot(null, null))).toBe(false)
  })
})

describe('one-use scene ownership handoff', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { setTimeout, clearTimeout })
  })
  afterEach(() => { takeSceneForLobby()?.destroy(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })
  const scene = (): CloudRuinsSceneHandle => ({ destroy: vi.fn(), setPaused: vi.fn() }) as unknown as CloudRuinsSceneHandle
  it('transfers once without destroying the adopted canvas', () => {
    const handle = scene()
    leaveSceneForLobby(handle)
    expect(takeSceneForLobby()).toBe(handle)
    expect(takeSceneForLobby()).toBeNull()
    vi.runAllTimers()
    expect(handle.destroy).not.toHaveBeenCalled()
  })
  it('cleans up an abandoned handoff and never returns a disposed scene', () => {
    const handle = scene()
    leaveSceneForLobby(handle)
    vi.advanceTimersByTime(1000)
    expect(handle.destroy).toHaveBeenCalledTimes(1)
    expect(takeSceneForLobby()).toBeNull()
  })
  it('bounds the pool to one renderer, disposing a replaced handoff', () => {
    const first = scene(), second = scene()
    leaveSceneForLobby(first); leaveSceneForLobby(second)
    expect(first.destroy).toHaveBeenCalledTimes(1)
    expect(takeSceneForLobby()).toBe(second)
    vi.runAllTimers()
    expect(second.destroy).not.toHaveBeenCalled()
  })
})

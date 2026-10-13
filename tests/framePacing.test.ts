import { afterEach, expect, test } from 'vitest'
import { frameDue, frameIntervalMs, onFrameVisible, setWindowFrameState, shouldRender } from '../src/renderer/src/framePacing.js'

afterEach(() => setWindowFrameState({ visible: true, focused: true }))

test('focused window keeps ~60 fps and every frame of a 60 Hz display', () => {
  expect(frameIntervalMs()).toBeCloseTo(1000 / 60)
  expect(frameDue(1016.7, 1000)).toBe(true)
  expect(frameDue(1006.9, 1000)).toBe(false)
  expect(shouldRender()).toBe(true)
})

test('unfocused window drops to ~30 fps and still draws', () => {
  setWindowFrameState({ visible: true, focused: false })
  expect(frameDue(1016.7, 1000)).toBe(false)
  expect(frameDue(1033.4, 1000)).toBe(true)
  expect(shouldRender()).toBe(true)
})

test('minimized window keeps simulating at ~30 Hz without drawing, and asks for a redraw on return', () => {
  let redraws = 0
  const stop = onFrameVisible(() => { redraws++ })
  setWindowFrameState({ visible: false, focused: false })
  expect(shouldRender()).toBe(false)
  expect(frameDue(1033.4, 1000)).toBe(true)
  setWindowFrameState({ visible: true, focused: true })
  expect(redraws).toBe(1)
  stop()
  setWindowFrameState({ visible: false, focused: false })
  setWindowFrameState({ visible: true, focused: true })
  expect(redraws).toBe(1)
})

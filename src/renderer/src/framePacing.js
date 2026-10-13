// Shared frame budget for the 3D scenes. Focus keeps the scenes simulating while the player works
// in another app, but nobody needs 60+ GPU frames per second for a window they are not looking at:
// - focused window: at most ~60 fps (protects 120/144 Hz monitors)
// - visible but unfocused window: ~30 fps
// - minimized / hidden to tray: keep the ~30 Hz simulation, skip the GPU draw entirely
// State comes from the main process (window events). Without it everything stays at full rate.
const FOCUSED_MS = 1000 / 60, BACKGROUND_MS = 1000 / 30, SLACK_MS = 4;
const state = { visible: true, focused: true };
const visibleListeners = new Set();

export function setWindowFrameState(next) {
  const wasVisible = state.visible;
  state.visible = next.visible !== false;
  state.focused = next.focused !== false;
  if (state.visible && !wasVisible) visibleListeners.forEach((fn) => { try { fn(); } catch (error) { console.error(error); } });
}
export function frameIntervalMs() { return state.visible && state.focused ? FOCUSED_MS : BACKGROUND_MS; }
/** True when enough real time has passed since `last` (performance.now() ms) to run another frame. */
export function frameDue(now, last) { return now - last >= frameIntervalMs() - SLACK_MS; }
/** False while the window is minimized or hidden: simulate, but do not draw. */
export function shouldRender() { return state.visible; }
/** Called when the window becomes visible again, so a frozen (paused) frame can be redrawn. */
export function onFrameVisible(fn) { visibleListeners.add(fn); return () => { visibleListeners.delete(fn); }; }

// The lobby and collection room run inside same-origin iframes; they read the budget from here.
if (typeof window !== 'undefined') window.__focusQuestFramePace = { due: frameDue, shouldRender, interval: frameIntervalMs };

// The campfire lobby and collection room prototypes share this render loop. The paced version
// reads the parent's budget; `parent` is the App because both frames are same-origin srcdoc.
export const IFRAME_FRAME_SOURCE = 'function frame() { const dt = Math.min(clock.getDelta(), 0.05); if (!window.__hold) { update(dt); renderer.render(scene, camera); } requestAnimationFrame(frame); }';
export const PACED_IFRAME_FRAME_SOURCE = 'let paceLast = 0; function frame() { let P = null; try { P = parent.__focusQuestFramePace || null; } catch (e) {} const now = performance.now(); if (P && !P.due(now, paceLast)) { requestAnimationFrame(frame); return; } paceLast = now; const dt = Math.min(clock.getDelta(), 0.05); if (!window.__hold) { update(dt); if (!P || P.shouldRender()) renderer.render(scene, camera); } requestAnimationFrame(frame); }';

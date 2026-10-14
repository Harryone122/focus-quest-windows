// Preserve elapsed animation time at low frame rates without large physics steps.
// Long stalls are bounded; saved exploration progress remains the backend's authority.
export function advanceAnimation(elapsed, update) {
  const duration = Number.isFinite(elapsed) ? Math.max(0, Math.min(1, elapsed)) : 0;
  const count = Math.max(1, Math.ceil(duration / 0.05));
  const step = duration / count;
  for (let i = 0; i < count; i++) update(step);
  return duration;
}

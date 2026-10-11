// Isolated trial authority. No rewards, clues, collection records or player database.
const SOUNDS = new Set(['chime', 'echo', 'bell', 'wind', 'wall']);
function newExploration(seed = 11, reserved = null) {
  return { seed, reserved, sound: null, mouthEcho: false, visits: 0, windRoll: 0, windSeen: false, decisions: [] };
}
function random(s) { s.seed = (s.seed * 16807) % 2147483647; return s.seed / 2147483647; }
function fits(s, b) {
  const { now, walkToMouth, walkToLamp, resting = false } = b;
  if (![now, walkToMouth, walkToLamp].every(Number.isFinite) || walkToMouth < 0 || walkToLamp < 0) return false;
  if (!s.sound || !s.mouthEcho || s.reserved || s.visits >= 1 || resting || now < 300 || now >= 3000) return false;
  const next = (Math.floor(now / 600) + 1) * 600;
  return walkToMouth + 200 + walkToLamp + 60 < next - now;
}
function choose(s, budget, arriving = false) {
  const allowed = fits(s, budget) && (arriving || random(s) < 0.6);
  s.decisions.push({ ...budget, arriving, allowed });
  if (s.decisions.length > 100) s.decisions.shift();
  if (allowed && arriving) s.visits++;
  return allowed;
}
function signal(s, kind) { if (!SOUNDS.has(kind) || s.mouthEcho) return; s.sound = kind; }
function mouth(s) { if (!s.sound || s.mouthEcho) return false; s.mouthEcho = true; return true; }
function wind(s, now) {
  let event = null;
  while (s.windRoll < Math.floor(Math.min(now, 3000) / 240)) {
    s.windRoll++;
    if (random(s) < 0.08) { event = { first: !s.windSeen, at: s.windRoll * 240 }; s.windSeen = true; }
  }
  return event;
}
module.exports = { newExploration, fits, choose, signal, mouth, wind, random };

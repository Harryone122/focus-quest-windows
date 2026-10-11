export interface AudioSettings { environmentVolume: number; musicVolume?: number; audioMuted?: boolean }
export const audioVolume = (value: number) => Math.pow(Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)) / 100, 1.4)
export const HARMONY_GAIN = 0.001
export const HARMONY = [130.8128, 195.9977, 261.6256, 293.6648] as const
export const harmonyLevel = (settings: AudioSettings) => settings.audioMuted ? 0 : audioVolume(settings.musicVolume ?? 0) * HARMONY_GAIN

/** Beat-free Csus2. Its bus is deliberately quieter than distant water at env 35%. */
export function buildHarmony(context: BaseAudioContext, destination: AudioNode) {
  const sources: OscillatorNode[] = [], nodes: AudioNode[] = []
  for (const [i, frequency] of HARMONY.entries()) {
    const source = context.createOscillator(), voice = context.createGain(), pan = context.createStereoPanner()
    source.frequency.value = frequency; voice.gain.value = i === 0 ? 0.18 : 0.1
    pan.pan.value = (i - 1.5) * 0.2
    source.connect(voice); voice.connect(pan); pan.connect(destination); source.start()
    sources.push(source); nodes.push(source, voice, pan)
  }
  return { dispose() { for (const source of sources) { try { source.stop() } catch { /* Already stopped. */ } }; for (const node of nodes) node.disconnect() } }
}

/** Preview-only motif until the user accepts the notes and timbres. */
export function previewMotif(context: BaseAudioContext, destination: AudioNode, when = 0, timbre = 1, ending = false) {
  const note = (frequency: number, at: number, duration: number, level: number) => {
    for (const [multiple, partial] of [[1, 1], [2, 0.14], [3, 0.06]]) {
      const source = context.createOscillator(), gain = context.createGain()
      source.frequency.value = frequency * multiple; source.type = timbre === 6 ? 'triangle' : 'sine'
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(level * partial, at + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.000001, at + duration)
      source.connect(gain); gain.connect(destination); source.start(at); source.stop(at + duration + 0.01)
      source.onended = () => { source.disconnect(); gain.disconnect() }
    }
  }
  if (ending) note(261.6256, when, 5, 0.016)
  const start = when + (ending ? 3 : 0)
  ;[391.9954, 523.2512, 587.3295, 783.9909].forEach((frequency, i) => note(frequency, start + [0, 0.7, 1.4, 2.5][i], i === 3 ? 3 : 1.6, 0.012))
  if (ending) HARMONY.forEach(frequency => note(frequency, when + 7, 12, 0.01))
}

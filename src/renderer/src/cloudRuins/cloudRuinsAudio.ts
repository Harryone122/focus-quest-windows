import { timeOfDayAt } from '../../../shared/timeOfDay'
import birdsUrl from './audio/birds-isaiah658.ogg?url'

export interface CloudAudioState {
  progressSeconds: number
  paused: boolean
  muted: boolean
  environmentVolume: number
  musicVolume: number
}

/** The same smooth ten-minute daylight cycle used by the scene. */
export function cloudAudioMix(seconds: number) {
  const day = timeOfDayAt(seconds)
  const birds = { dawn: 1, day: 0.7, dusk: 0.22, night: 0 }
  return {
    birds: birds[day.from] + (birds[day.to] - birds[day.from]) * day.blend,
    gust: 0.56 + 0.25 * Math.sin(seconds * 0.075) + 0.12 * Math.sin(seconds * 0.19 + 1.4)
  }
}

export function createCloudRuinsAudio(initial: CloudAudioState) {
  const context = new AudioContext({ latencyHint: 'playback' })
  const master = context.createGain()
  const limiter = context.createDynamicsCompressor()
  limiter.threshold.value = -18; limiter.knee.value = 12; limiter.ratio.value = 4
  master.gain.value = 0
  master.connect(limiter); limiter.connect(context.destination)
  let state = { ...initial }, disposed = false, reportedAt = performance.now()
  let birdBuffer: AudioBuffer | null = null, nextBirdAt = 0, birdCount = 0
  let birdSource: AudioBufferSourceNode | null = null
  const abort = new AbortController()
  const sources: Array<AudioBufferSourceNode | OscillatorNode> = []
  const birdBus = context.createGain(); birdBus.connect(master)
  const musicBus = context.createGain(); musicBus.connect(master)
  const windBus = context.createGain(), leafBus = context.createGain(), waterBus = context.createGain()
  for (const bus of [birdBus, musicBus, windBus, leafBus, waterBus]) bus.gain.value = 0
  let suspendTimer: ReturnType<typeof setTimeout> | undefined

  // Pink noise, with a blended seam. All noise and musical layers are original synthesis.
  const noise = context.createBuffer(2, context.sampleRate * 16, context.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const samples = noise.getChannelData(channel)
    let brown = 0, smooth = 0
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1
      brown = (brown + white * 0.02) / 1.02
      smooth = smooth * 0.8 + white * 0.2
      samples[i] = brown * 2.8 + smooth * 0.3
    }
    const seam = Math.floor(context.sampleRate * 0.3)
    for (let i = 0; i < seam; i++) {
      const mix = i / seam
      samples[samples.length - seam + i] = samples[samples.length - seam + i] * (1 - mix) + samples[0] * mix
    }
  }
  const layer = (bus: GainNode, type: BiquadFilterType, frequency: number, offset: number) => {
    const source = context.createBufferSource(), filter = context.createBiquadFilter()
    source.buffer = noise; source.loop = true
    filter.type = type; filter.frequency.value = frequency; filter.Q.value = 0.35
    source.connect(filter); filter.connect(bus); bus.connect(master)
    source.start(0, offset); sources.push(source)
  }
  layer(windBus, 'lowpass', 420, 0)
  layer(leafBus, 'bandpass', 1650, 5)
  layer(waterBus, 'lowpass', 1100, 10)
  // Slow, beat-free suspended harmony; very quiet beneath the environment.
  for (const [index, frequency] of [130.8128, 196, 261.6256, 293.6648].entries()) {
    const oscillator = context.createOscillator(), voice = context.createGain(), pan = context.createStereoPanner()
    oscillator.type = 'sine'; oscillator.frequency.value = frequency
    voice.gain.value = index === 0 ? 0.38 : 0.2
    pan.pan.value = (index - 1.5) * 0.22
    oscillator.connect(voice); voice.connect(pan); pan.connect(musicBus)
    oscillator.start(); sources.push(oscillator)
  }

  const effectiveTime = () => state.progressSeconds + (state.paused ? 0 : Math.min(2, (performance.now() - reportedAt) / 1000))
  const volume = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)) / 100
  const wanted = () => !disposed && !state.paused && !state.muted && (state.environmentVolume > 0 || state.musicVolume > 0)
  const applyMix = () => {
    if (disposed) return
    const mix = cloudAudioMix(effectiveTime()), env = volume(state.environmentVolume), now = context.currentTime
    windBus.gain.setTargetAtTime(env * (0.17 + mix.gust * 0.18), now, 1.2)
    leafBus.gain.setTargetAtTime(env * (0.07 + mix.gust * 0.1), now, 1)
    waterBus.gain.setTargetAtTime(env * 0.12, now, 1.2)
    birdBus.gain.setTargetAtTime(env * 0.3 * mix.birds, now, 1.5)
    musicBus.gain.setTargetAtTime(volume(state.musicVolume) * 0.065, now, 2)
    if (!wanted() || context.state !== 'running' || !birdBuffer || now < nextBirdAt || mix.birds < 0.08 || env === 0) return
    // Short excerpts separated by silence, not a constant repeating bird chorus.
    const length = Math.min(5.5, birdBuffer.duration)
    const source = context.createBufferSource(), envelope = context.createGain(), pan = context.createStereoPanner()
    source.buffer = birdBuffer
    pan.pan.value = Math.sin(birdCount * 2.4) * 0.48
    envelope.gain.setValueAtTime(0, now)
    envelope.gain.linearRampToValueAtTime(0.85, now + 0.7)
    envelope.gain.setValueAtTime(0.85, now + Math.max(0.7, length - 1))
    envelope.gain.linearRampToValueAtTime(0, now + length)
    source.connect(envelope); envelope.connect(pan); pan.connect(birdBus)
    source.onended = () => { source.disconnect(); envelope.disconnect(); pan.disconnect(); if (birdSource === source) birdSource = null }
    source.start(now, (birdCount * 11.73) % Math.max(0.01, birdBuffer.duration - length), length)
    birdSource = source; birdCount++
    nextBirdAt = now + length + 16 + (birdCount * 7.17) % 18
  }
  const reconcile = () => {
    if (disposed) return
    clearTimeout(suspendTimer)
    applyMix()
    if (wanted()) {
      // A pointer/key event retries if the browser initially requires user activation.
      void context.resume().then(() => {
        if (wanted()) master.gain.setTargetAtTime(1, context.currentTime, 0.6)
      }).catch(() => {})
    } else {
      master.gain.setTargetAtTime(0, context.currentTime, 0.018)
      suspendTimer = setTimeout(() => { if (!wanted() && !disposed) void context.suspend().catch(() => {}) }, 120)
    }
  }
  const unlock = () => reconcile()
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
  const interval = setInterval(applyMix, 250)
  void fetch(birdsUrl, { signal: abort.signal }).then(response => {
    if (!response.ok) throw new Error('Bird ambience unavailable')
    return response.arrayBuffer()
  }).then(data => context.decodeAudioData(data)).then(buffer => { if (!disposed) { birdBuffer = buffer; nextBirdAt = context.currentTime + 3; applyMix() } }).catch(() => {})
  reconcile()
  return {
    update(next: CloudAudioState) { state = { ...next }; reportedAt = performance.now(); reconcile() },
    debugState() { return { context: context.state, birdReady: !!birdBuffer, birdCount, muted: state.muted, paused: state.paused, mix: cloudAudioMix(effectiveTime()) } },
    destroy() {
      if (disposed) return
      disposed = true; abort.abort(); clearInterval(interval); clearTimeout(suspendTimer)
      window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock)
      master.gain.setTargetAtTime(0, context.currentTime, 0.018)
      setTimeout(() => {
        for (const source of sources) { try { source.stop() } catch {} source.disconnect() }
        if (birdSource) { try { birdSource.stop() } catch {} }
        void context.close().catch(() => {})
      }, 120)
    }
  }
}

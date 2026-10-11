import { weatherAt } from '../../../shared/weather'

export interface MossAudioSettings { environmentVolume: number; musicVolume: number; audioMuted?: boolean }
export interface MossAudioMix { wind: number; grass: number; stream: number; rain: number; roof: number; drips: number; music: number }
const volume = (value: number) => Math.pow(Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)) / 100, 1.4)

/** Read the same saved seed and effective clock as the visible weather. */
export function mossAudioMix(seed: number, seconds: number, settings: MossAudioSettings): MossAudioMix {
  const weather = weatherAt(seed, seconds)
  const env = volume(settings.environmentVolume)
  const gust = 0.5 + 0.3 * Math.sin(seconds / 17 + seed % 19) + 0.2 * Math.sin(seconds / 41)
  return {
    wind: env * (0.18 + 0.10 * gust),
    grass: env * (0.025 + 0.05 * gust ** 3) * (1 - weather.rain * 0.65),
    stream: env * (0.12 + weather.wet * 0.025),
    rain: env * weather.rain * 0.34,
    roof: env * weather.rain * 0.09,
    drips: env * weather.wet * (1 - weather.rain) * 0.035,
    music: volume(settings.musicVolume) * 0.15
  }
}

/** Original procedural ambience: no downloads, repeating melody, or gameplay timers. */
export function buildMossAudioGraph(context: BaseAudioContext, seed: number) {
  let randomState = seed || 1
  const random = () => { randomState ^= randomState << 13; randomState ^= randomState >>> 17; randomState ^= randomState << 5; return (randomState >>> 0) / 4294967296 }
  const nodes: AudioNode[] = []
  const sources: Array<AudioBufferSourceNode | OscillatorNode> = []
  const output = context.createGain(); output.gain.value = 0.8
  const limiter = context.createDynamicsCompressor()
  limiter.threshold.value = -20; limiter.knee.value = 12; limiter.ratio.value = 4
  output.connect(limiter); limiter.connect(context.destination); nodes.push(output, limiter)
  const gains = {} as Record<keyof MossAudioMix, GainNode>
  const layer = (key: keyof MossAudioMix) => {
    const gain = context.createGain(); gain.gain.value = 0; gain.connect(output); nodes.push(gain); gains[key] = gain
    return gain
  }
  function noise(key: keyof MossAudioMix, duration: number, low: number, high: number, pink = true, droplets = false) {
    const sampleRate = 22050
    const buffer = context.createBuffer(2, Math.floor(sampleRate * duration), sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let brown = 0, drop = 0
      for (let i = 0; i < data.length; i++) {
        const white = random() * 2 - 1
        brown = 0.985 * brown + 0.015 * white
        if (droplets) { if (random() < 0.0009) drop = random() * 0.8; drop *= 0.975 }
        data[i] = droplets ? white * drop : pink ? brown * 3 + white * 0.09 : white * 0.23
      }
    }
    const source = context.createBufferSource(); source.buffer = buffer; source.loop = true
    const highpass = context.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = low
    const lowpass = context.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = high; lowpass.Q.value = 0.4
    source.connect(highpass); highpass.connect(lowpass); lowpass.connect(layer(key))
    source.start(); sources.push(source); nodes.push(source, highpass, lowpass)
  }
  noise('wind', 19.7, 75, 900)
  noise('grass', 23.3, 1000, 4000, false)
  noise('stream', 29.1, 240, 2500)
  noise('rain', 31.7, 350, 5500, false)
  noise('roof', 17.9, 900, 3200, false, true)
  noise('drips', 27.1, 1300, 4300, false, true)
  const bed = layer('music')
  const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 650; filter.connect(bed); nodes.push(filter)
  for (const [i, frequency] of [130.8128, 195.9977, 293.6648].entries()) {
    const oscillator = context.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = frequency
    oscillator.detune.value = (i - 1) * 3
    const voice = context.createGain(); voice.gain.value = 0.22; oscillator.connect(voice); voice.connect(filter)
    const breath = context.createOscillator(); breath.frequency.value = 1 / (49 + i * 13)
    const depth = context.createGain(); depth.gain.value = 0.045; breath.connect(depth); depth.connect(voice.gain)
    oscillator.start(); breath.start(); sources.push(oscillator, breath); nodes.push(oscillator, breath, voice, depth)
  }
  return {
    output,
    setMix(mix: MossAudioMix, smooth = true) {
      for (const key of Object.keys(gains) as Array<keyof MossAudioMix>) {
        const param = gains[key].gain
        param.cancelScheduledValues(context.currentTime)
        if (smooth) param.setTargetAtTime(mix[key], context.currentTime, 0.8)
        else param.setValueAtTime(mix[key], context.currentTime)
      }
    },
    dispose() { for (const source of sources) { try { source.stop() } catch { /* Already stopped. */ } }; for (const node of nodes) node.disconnect() }
  }
}

export function createMossSoundscape(seed: number, onBlocked: (blocked: boolean) => void = () => undefined) {
  const context = new AudioContext({ latencyHint: 'playback' })
  const graph = buildMossAudioGraph(context, seed)
  let paused = true, disposed = false, transition = 0
  async function unlock() {
    if (disposed || paused) return
    const version = transition
    try {
      onBlocked(context.state !== 'running')
      await context.resume()
      if (disposed) return
      if (paused || version !== transition) { if (paused) await context.suspend(); return }
      onBlocked(context.state !== 'running')
    } catch { if (!disposed) onBlocked(true) }
  }
  const gesture = () => void unlock()
  window.addEventListener('pointerdown', gesture)
  window.addEventListener('keydown', gesture)
  return {
    update(seconds: number, settings: MossAudioSettings, stopped: boolean) {
      if (disposed) return
      graph.setMix(mossAudioMix(seed, seconds, settings))
      const nextPaused = stopped || !!settings.audioMuted || (settings.environmentVolume === 0 && settings.musicVolume === 0)
      if (paused === nextPaused) return
      paused = nextPaused; transition++
      if (paused) { onBlocked(false); void context.suspend().catch(() => undefined) }
      else void unlock()
    },
    unlock,
    inspect: () => ({ state: context.state, paused, disposed }),
    dispose() {
      if (disposed) return
      disposed = true; transition++
      window.removeEventListener('pointerdown', gesture); window.removeEventListener('keydown', gesture)
      graph.dispose(); void context.close().catch(() => undefined)
    }
  }
}

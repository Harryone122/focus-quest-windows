export interface CampfireAudioSettings { environmentVolume: number; musicVolume?: number; audioMuted?: boolean }
export interface CampfireAudioScene { mode: string; idleT: number; t: number; stage: number; selected?: string | null }

export type DepartureCue = 'paper' | 'wood' | 'staff' | 'soil' | 'cloth' | 'metal' | 'spark' | 'glass' | 'stone'
export const departureCues: ReadonlyArray<{ at: number; kind: DepartureCue }> = [
  { at: 0.08, kind: 'paper' }, { at: 0.3, kind: 'wood' }, { at: 0.65, kind: 'staff' },
  { at: 0.85, kind: 'soil' }, { at: 1.1, kind: 'soil' }, { at: 1.35, kind: 'cloth' },
  { at: 1.5, kind: 'metal' }, { at: 1.78, kind: 'spark' }, { at: 2.05, kind: 'glass' },
  { at: 2.5, kind: 'cloth' }, ...[2.85, 3.23, 3.61, 3.99, 4.37, 4.75].map(at => ({ at, kind: 'soil' as const }))
]
/** Resumed/hidden animation skips old sounds rather than replaying a backlog. */
export function crossedDepartureCues(previous: number, current: number, way?: string | null) {
  return departureCues.filter(cue => cue.at > previous && cue.at <= current && current - cue.at <= 0.3)
    .map(cue => ({ ...cue, kind: cue.at >= 2.75 ? way === 'bridge' ? 'wood' as const : way === 'steps' ? 'stone' as const : cue.kind : cue.kind }))
}

const volume = (value: number) => Math.pow(Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)) / 100, 1.4)
export function campfireAudioMix(seconds: number, stage: number, settings: CampfireAudioSettings) {
  const env = settings.audioMuted ? 0 : volume(settings.environmentVolume)
  const gust = 0.5 + 0.3 * Math.sin(seconds / 19) + 0.2 * Math.sin(seconds / 43 + 1.7)
  return { fire: env * 0.62, wind: env * (0.13 + gust * 0.11), water: env * (0.09 + Math.sin(seconds / 11) * 0.015) * 0.5, tarp: stage >= 3 ? env * gust ** 2 * 0.055 : 0, detail: env * 0.13 }
}

export function campfireDepartureMix(seconds: number, stage: number, settings: CampfireAudioSettings) {
  const mix = campfireAudioMix(seconds, stage, settings)
  const distance = 1 - Math.max(0, Math.min(1, (seconds - 2.55) / 2.6))
  const boost = seconds >= 2.05 && seconds < 2.65 ? 0.35 * (1 - (seconds - 2.05) / 0.6) : 0
  return { ...mix, fire: mix.fire * distance * (1 + boost), water: mix.water * distance,
    wind: mix.wind * (distance + Math.max(0, Math.min(1, (seconds - 3.7) / 1.3)) * 1.15),
    tarp: mix.tarp * distance, detail: mix.detail * Math.max(0.18, distance) }
}

/** The listening-approved action mix, including texture ducking and the gentler flare. */
export function campfireActionMix(seconds: number, stage: number, settings: CampfireAudioSettings, way: 'bridge' | 'steps' | 'return') {
  const sceneTime = seconds < 5.05 ? seconds * 2.05 / 5.05 : seconds - 3
  const mix = way === 'return' ? campfireAudioMix(seconds, stage, settings) : campfireDepartureMix(sceneTime, stage, settings)
  if (way === 'return' && stage < 1) return mix
  if (way !== 'return') {
    const boost = sceneTime >= 2.05 && sceneTime < 2.65 ? 1 - (sceneTime - 2.05) / 0.6 : 0
    mix.fire = mix.fire / (1 + 0.35 * boost) * (1 + 0.12 * boost)
  }
  let duck = 1
  for (const event of campfireActionPlans[way].filter(event => !event.quiet)) {
    if (seconds < event.main - 0.3 || seconds > event.actualEnd + 1) continue
    const before = Math.min(1, Math.max(0, (seconds - event.main + 0.3) / 0.3)), after = Math.min(1, Math.max(0, seconds - event.actualEnd))
    duck = Math.min(duck, seconds < event.main ? 1 - 0.7 * before : 0.3 + 0.7 * after)
  }
  for (const key of ['fire', 'wind', 'water', 'tarp'] as const) mix[key] *= duck
  return mix
}

/** Original local synthesis. Scene motion supplies detail cues, never game results. */
export function buildCampfireAudioGraph(context: BaseAudioContext, seed = 481) {
  let state = seed || 1
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296 }
  const nodes: AudioNode[] = [], sources = new Set<AudioBufferSourceNode>()
  const actionSources = new Set<AudioScheduledSourceNode>()
  const actionEnvelopes = new Map<AudioScheduledSourceNode, GainNode>()
  let scheduledEventNames: string[] = []
  const actionBuffers: Partial<Record<CampfireActionName, AudioBuffer>> = {}
  let actionsReady = false
  const actionBus = context.createGain(); actionBus.gain.value = 0; actionBus.connect(context.destination); nodes.push(actionBus)
  const output = context.createGain(); output.gain.value = 0.8
  const limiter = context.createDynamicsCompressor()
  limiter.threshold.value = -18; limiter.knee.value = 12; limiter.ratio.value = 4
  output.connect(limiter); limiter.connect(context.destination); nodes.push(output, limiter)
  const gains = {} as Record<keyof ReturnType<typeof campfireAudioMix>, GainNode>
  const birdsGain = context.createGain(); birdsGain.gain.value = 0; birdsGain.connect(output); nodes.push(birdsGain)
  const calibrations: Partial<Record<CampfireAssetKey, AssetCalibration>> = {}
  const layers = new Map<string, AudioBufferSourceNode>()
  const layerVoices = new Map<string, GainNode>()
  let birdsBuffer: AudioBuffer | null = null
  const music = context.createGain(); music.gain.value = 0; music.connect(output); nodes.push(music)
  for (const key of ['fire', 'wind', 'water', 'tarp', 'detail'] as const) {
    const gain = context.createGain(); gain.gain.value = 0; gain.connect(output); gains[key] = gain; nodes.push(gain)
  }
  function buffer(duration: number, kind: 'fire' | 'wind' | 'water' | 'tarp' | 'cloth' | 'wood') {
    const rate = 22050, result = context.createBuffer(2, Math.ceil(rate * duration), rate)
    for (let channel = 0; channel < 2; channel++) {
      const data = result.getChannelData(channel)
      let brown = 0, ember = 0
      for (let i = 0; i < data.length; i++) {
        const white = random() * 2 - 1, t = i / rate
        brown = 0.985 * brown + white * 0.015
        if (random() < 1.7 / rate) ember = 0.25 + random() * 0.55
        ember *= 0.993
        const wave = Math.sin(t * 2.1) * Math.sin(t * 0.71 + channel)
        data[i] = kind === 'fire' ? brown * 2.1 + white * (0.035 + ember)
          : kind === 'wind' ? brown * 3
          : kind === 'water' ? brown * 1.5 + white * 0.06 * (0.8 + wave * 0.2)
          : kind === 'wood' ? (Math.sin(t * 2 * Math.PI * (180 + 24 * Math.sin(t * 9))) * 0.12 + brown * 0.5) * Math.sin(Math.PI * i / data.length) ** 2
          : white * 0.18 * (0.5 + 0.5 * Math.sin(t * 17)) * (kind === 'cloth' ? Math.sin(Math.PI * i / data.length) ** 2 : 1)
      }
      // Periodic interpolation into the beginning removes a hard loop boundary.
      if (kind !== 'cloth' && kind !== 'wood') {
        const seam = Math.floor(rate * 0.6)
        const start = data.slice(0, seam)
        for (let i = 0; i < seam; i++) {
          const mix = i / (seam - 1)
          data[data.length - seam + i] = data[data.length - seam + i] * (1 - mix) + start[i] * mix
        }
      }
    }
    return result
  }
  function connect(source: AudioBufferSourceNode, bus: GainNode, low: number, high: number, panValue: number, recording = false) {
    const hp = context.createBiquadFilter(), lp = context.createBiquadFilter(), pan = context.createStereoPanner()
    hp.type = 'highpass'; hp.frequency.value = low; lp.type = 'lowpass'; lp.frequency.value = high; lp.Q.value = 0.4; pan.pan.value = panValue
    if (recording) source.connect(pan)
    else { source.connect(hp); hp.connect(lp); lp.connect(pan) }
    pan.connect(bus)
    sources.add(source)
    source.onended = () => { sources.delete(source); source.disconnect(); hp.disconnect(); lp.disconnect(); pan.disconnect() }
    return source
  }
  for (const [key, duration, low, high, pan] of [
    ['fire', 47.3, 100, 3400, -0.12], ['wind', 31.7, 65, 650, 0.1],
    ['water', 37.9, 180, 1400, 0.35], ['tarp', 29.1, 600, 2400, -0.4]
  ] as const) {
    const source = context.createBufferSource(); source.buffer = buffer(duration, key); source.loop = true; source.loopStart = 0.6
    const voice = context.createGain(); voice.gain.value = 1; voice.connect(gains[key]); nodes.push(voice)
    connect(source, voice, low, high, pan).start()
    layers.set(key, source)
    layerVoices.set(key, voice)
  }
  const cloth = buffer(0.85, 'cloth'), wood = buffer(0.65, 'wood')
  function transient(kind: DepartureCue) {
    const rate = 22050, duration = kind === 'spark' ? 0.24 : kind === 'paper' ? 0.3 : 0.18
    const result = context.createBuffer(1, Math.ceil(rate * duration), rate), data = result.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / rate, envelope = Math.min(1, t / 0.012) * Math.exp(-t / (duration * 0.22))
      const noise = (random() * 2 - 1) * (kind === 'spark' ? 0.23 : 0.13)
      const tone = kind === 'metal' ? Math.sin(2 * Math.PI * 1450 * t) * 0.06
        : kind === 'staff' || kind === 'stone' ? Math.sin(2 * Math.PI * (kind === 'stone' ? 420 : 210) * t) * 0.15 : 0
      data[i] = (noise + tone) * envelope
    }
    return result
  }
  const transients = Object.fromEntries(['paper', 'staff', 'soil', 'metal', 'spark', 'stone'].map(kind => [kind, transient(kind as DepartureCue)])) as Record<string, AudioBuffer>
  let disposed = false
  const graph = {
    installActions(assets: Awaited<ReturnType<typeof loadCampfireActions>>) {
      if (!disposed) { Object.assign(actionBuffers, assets); actionsReady = true }
    },
    setActionVolume(settings: CampfireAudioSettings, smooth = true) {
      const value = settings.audioMuted ? 0 : volume(settings.environmentVolume) * 0.8
      actionBus.gain.setTargetAtTime(value, context.currentTime, smooth ? 0.025 : 0.000001)
    },
    cancelActions() {
      for (const source of actionSources) {
        const envelope = actionEnvelopes.get(source)
        if (envelope) { envelope.gain.cancelScheduledValues(context.currentTime); envelope.gain.setValueAtTime(envelope.gain.value, context.currentTime); envelope.gain.linearRampToValueAtTime(0, context.currentTime + 0.025) }
        try { source.stop(context.currentTime + (envelope ? 0.025 : 0)) } catch { /* Already stopped. */ }
      }
      actionSources.clear(); scheduledEventNames = []
    },
    scheduleActions(way: 'bridge' | 'steps' | 'return', elapsed: number, when = context.currentTime, stage = 3): void {
      for (const event of campfireActionPlans[way]) {
        if (way === 'return' && stage < 1) continue
        if (event.actualStart < elapsed - 0.3 || event.actualEnd <= elapsed) continue
        const buffer = actionBuffers[event.name]
        if (!buffer) {
          const fallback: Partial<Record<CampfireActionName, DepartureCue>> = { dep_notebook_close: 'paper', dep_log_creak: 'wood', dep_staff_tap: 'staff', dep_steps_dirt: 'soil', dep_cloth_kneel: 'cloth', dep_cloth_rise: 'cloth', dep_lantern_clink: 'metal', dep_ember_spark: 'spark', bridge_plank_step_a: 'wood', bridge_plank_step_b: 'wood', bridge_plank_step_c: 'wood', stone_step_dry_a: 'stone', stone_step_dry_b: 'stone', stone_step_dry_c: 'stone' }
          const kind = fallback[event.name]
          if (kind && event.main >= elapsed - 0.3) { graph.cue(kind, when + Math.max(0, event.main - elapsed), true); scheduledEventNames.push(event.name) }
          continue
        }
        const start = when + Math.max(0, event.actualStart - elapsed), end = when + event.actualEnd - elapsed
        const source = context.createBufferSource(), envelope = context.createGain()
        source.buffer = buffer; source.playbackRate.value = event.rate
        const fade = Math.min(event.fade ?? 0.035, (end - start) / 3)
        envelope.gain.setValueAtTime(0, start); envelope.gain.linearRampToValueAtTime(event.gain, start + Math.min(0.006, (end - start) / 3))
        envelope.gain.setValueAtTime(event.gain, Math.max(start + 0.006, end - fade)); envelope.gain.linearRampToValueAtTime(0, end)
        source.connect(envelope); envelope.connect(actionBus); actionSources.add(source); actionEnvelopes.set(source, envelope); scheduledEventNames.push(event.name)
        source.onended = () => { actionSources.delete(source); actionEnvelopes.delete(source); source.disconnect(); envelope.disconnect() }
        source.start(start, event.offset + Math.max(0, elapsed - event.actualStart) * event.rate); source.stop(end)
      }
      if (way !== 'return' && 5.05 >= elapsed - 0.3) graph.cue('glass', when + Math.max(0, 5.05 - elapsed), true)
      if (way === 'return') for (const [at, kind] of [[2, 'cloth'], [2.15, 'wood']] as const) if (at >= elapsed - 0.3) graph.cue(kind, when + Math.max(0, at - elapsed), true)
    },
    installAssets(assets: Awaited<ReturnType<typeof loadCampfireAssets>>) {
      if (disposed) return
      for (const [key, prepared] of Object.entries(assets) as Array<[CampfireAssetKey, NonNullable<typeof assets[CampfireAssetKey]>]>) {
        calibrations[key] = prepared.calibration
        if (key === 'birds') { birdsBuffer = prepared.buffer; continue }
        const source = context.createBufferSource(); source.buffer = prepared.buffer; source.loop = true; source.loopStart = prepared.calibration.loopStart
        const voice = context.createGain(); voice.gain.value = 0; voice.connect(gains[key]); nodes.push(voice)
        voice.gain.setValueAtTime(0, context.currentTime)
        const offsets = { fire: 0.6, wind: 4.1, water: 8.7, tarp: 11.2 }
        connect(source, voice, 0, 0, key === 'water' ? 0.35 : key === 'tarp' ? -0.4 : 0, true)
          .start(context.currentTime, Math.min(prepared.buffer.duration - 0.1, offsets[key]))
        voice.gain.linearRampToValueAtTime(1, context.currentTime + 0.3)
        const oldVoice = layerVoices.get(key)
        if (oldVoice) { oldVoice.gain.setValueAtTime(oldVoice.gain.value, context.currentTime); oldVoice.gain.linearRampToValueAtTime(0, context.currentTime + 0.3) }
        const old = layers.get(key); if (old) { try { old.stop(context.currentTime + 0.3) } catch { /* Already stopped. */ } }
        layers.set(key, source)
        layerVoices.set(key, voice)
      }
    },
    setBirdVolume(settings: CampfireAudioSettings, stage: number, when = context.currentTime) {
      birdsGain.gain.setTargetAtTime(stage === 5 && !settings.audioMuted ? volume(settings.environmentVolume) * 0.14 : 0, when, 0.15)
    },
    bird(index: number, when = context.currentTime) {
      if (disposed || !birdsBuffer) return false
      const source = context.createBufferSource(), envelope = context.createGain(); source.buffer = birdsBuffer
      envelope.gain.setValueAtTime(0, when); envelope.gain.linearRampToValueAtTime(1, when + 0.7); envelope.gain.setValueAtTime(1, when + 4); envelope.gain.linearRampToValueAtTime(0, when + 5)
      envelope.connect(birdsGain)
      connect(source, envelope, 0, 0, Math.sin(index * 2.4) * 0.48, true).start(when, (index * 6.73) % Math.max(0.01, birdsBuffer.duration - 5), 5)
      source.addEventListener('ended', () => envelope.disconnect(), { once: true }); return true
    },
    inspectAssets: () => ({ calibrations, birdsReady: !!birdsBuffer, actionsReady, actionAssetCount: Object.keys(actionBuffers).length, scheduledActionSources: actionSources.size, scheduledEventNames: [...scheduledEventNames] }),
    fadeOut() { output.gain.setTargetAtTime(0, context.currentTime, 0.025); actionBus.gain.setTargetAtTime(0, context.currentTime, 0.025) },
    setMusic(settings: CampfireAudioSettings, smooth = true) {
      const value = settings.audioMuted ? 0 : volume(settings.musicVolume ?? 0)
      music.gain.cancelScheduledValues(context.currentTime)
      if (smooth) music.gain.setTargetAtTime(value, context.currentTime, 0.025)
      else music.gain.setValueAtTime(value, context.currentTime)
    },
    setMix(mix: ReturnType<typeof campfireAudioMix>, smooth = true, fadeSeconds = 0.65, when = context.currentTime) {
      for (const key of Object.keys(gains) as Array<keyof typeof gains>) {
        const param = gains[key].gain; param.cancelScheduledValues(when)
        if (smooth) param.setTargetAtTime(mix[key], when, fadeSeconds)
        else param.setValueAtTime(mix[key], when)
      }
    },
    cue(kind: DepartureCue, when = context.currentTime, action = false): void {
      if (disposed) return
      if (kind === 'glass') {
        for (const [multiple, level] of [[1, 0.018], [2, 0.0035], [3, 0.0015]]) {
          const oscillator = context.createOscillator(), envelope = context.createGain()
          oscillator.frequency.value = 261.63 * multiple
          envelope.gain.setValueAtTime(0, when); envelope.gain.linearRampToValueAtTime(level, when + 0.015)
          envelope.gain.exponentialRampToValueAtTime(0.000001, when + 3)
          oscillator.connect(envelope); envelope.connect(music)
          if (action) { actionSources.add(oscillator); actionEnvelopes.set(oscillator, envelope) }
          nodes.push(oscillator, envelope); oscillator.start(when); oscillator.stop(when + 3.02)
          oscillator.onended = () => { actionSources.delete(oscillator); actionEnvelopes.delete(oscillator); oscillator.disconnect(); envelope.disconnect() }
        }
        return
      }
      const source = context.createBufferSource(); source.buffer = transients[kind] ?? (kind === 'cloth' ? cloth : wood)
      if (action) { actionSources.add(source); source.addEventListener('ended', () => actionSources.delete(source), { once: true }) }
      connect(source, gains.detail, kind === 'cloth' || kind === 'paper' || kind === 'spark' ? 650 : 100,
        kind === 'spark' ? 6500 : kind === 'cloth' || kind === 'paper' ? 2700 : kind === 'metal' ? 3500 : 850, -0.25).start(when)
    },
    dispose() {
      disposed = true
      graph.cancelActions()
      for (const source of sources) { try { source.stop() } catch { /* Already stopped. */ }; source.disconnect() }
      sources.clear(); for (const node of nodes) node.disconnect()
    }
  }
  return graph
}

export function createCampfireSoundscape() {
  const context = new AudioContext({ latencyHint: 'playback' }), graph = buildCampfireAudioGraph(context)
  const abort = new AbortController()
  void loadCampfireAssets(context, abort.signal).then(assets => { if (!disposed) graph.installAssets(assets) }).catch(() => undefined)
  void loadCampfireActions(context, abort.signal).then(assets => { if (!disposed) graph.installActions(assets) }).catch(() => undefined)
  let stopped = true, disposed = false, revision = 0, previous: CampfireAudioScene | null = null
  let birdIndex = 0, nextBirdAt = Infinity
  let scheduledMode: string | null = null, scheduledEpoch = 0
  let suspendTimer: ReturnType<typeof setTimeout> | undefined
  async function unlock() {
    if (stopped || disposed) return
    const version = revision
    try { await context.resume(); if (!disposed && stopped && version !== revision) await context.suspend() } catch { /* A later gesture can retry. */ }
  }
  const gesture = () => void unlock()
  window.addEventListener('pointerdown', gesture); window.addEventListener('keydown', gesture)
  return {
    update(scene: CampfireAudioScene, settings: CampfireAudioSettings, inactive = false) {
      if (disposed) return
      const departing = scene.mode === 'depart' || scene.mode === 'gone'
      const nextStopped = inactive || !!settings.audioMuted || (!(settings.environmentVolume > 0) && (!departing || !(settings.musicVolume && settings.musicVolume > 0)))
      const way = scene.mode === 'return' ? 'return' : scene.selected === 'steps' ? 'steps' : 'bridge'
      const actionMode = departing ? 'depart' : scene.mode === 'return' ? 'return' : null
      const mix = actionMode ? campfireActionMix(scene.t, scene.stage, settings, way) : campfireAudioMix(context.currentTime, scene.stage, settings)
      graph.setMix(nextStopped ? { fire: 0, wind: 0, water: 0, tarp: 0, detail: 0 } : mix, true, nextStopped ? 0.025 : departing ? 0.04 : 0.65)
      graph.setMusic(nextStopped ? { ...settings, audioMuted: true } : settings)
      graph.setActionVolume(nextStopped ? { ...settings, audioMuted: true } : settings)
      graph.setBirdVolume(nextStopped ? { ...settings, audioMuted: true } : settings, scene.stage)
      if (scene.stage === 5 && previous?.stage !== 5) nextBirdAt = context.currentTime + 8
      if (!nextStopped && !departing && scene.stage === 5 && context.state === 'running' && context.currentTime >= nextBirdAt) {
        if (graph.bird(birdIndex)) { birdIndex++; nextBirdAt = context.currentTime + 5 + 16 + (birdIndex * 7.17) % 18 }
      }
      if (nextStopped || !actionMode || scheduledMode && (scheduledMode !== actionMode || Math.abs(context.currentTime - scene.t - scheduledEpoch) > 0.35)) {
        graph.cancelActions(); scheduledMode = null
      }
      if (!nextStopped && actionMode && !scheduledMode && graph.inspectAssets().actionsReady) {
        graph.scheduleActions(way, scene.t, context.currentTime, scene.stage)
        scheduledMode = actionMode; scheduledEpoch = context.currentTime - scene.t
      }
      if (!nextStopped && !stopped && context.state === 'running' && previous) {
        const prevCycle = previous.idleT % 13, cycle = scene.idleT % 13
        if (scene.mode === 'idle' && previous.mode === 'idle' && prevCycle < 8 && cycle >= 8) graph.cue('cloth')
      }
      previous = { ...scene }
      if (nextStopped === stopped) return
      stopped = nextStopped; revision++; clearTimeout(suspendTimer)
      if (stopped) {
        suspendTimer = setTimeout(() => { if (stopped && !disposed) void context.suspend().catch(() => undefined) }, 500)
      } else void unlock()
    },
    inspect: () => ({ state: context.state, stopped, disposed, birdIndex, ...graph.inspectAssets() }),
    dispose() {
      if (disposed) return
      disposed = true; revision++; clearTimeout(suspendTimer)
      abort.abort()
      window.removeEventListener('pointerdown', gesture); window.removeEventListener('keydown', gesture)
      graph.fadeOut()
      setTimeout(() => { graph.dispose(); void context.close().catch(() => undefined) }, 150)
    }
  }
}
import { loadCampfireAssets, type CampfireAssetKey, type AssetCalibration } from './campfireAssets'
import { campfireActionPlans, loadCampfireActions, type CampfireActionName } from './campfireActions'
export { loadCampfireAssets } from './campfireAssets'
export { loadCampfireActions, campfireActionPlans } from './campfireActions'

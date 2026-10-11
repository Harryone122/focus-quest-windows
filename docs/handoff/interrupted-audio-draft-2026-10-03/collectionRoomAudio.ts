import { audioVolume, buildHarmony, harmonyLevel, HARMONY, type AudioSettings } from './harmony'

export interface RoomAudioEvent { kind: string; core: number; at: number }
export interface RoomAudioState {
  time: number; motionTime: number; selected: number | null; cores: number[]; tracking: string | null
  linked: boolean; linkTime: number; journeys: number; book: boolean; spread: number; events: RoomAudioEvent[]
}

/** Adds a read-only audio bridge to the embedded design; the original prototype stays intact. */
export function wireRoomAudio(html: string): string {
  const substitutions: Array<[string, string]> = [
    ['function update(dt) {', `const roomAudioEvents = []; let audioPlacement = 0;
      function roomSound(kind, core = 0, delay = 0) { roomAudioEvents.push({kind, core, at:time+delay}); if(roomAudioEvents.length>64)roomAudioEvents.shift(); }
      function readAudioState() {
        const due=roomAudioEvents.filter(e=>e.at<=time); for(let i=roomAudioEvents.length-1;i>=0;i--)if(roomAudioEvents[i].at<=time)roomAudioEvents.splice(i,1);
        return {time,motionTime:reduceMotion?time*0.3:time,selected:S.sel&&S.sel.i||null,cores:EX.map(e=>e?e.state:0),tracking:S.tracking,linked:S.linked,linkTime:S.linkT,journeys:S.journeys||0,book:!$('bookWrap').hidden,spread:S.spread,events:due.filter(e=>time-e.at<=0.3)};
      }
      function update(dt) {`],
    ["window.__room = { S, EX,", "window.__room = { readAudioState, S, EX,"],
    ['if (lastSec >= 0 && running) shake = 1;', "if (lastSec >= 0 && running) { shake = 1; roomSound('tick',9); }"],
    ['function playHand(target, mode, onTouch, carry) {', `function playHand(target, mode, onTouch, carry) {
      audioPlacement = carry ? (EX.find(e=>e&&e.core===carry)||{}).i||0 : 0;
      if(audioPlacement && !reduceMotion){roomSound('cloth',audioPlacement);roomSound('cloth',audioPlacement,1.15);}`],
    ['function playBlue(anchor) {', "function playBlue(anchor) { if(audioPlacement){roomSound('place',audioPlacement);audioPlacement=0;}"],
    ['const H = reduceMotion ? 0 : 0.8;', `const H = reduceMotion ? 0 : 0.8;
      roomSound('paper',0,H);roomSound('pin',0,H+0.04);
      if(c.kind==='way')roomSound('thread',0,H+0.25);
      if(c.place&&!before.located&&after.located)roomSound('intersection',0,H+1.0);`],
    ["const go = () => draw();", "const go = () => { roomSound('paper'); draw(); };"],
    ["if (letter.visible) { lt = (lt + dt / 9) % 1;", "if (letter.visible) { const beforeLetter=lt; lt = (lt + dt / 9) % 1; if(lt<beforeLetter)roomSound('paper',6);"],
    ["const turn = ease(clamp((ph - 0.6) / 0.3, 0, 1));", "const turn = ease(clamp((ph - 0.6) / 0.3, 0, 1)); if(e.state>0&&S.sel===e&&ph>=0.6&&((t-dt)%per)/per<0.6)roomSound('paper',8);"],
  ]
  for (const [needle, replacement] of substitutions) {
    if (!html.includes(needle)) return html // Audio must never prevent a scene loading.
    html = html.replace(needle, replacement)
  }
  return html
}

export const roomEchoSeconds = (count: number) => 1.8 - Math.max(0, Math.min(10, count)) * 0.13
export const coreDetune = (state: number) => state > 1 ? 0 : -18
export function roomAudioMix(scene: RoomAudioState, settings: AudioSettings, duck = 1) {
  const env = settings.audioMuted ? 0 : audioVolume(settings.environmentVolume)
  const focus = (core: number) => scene.selected === core ? 2 : scene.selected ? 0.5 : 1
  const stoneState = scene.cores[5] ?? 0, stonePhase = (scene.motionTime % (stoneState > 1 ? 4.5 : 8)) / (stoneState > 1 ? 4.5 : 8)
  const hornPhase = (scene.motionTime % 7) / 7
  const linking = scene.linkTime >= 0 && scene.linkTime < 8
  const selectedOther = scene.selected !== null && ![5, 6, 9].includes(scene.selected)
  return {
    air: env * 0.015, harmony: harmonyLevel(settings),
    stone: stoneState > 0 && stonePhase < 0.3 ? env * 0.018 * Math.sin(Math.PI * stonePhase / 0.3) * focus(5) * duck : 0,
    horn: scene.cores[6] > 0 && !selectedOther && hornPhase < 0.4 ? env * 0.04 * Math.sin(Math.PI * hornPhase / 0.4) * focus(6) * duck : 0,
    eye: scene.selected === 10 && scene.cores[10] > 0 ? env * 0.027 * (1 - (scene.linked ? 1 : scene.cores.filter(x => x > 0).length / 10) * 0.85) : 0,
    link: linking ? env * 0.012 * Math.min(1, Math.max(0, (scene.linkTime - 0.4) / 1.8)) * Math.min(1, Math.max(0, (7.8 - scene.linkTime) / 1.8)) : 0
  }
}

export function buildRoomAudioGraph(context: BaseAudioContext, seed = 3107) {
  const sources = new Set<AudioScheduledSourceNode>(), nodes: AudioNode[] = []
  const output = context.createGain(); output.gain.value = 0; output.connect(context.destination); nodes.push(output)
  const buses = {} as Record<'air' | 'harmony' | 'stone' | 'horn' | 'eye' | 'link' | 'physical' | 'tone', GainNode>
  for (const key of ['air', 'harmony', 'stone', 'horn', 'eye', 'link', 'physical', 'tone'] as const) {
    const bus = context.createGain(); bus.gain.value = 0; bus.connect(output); buses[key] = bus; nodes.push(bus)
  }
  const harmony = buildHarmony(context, buses.harmony)
  // Physical sounds and notes get a shrinking echo; room air stays dry.
  const echoIn = context.createGain(), delay = context.createDelay(2), feedback = context.createGain(), echoOut = context.createGain()
  delay.delayTime.value = 0.19; feedback.gain.value = Math.exp(-6.9 * 0.19 / 1.8); echoOut.gain.value = 0.17
  echoIn.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(echoOut); echoOut.connect(output)
  buses.physical.connect(echoIn); buses.tone.connect(echoIn)
  nodes.push(echoIn, delay, feedback, echoOut)
  let randomState = seed
  const random = () => { randomState ^= randomState << 13; randomState ^= randomState >>> 17; randomState ^= randomState << 5; return (randomState >>> 0) / 4294967296 }
  function noise(duration: number) {
    const buffer = context.createBuffer(1, Math.ceil(22050 * duration), 22050), data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1
    return buffer
  }
  function loopNoise(bus: GainNode, cutoff: number) {
    const source = context.createBufferSource(), filter = context.createBiquadFilter()
    source.buffer = noise(17); source.loop = true; filter.type = 'lowpass'; filter.frequency.value = cutoff; filter.Q.value = 0.4
    source.connect(filter); filter.connect(bus); source.start(); sources.add(source); nodes.push(source, filter)
  }
  loopNoise(buses.air, 360); loopNoise(buses.horn, 650); loopNoise(buses.eye, 500)
  const stone = context.createOscillator(), stone2 = context.createOscillator(), harmonic = context.createGain()
  stone.frequency.value = 97.9989; stone2.frequency.value = 195.9977; harmonic.gain.value = 0
  stone.connect(buses.stone); stone2.connect(harmonic); harmonic.connect(buses.stone); stone.start(); stone2.start()
  sources.add(stone); sources.add(stone2); nodes.push(stone, stone2, harmonic)
  const coreFrequencies = [261.6256, 195.9977, 293.6648, 391.9954, 97.9989, 130.8128, 523.2512, 261.6256, 783.9909, 1174.659]
  const linkVoices = coreFrequencies.map((frequency, i) => {
    const source = context.createOscillator(), gain = context.createGain()
    source.frequency.value = frequency; source.type = i === 5 ? 'triangle' : 'sine'; gain.gain.value = 0.048
    source.connect(gain); gain.connect(buses.link); source.start(); sources.add(source); nodes.push(source, gain); return source
  })
  let disposed = false, peakVoices = 0
  const voices = new Set<{ source: AudioScheduledSourceNode; envelope: GainNode; priority: number; until: number }>()
  function reserve(priority: number, when: number) {
    for (const voice of voices) if (voice.until <= when) voices.delete(voice)
    // Two continuous objects plus one transient; feedback can replace an ordinary tick.
    if (voices.size >= 1) {
      const lower = [...voices].find(v => v.priority < priority)
      if (!lower) return false
      lower.envelope.gain.setTargetAtTime(0, when, 0.01); lower.source.stop(when + 0.04); voices.delete(lower)
    }
    return true
  }
  function oneShot(kind: string, core: number, when: number, detune = 0) {
    if (disposed) return
    const pitched = ['glass', 'intersection', 'lamp'].includes(kind)
    const priority = pitched || kind === 'place' ? 2 : kind === 'tick' ? 0 : 1
    if (!reserve(priority, when)) return
    const duration = pitched ? 1.8 : kind === 'paper' || kind === 'cloth' ? 0.38 : kind === 'thread' ? 0.22 : 0.12
    const envelope = context.createGain(), pan = context.createStereoPanner()
    pan.pan.value = Math.max(-0.65, Math.min(0.65, (core - 5) * 0.11))
    envelope.gain.setValueAtTime(0, when); envelope.gain.linearRampToValueAtTime(pitched ? 0.015 : kind === 'place' ? 0.14 : 0.055, when + 0.012)
    envelope.gain.exponentialRampToValueAtTime(0.000001, when + duration)
    let source: AudioBufferSourceNode | OscillatorNode
    if (pitched || kind === 'water') {
      source = context.createOscillator(); source.frequency.value = kind === 'intersection' ? 391.9954 : 261.6256; source.detune.value = detune
      if (kind === 'water') source.frequency.exponentialRampToValueAtTime(120, when + duration)
    } else {
      source = context.createBufferSource(); source.buffer = noise(duration)
    }
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'
    const material = [0, 1900, 3300, 1300, 1400, 500, 420, 2100, 1000, 2700, 3200][core] || 1400
    filter.frequency.value = kind === 'tick' || kind === 'pin' ? 3800 : kind === 'place' ? material : kind === 'paper' || kind === 'cloth' ? 2400 : 900
    source.connect(filter); filter.connect(envelope); envelope.connect(pan)
    pan.connect(pitched ? buses.tone : buses.physical)
    // Echo follows the same saved channel setting, including zero/mute.
    const record = { source, envelope, priority, until: when + duration + 0.02 }; voices.add(record); sources.add(source); peakVoices = Math.max(peakVoices, voices.size + 2)
    source.onended = () => { voices.delete(record); sources.delete(source); source.disconnect(); filter.disconnect(); envelope.disconnect(); pan.disconnect() }
    source.start(when); source.stop(when + duration + 0.02)
  }
  return {
    output,
    update(scene: RoomAudioState, settings: AudioSettings, active: boolean, duck = 1, when = context.currentTime) {
      const mix = roomAudioMix(scene, settings, duck), count = scene.cores.filter(x => x > 0).length
      output.gain.setTargetAtTime(active && !settings.audioMuted ? 0.65 : 0, when, active ? 0.16 : 0.025)
      for (const key of ['air', 'harmony', 'stone', 'horn', 'eye', 'link'] as const) buses[key].gain.setTargetAtTime(mix[key], when, key === 'harmony' ? 0.5 : 0.06)
      const env = settings.audioMuted ? 0 : audioVolume(settings.environmentVolume), music = settings.audioMuted ? 0 : audioVolume(settings.musicVolume ?? 0)
      buses.physical.gain.setValueAtTime(env * 0.12, when); buses.tone.gain.setValueAtTime(music, when)
      echoIn.gain.setValueAtTime(1, when)
      feedback.gain.setTargetAtTime(Math.exp(-6.9 * 0.19 / roomEchoSeconds(count)), when, 0.4)
      stone.detune.setTargetAtTime(coreDetune(scene.cores[5]), when, 0.25); stone2.detune.setTargetAtTime(coreDetune(scene.cores[5]), when, 0.25)
      harmonic.gain.setTargetAtTime(scene.cores[5] > 1 ? 0.12 : 0, when, 0.25)
      for (const [i, source] of linkVoices.entries()) {
        const align = Math.min(1, Math.max(0, (scene.linkTime - 2.2) / 1.4))
        source.frequency.setTargetAtTime(coreFrequencies[i] * (1 - align) + HARMONY[i % 4] * align, when, 0.06)
        source.detune.setTargetAtTime(scene.linkTime >= 0 ? -18 * (1 - align) : 0, when, 0.1)
      }
    },
    cue(kind: string, core = 0, when = context.currentTime, detune = 0) { oneShot(kind, core, when, detune) },
    inspect: () => ({ peakVoices, voices: voices.size }),
    dispose() { disposed = true; harmony.dispose(); for (const source of sources) { try { source.stop() } catch { /* Already ended. */ } }; sources.clear(); for (const node of nodes) node.disconnect() }
  }
}

export function createRoomSoundscape() {
  const context = new AudioContext({ latencyHint: 'playback' }), graph = buildRoomAudioGraph(context)
  let previous: RoomAudioState | null = null, activeBefore = false, disposed = false, feedbackUntil = -1
  let suspendTimer: ReturnType<typeof setTimeout> | undefined
  let wanted = false, opened = false, seenJourneys: number | null = null
  const unlock = () => { if (wanted && !disposed) void context.resume().catch(() => undefined) }
  window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock)
  return {
    update(scene: RoomAudioState, settings: AudioSettings, active: boolean) {
      if (disposed) return
      wanted = active && !settings.audioMuted && (settings.environmentVolume > 0 || (settings.musicVolume ?? 0) > 0)
      if (wanted) { clearTimeout(suspendTimer); unlock() }
      else if (!suspendTimer) suspendTimer = setTimeout(() => { suspendTimer = undefined; if (!wanted && !disposed) void context.suspend().catch(() => undefined) }, 180)
      if (active && !activeBefore) {
        graph.cue('cloth'); graph.cue('pin', 2, context.currentTime + 0.42); opened = true
        if (seenJourneys !== null && scene.journeys > seenJourneys && scene.cores[7] > 0) graph.cue('cloth', 7, context.currentTime + 0.65)
        seenJourneys = scene.journeys
      }
      if (!active && activeBefore && opened) graph.cue('cloth')
      if (active && previous && activeBefore) {
        if (scene.tracking !== previous.tracking && scene.cores[2] > 0) {
          for (let i = 0; i < 3; i++) graph.cue('tick', 2, context.currentTime + i * 0.16)
        }
        if (scene.journeys > previous.journeys && scene.cores[7] > 0) graph.cue('cloth', 7)
        if (scene.spread !== previous.spread || (previous.book && !scene.book)) graph.cue('paper')
        if (scene.cores[4] > 1 && previous.cores[4] < 2) { feedbackUntil = scene.time + 1.8; graph.cue('lamp', 4) }
        if (scene.selected === 3 && scene.cores[3] > 0 && Math.floor(scene.motionTime / 9.6) > Math.floor(previous.motionTime / 9.6)) graph.cue('water', 3)
        const stonePeriod = scene.cores[5] > 1 ? 4.5 : 8
        if (scene.selected === 5 && scene.cores[5] > 0 && Math.floor(scene.motionTime / stonePeriod) > Math.floor(previous.motionTime / stonePeriod)) graph.cue('dust', 5)
      }
      if (active) for (const event of scene.events) {
        if (scene.time - event.at > 0.3 || (event.kind === 'tick' && scene.time < feedbackUntil)) continue
        if (event.core && scene.selected && event.core !== scene.selected && ![5, 6, 9].includes(event.core)) continue
        if (event.kind === 'place') { feedbackUntil = scene.time + 1.8; graph.cue('place', event.core); if (event.core === 1) graph.cue('glass', 1, context.currentTime + 0.15) }
        else { if (event.kind === 'intersection') feedbackUntil = scene.time + 1.8; graph.cue(event.kind, event.core, context.currentTime, coreDetune(scene.cores[event.core])) }
      }
      const duck = scene.time < feedbackUntil ? 0.3 : Math.min(1, 0.3 + Math.max(0, scene.time - feedbackUntil) * 0.7)
      graph.update(scene, settings, active, duck)
      previous = { ...scene, cores: scene.cores.slice() }; activeBefore = active
    },
    inspect: () => ({ state: context.state, ...graph.inspect() }),
    dispose() { disposed = true; clearTimeout(suspendTimer); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); graph.output.gain.setTargetAtTime(0, context.currentTime, 0.025); setTimeout(() => { graph.dispose(); void context.close().catch(() => undefined) }, 150) }
  }
}

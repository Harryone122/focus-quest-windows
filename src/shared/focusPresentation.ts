import type { AppSettings, AppSnapshot } from './types'
import { timeOfDayAt } from './timeOfDay'

export type FocusPresentation = 'quiet' | 'live'
export const QUIET_FOCUS = Object.freeze({ brightness: 0.75, saturation: 0.8, audioGain: 10 ** (-6 / 20), lampSeconds: 3, itemFadeSeconds: 0.6, corePoseSeconds: 4, coreFadeSeconds: 2 })
export interface FocusEventRecord {
  id: string; eventId: string; sessionId: string; runId: string; nodeId: string; mapId: string; segment: number
  kind: 'lamp' | 'story' | 'item' | 'core' | 'encounter' | 'ending'
  phase: 'before' | 'focus'; effectiveSeconds: number; explorationSeconds: number
  timeOfDay: ReturnType<typeof timeOfDayAt>; weather: string; seed: number; carriedItems: string[]
  variant: string; skipped: boolean; recordedAt: string
  /** Immutable presentation inputs from BEFORE the event. Never pass live world state to replay. */
  scene: { cloud?: AppSnapshot['cloudStory']; moss?: AppSnapshot['mossStation']; lake?: AppSnapshot['lake']; nursery?: AppSnapshot['nursery']; worldMarks?: string[]; coreTaken?: boolean }
}
export interface BeforeFocus { startedAt: string; queue: FocusEventRecord[]; startedIds: string[] }
export interface FocusRecap { sessionId: string; effectiveSeconds: number; presentation: FocusPresentation; lamps: FocusEventRecord[]; events: FocusEventRecord[] }
export function recapOrder(events: readonly FocusEventRecord[]): FocusEventRecord[] {
  return events.filter(e => e.phase === 'focus' && e.kind !== 'lamp').slice().sort((a,b) => Number(a.kind === 'core') - Number(b.kind === 'core') || a.effectiveSeconds - b.effectiveSeconds || a.id.localeCompare(b.id))
}
export function focusAudioSettings<T extends Pick<AppSettings, 'environmentVolume' | 'musicVolume' | 'audioMuted'>>(settings: T, quiet: boolean): T & { quietFocus: boolean } {
  return { ...settings, environmentVolume: settings.environmentVolume * (quiet ? QUIET_FOCUS.audioGain ** (1/1.4) : 1), musicVolume: settings.musicVolume * (quiet ? QUIET_FOCUS.audioGain ** (1/1.4) : 1), quietFocus: quiet }
}

/** Reject broken presentation data before a backup's replacing transaction. */
export function validFocusEvent(value: unknown): value is FocusEventRecord {
  if(!value || typeof value!=='object')return false
  const e=value as FocusEventRecord
  return ['id','eventId','sessionId','runId','nodeId','mapId','weather','variant','recordedAt'].every(k=>typeof (e as unknown as Record<string,unknown>)[k]==='string')
    && ['lamp','story','item','core','encounter','ending'].includes(e.kind) && ['before','focus'].includes(e.phase)
    && [e.segment,e.effectiveSeconds,e.explorationSeconds,e.seed].every(n=>Number.isFinite(n)&&n>=0)
    && typeof e.skipped==='boolean' && Array.isArray(e.carriedItems) && e.carriedItems.every(i=>typeof i==='string')
    && !!e.scene && typeof e.scene==='object' && !!e.timeOfDay && Number.isFinite(e.timeOfDay.phase)
}

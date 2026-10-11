import type { ExplorerAnimationKey, InteractionType, InteractiveObjectDefinition } from './MapDefinition'

export interface InteractionPresentation {
  animationKey: ExplorerAnimationKey
  arrivalPauseMs: number
  durationMs: number
  recoveryPauseMs: number
  facingRequired: boolean
  motionIntensity: 'very-low' | 'low' | 'medium-low' | 'medium'
  arrivalActivity: string
  completionActivity: string
}

const PRESENTATIONS: Record<InteractionType, Omit<InteractionPresentation, 'arrivalActivity'>> = {
  lamp: { animationKey: 'lightLamp', arrivalPauseMs: 850, durationMs: 1500, recoveryPauseMs: 1200, facingRequired: true, motionIntensity: 'medium', completionActivity: '繼續往前' },
  treasure: { animationKey: 'pickup', arrivalPauseMs: 1050, durationMs: 1900, recoveryPauseMs: 1600, facingRequired: true, motionIntensity: 'medium-low', completionActivity: '把找到的東西收進背包' },
  inspect: { animationKey: 'inspect', arrivalPauseMs: 1200, durationMs: 2300, recoveryPauseMs: 1700, facingRequired: true, motionIntensity: 'low', completionActivity: '離開石碑，繼續前進' },
  rest: { animationKey: 'rest', arrivalPauseMs: 1450, durationMs: 3300, recoveryPauseMs: 1900, facingRequired: false, motionIntensity: 'very-low', completionActivity: '在原地多停了一會' },
  landmark: { animationKey: 'lookAround', arrivalPauseMs: 1500, durationMs: 3600, recoveryPauseMs: 1900, facingRequired: true, motionIntensity: 'very-low', completionActivity: '沿圓台慢慢離開' }
}

export function interactionFor(object: InteractiveObjectDefinition): InteractionPresentation {
  const presentation = PRESENTATIONS[object.type]
  return { ...presentation, animationKey: object.animationKey, arrivalActivity: object.activity }
}

export function interactionDurationSeconds(object: InteractiveObjectDefinition): number {
  const presentation = interactionFor(object)
  return (presentation.arrivalPauseMs + presentation.durationMs + presentation.recoveryPauseMs) / 1000
}

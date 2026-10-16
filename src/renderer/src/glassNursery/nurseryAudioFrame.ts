/** Audio automation cannot accept a missing/invalid transitional scene parameter. */
export function nurseryAudioFrame<T extends {run:number;turn:number;mist:number;vortex:number;burst:number;fade:number}>(frame:T):T {
  const next={...frame}
  for(const key of ['run','turn','mist','vortex','burst','fade'] as const)next[key]=Number.isFinite(frame[key])?Math.max(0,Math.min(1,frame[key])):0
  return next
}

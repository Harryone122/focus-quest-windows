export interface NurseryCue { at: number; end: number; name: string; music?: boolean }
const c = (at: number, end: number, name: string, music = false): NurseryCue => ({ at, end, name, music })
/** Fractions belong to the local doAct animation, never the backend event envelope (which includes walking). */
export const nurseryAudioCues: Record<string, NurseryCue[]> = {
  first: [c(.3,.85,'nursery_tray_water')], chart: [c(.05,.8,'nursery_chart_trace')],
  key: [c(.6,.95,'nursery_key_unhook')],
  core: [c(.08,.14,'nursery_padlock_open'),c(.14,.32,'nursery_cage_door'),c(.62,.8,'nursery_jar_lift'),c(.62,.95,'nursery_jar_shrink')],
  plant: [c(.05,.35,'nursery_soil_scoop'),c(.35,.65,'nursery_soil_press'),c(.35,.45,'nursery_sapling_leaf'),c(.7,1,'nursery_tray_water')],
  dig: [c(.25,.6,'nursery_soil_scoop')],
  transplant: [c(.05,.4,'nursery_soil_scoop'),c(.35,.9,'nursery_soil_press'),c(.4,.55,'nursery_sapling_leaf')],
  marks: [.2,.42,.64].map(at=>c(at,at+.12,'nursery_chart_mark')),
  empty: [c(.2,1,'nursery_tray_water')],
  leaf: [c(.05,.65,'nursery_book_leaf'),c(.98,1,'tone_item_d4',true)],
  mulch: [c(.2,.7,'nursery_cloth_pat'),c(.98,1,'tone_item_d4',true)],
  potRight: [c(0,.1,'dep_cloth_kneel'),c(.08,.45,'nursery_pot_upright'),c(.45,.95,'nursery_soil_scoop')],
  wipe: [c(.1,.9,'nursery_glass_wipe')], valve: [c(.15,.55,'nursery_valve_squeak')],
  trough: [c(.45,.7,'nursery_trough_flick')]
}
export function crossedNurseryCues(key: string, before: number, after: number, duration: number) {
  if (after <= before || after-before > .15) return []
  return (nurseryAudioCues[key] ?? []).filter(cue => before <= cue.at*duration && after > cue.at*duration)
}

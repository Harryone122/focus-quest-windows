import asset0 from './audio/actions/bridge_creak_down_a.wav?url'
import asset1 from './audio/actions/bridge_creak_down_b.wav?url'
import asset2 from './audio/actions/bridge_creak_down_c.wav?url'
import asset3 from './audio/actions/bridge_creak_down_d.wav?url'
import asset4 from './audio/actions/bridge_creak_up_a.wav?url'
import asset5 from './audio/actions/bridge_creak_up_b.wav?url'
import asset6 from './audio/actions/bridge_creak_up_c.wav?url'
import asset7 from './audio/actions/bridge_creak_up_d.wav?url'
import asset8 from './audio/actions/bridge_plank_step_a.wav?url'
import asset9 from './audio/actions/bridge_plank_step_b.wav?url'
import asset10 from './audio/actions/bridge_plank_step_c.wav?url'
import asset11 from './audio/actions/bridge_sway_groan.wav?url'
import asset12 from './audio/actions/dep_cloth_kneel.wav?url'
import asset13 from './audio/actions/dep_cloth_rise.wav?url'
import asset14 from './audio/actions/dep_ember_spark.wav?url'
import asset15 from './audio/actions/dep_fire_flare.wav?url'
import asset16 from './audio/actions/dep_fog_swell.wav?url'
import asset17 from './audio/actions/dep_lantern_clink.wav?url'
import asset18 from './audio/actions/dep_log_creak.wav?url'
import asset19 from './audio/actions/dep_notebook_close.wav?url'
import asset20 from './audio/actions/dep_staff_tap.wav?url'
import asset21 from './audio/actions/dep_steps_dirt.wav?url'
import asset22 from './audio/actions/ret_log_settle.wav?url'
import asset23 from './audio/actions/stone_air_hop.wav?url'
import asset24 from './audio/actions/stone_step_dry_a.wav?url'
import asset25 from './audio/actions/stone_step_dry_b.wav?url'
import asset26 from './audio/actions/stone_step_dry_c.wav?url'

export const campfireActionUrls = {
  'bridge_creak_down_a': asset0,
  'bridge_creak_down_b': asset1,
  'bridge_creak_down_c': asset2,
  'bridge_creak_down_d': asset3,
  'bridge_creak_up_a': asset4,
  'bridge_creak_up_b': asset5,
  'bridge_creak_up_c': asset6,
  'bridge_creak_up_d': asset7,
  'bridge_plank_step_a': asset8,
  'bridge_plank_step_b': asset9,
  'bridge_plank_step_c': asset10,
  'bridge_sway_groan': asset11,
  'dep_cloth_kneel': asset12,
  'dep_cloth_rise': asset13,
  'dep_ember_spark': asset14,
  'dep_fire_flare': asset15,
  'dep_fog_swell': asset16,
  'dep_lantern_clink': asset17,
  'dep_log_creak': asset18,
  'dep_notebook_close': asset19,
  'dep_staff_tap': asset20,
  'dep_steps_dirt': asset21,
  'ret_log_settle': asset22,
  'stone_air_hop': asset23,
  'stone_step_dry_a': asset24,
  'stone_step_dry_b': asset25,
  'stone_step_dry_c': asset26
}
export type CampfireActionName = keyof typeof campfireActionUrls
export interface CampfireActionEvent { name: CampfireActionName; main: number; actualStart: number; actualEnd: number; offset: number; rate: number; gain: number; quiet?: boolean; fade?: number }
// Fixed listening-approved sequence, including per-step variation; sources are unchanged.
export const campfireActionPlans: Record<'bridge' | 'steps' | 'return', CampfireActionEvent[]> = {
  "bridge": [
    {
      "name": "dep_notebook_close",
      "main": 0.4,
      "actualStart": 0.09000000000000002,
      "actualEnd": 0.8900000000000001,
      "offset": 0,
      "rate": 1,
      "gain": 0.7079457843841379,
      "fade": 0.035
    },
    {
      "name": "dep_log_creak",
      "main": 0.9,
      "actualStart": 0.6900000000000001,
      "actualEnd": 1.69,
      "offset": 0,
      "rate": 1,
      "gain": 0.6752948188860507,
      "fade": 0.035
    },
    {
      "name": "dep_staff_tap",
      "main": 1.65,
      "actualStart": 1.3699999999999999,
      "actualEnd": 2.37,
      "offset": 0,
      "rate": 1,
      "gain": 0.9437453073115927,
      "fade": 0.035
    },
    {
      "name": "dep_steps_dirt",
      "main": 2.3,
      "actualStart": 2.27,
      "actualEnd": 2.4,
      "offset": 0,
      "rate": 1,
      "gain": 1.7099284849184375,
      "fade": 0.025
    },
    {
      "name": "dep_steps_dirt",
      "main": 3,
      "actualStart": 2.97,
      "actualEnd": 3.0900000000000003,
      "offset": 0.15,
      "rate": 1,
      "gain": 1.7099284849184375,
      "fade": 0.025
    },
    {
      "name": "dep_cloth_kneel",
      "main": 3.35,
      "actualStart": 2.991999826222075,
      "actualEnd": 4.014857465587575,
      "offset": 0,
      "rate": 0.9776531567191705,
      "gain": 0.7636606027619168,
      "quiet": true,
      "fade": 0.035
    },
    {
      "name": "dep_lantern_clink",
      "main": 4.05,
      "actualStart": 3.63,
      "actualEnd": 4.63,
      "offset": 0,
      "rate": 1,
      "gain": 1.1484710858309535,
      "fade": 0.035
    },
    {
      "name": "dep_ember_spark",
      "main": 4.65,
      "actualStart": 4.57,
      "actualEnd": 5.0200000000000005,
      "offset": 0,
      "rate": 1,
      "gain": 1.2180703828246746,
      "fade": 0.035
    },
    {
      "name": "dep_fire_flare",
      "main": 5.05,
      "actualStart": 4.92,
      "actualEnd": 5.82,
      "offset": 0,
      "rate": 1,
      "gain": 0.35211973739238733,
      "fade": 0.035
    },
    {
      "name": "dep_cloth_rise",
      "main": 5.5,
      "actualStart": 5.420363983334329,
      "actualEnd": 6.423261012624158,
      "offset": 0,
      "rate": 1.0289614605298265,
      "gain": 1.0235629851915085,
      "quiet": true,
      "fade": 0.035
    },
    {
      "name": "dep_fog_swell",
      "main": 7.5,
      "actualStart": 5.95,
      "actualEnd": 7.95,
      "offset": 0,
      "rate": 1,
      "gain": 0.4977949380420204,
      "quiet": true,
      "fade": 0.12
    },
    {
      "name": "bridge_plank_step_b",
      "main": 5.85,
      "actualStart": 5.736888970102527,
      "actualEnd": 5.973393850797242,
      "offset": 0,
      "rate": 0.9724957866594195,
      "gain": 0.8264133927027939,
      "fade": 0.045
    },
    {
      "name": "bridge_creak_up_b",
      "main": 5.8701661126990805,
      "actualStart": 5.85095346754638,
      "actualEnd": 6.15835578998959,
      "offset": 0,
      "rate": 1.040981074757874,
      "gain": 0.3086748564833961,
      "fade": 0.07
    },
    {
      "name": "bridge_plank_step_c",
      "main": 6.23,
      "actualStart": 6.210565067625508,
      "actualEnd": 6.43406678993217,
      "offset": 0,
      "rate": 1.0290748439263553,
      "gain": 0.43692048480393775,
      "fade": 0.045
    },
    {
      "name": "bridge_creak_down_b",
      "main": 6.238882148417178,
      "actualStart": 6.160063870794323,
      "actualEnd": 6.534450689502886,
      "offset": 0,
      "rate": 1.0149929992482065,
      "gain": 0.39799525678119146,
      "fade": 0.07
    },
    {
      "name": "bridge_plank_step_a",
      "main": 6.609999999999999,
      "actualStart": 6.580156003272924,
      "actualEnd": 6.8089599781805,
      "offset": 0,
      "rate": 1.0052272915840148,
      "gain": 6.218142831608201,
      "fade": 0.045
    },
    {
      "name": "bridge_creak_up_a",
      "main": 6.613949105062057,
      "actualStart": 6.603194254996696,
      "actualEnd": 6.9365946070228635,
      "offset": 0,
      "rate": 0.9298130554333329,
      "gain": 0.6739583478076047,
      "fade": 0.07
    },
    {
      "name": "bridge_plank_step_c",
      "main": 6.99,
      "actualStart": 6.970108745753694,
      "actualEnd": 7.198858169586218,
      "offset": 0,
      "rate": 1.0054670134093613,
      "gain": 0.34902526347242274,
      "fade": 0.045
    },
    {
      "name": "bridge_creak_down_c",
      "main": 7.016421291336883,
      "actualStart": 6.831708311047674,
      "actualEnd": 7.3423853742001945,
      "offset": 0,
      "rate": 0.9203467982262373,
      "gain": 0.4077910983667857,
      "fade": 0.07
    },
    {
      "name": "bridge_plank_step_a",
      "main": 7.37,
      "actualStart": 7.339168546277006,
      "actualEnd": 7.575543024819962,
      "offset": 0,
      "rate": 0.9730322893476113,
      "gain": 5.877137874819144,
      "fade": 0.045
    },
    {
      "name": "bridge_creak_up_b",
      "main": 7.377980751977303,
      "actualStart": 7.359407248789881,
      "actualEnd": 7.65658329978863,
      "offset": 0,
      "rate": 1.0768027871847152,
      "gain": 0.2657140902168683,
      "fade": 0.07
    },
    {
      "name": "bridge_plank_step_c",
      "main": 7.75,
      "actualStart": 7.73036493775081,
      "actualEnd": 7.95616815361649,
      "offset": 0,
      "rate": 1.0185860246419907,
      "gain": 0.35692212102533794,
      "fade": 0.045
    },
    {
      "name": "bridge_creak_down_b",
      "main": 7.768884941991419,
      "actualStart": 7.689699097286053,
      "actualEnd": 8,
      "offset": 0,
      "rate": 1.0102815761789679,
      "gain": 0.44402442287394783,
      "fade": 0.07
    },
    {
      "name": "bridge_sway_groan",
      "main": 6.9,
      "actualStart": 6.6000000000000005,
      "actualEnd": 7.4,
      "offset": 0,
      "rate": 1,
      "gain": 0.19276604475222123,
      "quiet": true,
      "fade": 0.25
    }
  ],
  "steps": [
    {
      "name": "dep_notebook_close",
      "main": 0.4,
      "actualStart": 0.09000000000000002,
      "actualEnd": 0.8900000000000001,
      "offset": 0,
      "rate": 1,
      "gain": 0.7079457843841379,
      "fade": 0.035
    },
    {
      "name": "dep_log_creak",
      "main": 0.9,
      "actualStart": 0.6900000000000001,
      "actualEnd": 1.69,
      "offset": 0,
      "rate": 1,
      "gain": 0.6752948188860507,
      "fade": 0.035
    },
    {
      "name": "dep_staff_tap",
      "main": 1.65,
      "actualStart": 1.3699999999999999,
      "actualEnd": 2.37,
      "offset": 0,
      "rate": 1,
      "gain": 0.9437453073115927,
      "fade": 0.035
    },
    {
      "name": "dep_steps_dirt",
      "main": 2.3,
      "actualStart": 2.27,
      "actualEnd": 2.4,
      "offset": 0,
      "rate": 1,
      "gain": 1.7099284849184375,
      "fade": 0.025
    },
    {
      "name": "dep_steps_dirt",
      "main": 3,
      "actualStart": 2.97,
      "actualEnd": 3.0900000000000003,
      "offset": 0.15,
      "rate": 1,
      "gain": 1.7099284849184375,
      "fade": 0.025
    },
    {
      "name": "dep_cloth_kneel",
      "main": 3.35,
      "actualStart": 2.991999826222075,
      "actualEnd": 4.014857465587575,
      "offset": 0,
      "rate": 0.9776531567191705,
      "gain": 0.7636606027619168,
      "quiet": true,
      "fade": 0.035
    },
    {
      "name": "dep_lantern_clink",
      "main": 4.05,
      "actualStart": 3.63,
      "actualEnd": 4.63,
      "offset": 0,
      "rate": 1,
      "gain": 1.1484710858309535,
      "fade": 0.035
    },
    {
      "name": "dep_ember_spark",
      "main": 4.65,
      "actualStart": 4.57,
      "actualEnd": 5.0200000000000005,
      "offset": 0,
      "rate": 1,
      "gain": 1.2180703828246746,
      "fade": 0.035
    },
    {
      "name": "dep_fire_flare",
      "main": 5.05,
      "actualStart": 4.92,
      "actualEnd": 5.82,
      "offset": 0,
      "rate": 1,
      "gain": 0.35211973739238733,
      "fade": 0.035
    },
    {
      "name": "dep_cloth_rise",
      "main": 5.5,
      "actualStart": 5.420363983334329,
      "actualEnd": 6.423261012624158,
      "offset": 0,
      "rate": 1.0289614605298265,
      "gain": 1.0235629851915085,
      "quiet": true,
      "fade": 0.035
    },
    {
      "name": "dep_fog_swell",
      "main": 7.5,
      "actualStart": 5.95,
      "actualEnd": 7.95,
      "offset": 0,
      "rate": 1,
      "gain": 0.4977949380420204,
      "quiet": true,
      "fade": 0.12
    },
    {
      "name": "stone_step_dry_b",
      "main": 5.85,
      "actualStart": 5.839717179100229,
      "actualEnd": 6.0762220597949455,
      "offset": 0,
      "rate": 0.9724957866594195,
      "gain": 0.9345161559570349,
      "fade": 0.045
    },
    {
      "name": "stone_step_dry_c",
      "main": 6.23,
      "actualStart": 6.2007492056195215,
      "actualEnd": 6.425005295869861,
      "offset": 0,
      "rate": 1.0256131717236712,
      "gain": 1.1366690462423557,
      "fade": 0.045
    },
    {
      "name": "stone_air_hop",
      "main": 6.43,
      "actualStart": 6.31,
      "actualEnd": 6.66,
      "offset": 0,
      "rate": 1,
      "gain": 0.016750429449529328,
      "quiet": true,
      "fade": 0.1
    },
    {
      "name": "stone_step_dry_b",
      "main": 6.609999999999999,
      "actualStart": 6.600355456054792,
      "actualEnd": 6.822179966794569,
      "offset": 0,
      "rate": 1.0368556623114273,
      "gain": 1.1535538270859986,
      "fade": 0.045
    },
    {
      "name": "stone_step_dry_c",
      "main": 6.99,
      "actualStart": 6.959938531614991,
      "actualEnd": 7.190409789233394,
      "offset": 0,
      "rate": 0.9979552434291691,
      "gain": 1.210018176812579,
      "fade": 0.045
    },
    {
      "name": "stone_air_hop",
      "main": 7.19,
      "actualStart": 7.07,
      "actualEnd": 7.42,
      "offset": 0,
      "rate": 1,
      "gain": 0.016750429449529328,
      "quiet": true,
      "fade": 0.1
    },
    {
      "name": "stone_step_dry_b",
      "main": 7.37,
      "actualStart": 7.359727691010983,
      "actualEnd": 7.595990797758378,
      "offset": 0,
      "rate": 0.973490965925157,
      "gain": 1.0501520564083666,
      "fade": 0.045
    },
    {
      "name": "stone_step_dry_a",
      "main": 7.75,
      "actualStart": 7.739547062912512,
      "actualEnd": 7.979964615924739,
      "offset": 0,
      "rate": 0.9566689167171717,
      "gain": 0.4427838395372076,
      "fade": 0.045
    }
  ],
  "return": [
    {
      "name": "ret_log_settle",
      "main": 0.8,
      "actualStart": 0.7000000000000001,
      "actualEnd": 2.18,
      "offset": 0,
      "rate": 1,
      "gain": 0.4173848938386691,
      "fade": 0.035
    }
  ]
}

const decodedActions = new Map<string, AudioBuffer>()
export async function loadCampfireActions(context: BaseAudioContext, signal?: AbortSignal) {
  const entries = await Promise.allSettled(Object.entries(campfireActionUrls).map(async ([key, url]) => {
    const cached = decodedActions.get(key)
    if (cached) return [key, cached] as const
    const response = await fetch(url, { signal }); if (!response.ok) throw Error(`Missing campfire action: ${key}`)
    const buffer = await context.decodeAudioData(await response.arrayBuffer())
    if (!signal?.aborted) decodedActions.set(key, buffer)
    return [key, buffer] as const
  }))
  return Object.fromEntries(entries.flatMap(entry => entry.status === 'fulfilled' ? [entry.value] : [])) as Partial<Record<CampfireActionName, AudioBuffer>>
}

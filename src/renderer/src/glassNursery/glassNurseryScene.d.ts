import type { CloudRuinsSceneHandle,CloudRuinsSceneOptions } from '../cloudRuins/cloudRuinsScene'
import type { NurserySnapshot,NurseryExit } from '../../../shared/area07'
export type NurserySceneHandle = CloudRuinsSceneHandle & {areaId:'area-07-glass-nursery';auditionBgm(name:string):boolean|undefined;setShortMusicGaps(value:boolean):void;setNurseryState(s:NurserySnapshot):void;setAudioSettings(s:import('./nurseryAudio').NurseryAudioSettings|undefined,active?:boolean):void;qa:Record<string,any>}
export type NurserySceneOptions = Omit<CloudRuinsSceneOptions,'departure'> & {testMode?:boolean;audioSettings?:import('./nurseryAudio').NurseryAudioSettings;audioActive?:boolean;nursery?:NurserySnapshot|null;departure?:{exit:NurseryExit;durationMs:number}|null;reportTransplantComplete?:()=>void}
export function createGlassNurseryScene(host:HTMLElement,options:NurserySceneOptions):NurserySceneHandle

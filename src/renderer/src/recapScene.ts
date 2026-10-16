import type { AppSnapshot, AppSettings } from '../../shared/types'
import type { FocusEventRecord } from '../../shared/focusPresentation'
import { recapAction, eventSeconds, recapClipSeconds } from '../../shared/focusRecap'
import { createCloudRuinsScene } from './cloudRuins/cloudRuinsScene'
import { createMossStationScene } from './mossStation/mossStationScene'
import { createReflectionLakeScene } from './reflectionLake/reflectionLakeScene'
import { createGlassNurseryScene } from './glassNursery/glassNurseryScene'
import type { AreaSceneHandle } from './cloudRuins/sceneHandoff'
import { createCloudRuinsAudio } from './cloudRuins/cloudRuinsAudio'
import { createMossSoundscape } from './mossStation/mossStationAudio'
import { createLakeAudio } from './reflectionLake/lakeAudio'
import { weatherSeedFrom } from '../../shared/weather'

/** One prewarmed renderer per pending Focus. Events and drags never construct a new map. */
export class RecapScene {
  readonly host=document.createElement('div')
  readonly ready:Promise<void>
  private handle:AreaSceneHandle
  private epoch=0
  private dead=false
  private held=true
  private claimed=false
  private current:FocusEventRecord|null=null
  private clock=0
  private settings:AppSettings
  private snapshot:AppSnapshot
  private warmKeys=new Set<string>()
  private work:Promise<void>=Promise.resolve()
  private cloudAudio:ReturnType<typeof createCloudRuinsAudio>|null=null
  private mossAudio:ReturnType<typeof createMossSoundscape>|null=null
  private lakeAudio:ReturnType<typeof createLakeAudio>|null=null
  onCaption:((caption:string)=>void)|null=null
  readonly mapId:string
  constructor(readonly sessionId:string,snapshot:AppSnapshot){
    this.settings=snapshot.settings
    this.snapshot=snapshot
    const session=snapshot.activeSession??snapshot.recentSessions.find(s=>s.id===sessionId)
    const node=snapshot.expeditionNodes.find(n=>n.id===session?.nodeId)
    this.mapId=node?.areaId??'area-01-cloud-ruins';this.clock=node?.progressSeconds??0
    this.host.className='recap-scene';this.host.style.cssText='position:fixed;inset:0;opacity:0;pointer-events:none';document.body.append(this.host)
    let ready:()=>void=()=>undefined;this.ready=new Promise(resolve=>{ready=resolve})
    const common={progressSeconds:this.clock,targetSeconds:(node?.plannedMinutes??50)*60,seed:weatherSeedFrom(node?.id??sessionId),mode:'lobby' as const,lobbyView:{kind:'overview' as const},paused:true,replay:true,reportReady:()=>ready(),reportActivity:(s:string)=>this.onCaption?.(s)}
    if(this.mapId==='area-02-moss-station'){this.handle=createMossStationScene(this.host,{...common,moss:snapshot.mossStation});this.mossAudio=createMossSoundscape(snapshot.mossStation?.weatherSeed??1)}
    else if(this.mapId==='area-03-reflection-lake'){this.handle=createReflectionLakeScene(this.host,{...common,lake:snapshot.lake});this.lakeAudio=createLakeAudio(()=>this.current?.scene.lake?{...this.current.scene.lake,action:recapAction(this.current,this.epoch) as any,effectiveSeconds:this.clock}:snapshot.lake??null,()=>this.handle.debugState(),()=>this.settings,()=>this.held)}
    else if(this.mapId==='area-07-glass-nursery')this.handle=createGlassNurseryScene(this.host,{...common,nursery:snapshot.nursery,audioSettings:snapshot.settings,audioActive:false})
    else{this.handle=createCloudRuinsScene(this.host,{...common,coreTaken:snapshot.mapCores.some(c=>c.mapId===this.mapId),worldMarks:snapshot.worldMarks.filter(m=>m.mapId===this.mapId).map(m=>m.mark)});this.cloudAudio=createCloudRuinsAudio({progressSeconds:this.clock,paused:true,muted:snapshot.settings.audioMuted,environmentVolume:snapshot.settings.environmentVolume,musicVolume:snapshot.settings.musicVolume})}
    this.handle.enableRecapTransitions()
    // A failed renderer never blocks the task question or durable session resolution.
    let timeout=0
    this.ready=Promise.race([this.ready,new Promise<void>((_,reject)=>{timeout=window.setTimeout(()=>reject(new Error('回顧場景暫時無法載入，可以全部跳過。')),20000)})]).finally(()=>window.clearTimeout(timeout))
    void this.ready.then(()=>{if(!this.dead&&!this.claimed)this.handle.setRecapDormant(true)}).catch(()=>undefined)
  }
  async claim(parent:HTMLElement):Promise<void>{await this.ready;await this.work;if(this.dead)return;this.claimed=true;this.handle.setRecapDormant(false);parent.append(this.host);this.host.style.cssText='position:absolute;inset:0;opacity:1';this.handle.setUiFade(0);this.handle.showRecapOverview();this.held=false;this.updateAudio();}
  warm(records:readonly FocusEventRecord[]):void{
    for(const e of records){const key=e.eventId+':'+e.variant;if(this.warmKeys.has(key)||this.claimed)continue;this.warmKeys.add(key)
      this.work=this.work.then(async()=>{await this.ready;if(this.dead||this.claimed)return;this.handle.setRecapDormant(false);try{await this.handle.warmRecapEvent(e)}finally{if(!this.dead){this.handle.setPaused(true);this.handle.setRecapDormant(true)}}}).catch(()=>{this.warmKeys.delete(key)})
    }
  }
  updateSettings(settings:AppSettings):void{this.settings=settings;this.updateAudio()}
  updateSnapshot(snapshot:AppSnapshot):void{this.snapshot=snapshot}
  setReducedMotion(reduced:boolean):void{this.handle.setReducedMotion(reduced);if(this.current){this.handle.setQuietFocus(reduced);this.handle.setPaused(reduced);if('setDirectorEnabled'in this.handle)this.handle.setDirectorEnabled(!reduced);this.held=reduced;this.updateAudio()}}
  private updateAudio():void{
    this.cloudAudio?.update({progressSeconds:this.clock,paused:this.held,muted:this.settings.audioMuted,environmentVolume:this.settings.environmentVolume,musicVolume:this.settings.musicVolume})
    this.mossAudio?.update(this.clock,this.settings,this.held)
    if('setAudioSettings'in this.handle)this.handle.setAudioSettings(this.settings,!this.held)
  }
  begin(e:FocusEventRecord,reduced:boolean):number{
    this.current=structuredClone(e);this.epoch++;const action=recapAction(e,this.epoch);this.clock=action.startSeconds
    this.held=true;this.updateAudio();this.lakeAudio?.stopShots();this.handle.beginRecapEvent(e,this.epoch);this.handle.setReducedMotion(reduced)
    const rate=eventSeconds(e)/recapClipSeconds(e);this.handle.setRecapRate?.(rate);this.handle.setQuietFocus(reduced);this.handle.setPaused(reduced);if('setDirectorEnabled'in this.handle)this.handle.setDirectorEnabled(!reduced);this.held=reduced;this.updateAudio();return recapClipSeconds(e)
  }
  frame(elapsed:number,reduced:boolean):void{if(!this.current||reduced)return;const duration=recapClipSeconds(this.current),ratio=Math.min(1,elapsed/duration),base=recapAction(this.current,this.epoch).startSeconds;this.clock=base+eventSeconds(this.current)*ratio;this.handle.setProgress(this.clock);this.updateAudio()}
  overview(lamps:number,close=false):void{
    this.current=null;this.lakeAudio?.stopShots();this.handle.showRecapOverview(close)
    const s=this.snapshot
    if('setMossState'in this.handle&&s.mossStation)this.handle.setMossState({...s.mossStation,action:null})
    else if('setLakeState'in this.handle&&s.lake)this.handle.setLakeState({...s.lake,action:null})
    else if('setNurseryState'in this.handle&&s.nursery)this.handle.setNurseryState({...s.nursery,action:null})
    this.handle.setWorldState({coreTaken:s.mapCores.some(c=>c.mapId===this.mapId),worldMarks:s.worldMarks.filter(m=>m.mapId===this.mapId).map(m=>m.mark)})
    this.clock=s.expeditionNodes.find(n=>n.id===s.pendingDebrief?.nodeId)?.progressSeconds??this.clock
    this.handle.setProgress(this.clock)
    this.handle.setRecapLamps(lamps);this.held=false;this.updateAudio()
  }
  lamps(n:number):void{this.handle.setRecapLamps(n)}
  /** Crossfade the last submitted texture entirely on the GPU. */
  transition(change:()=>void,reduced=false):void{
    this.handle.beginRecapTransition(reduced?0:220);change()
  }
  debug(){return {mapId:this.mapId,claimed:this.claimed,epoch:this.epoch,warmKeys:[...this.warmKeys],canvasCount:this.host.querySelectorAll('canvas').length,scene:this.handle.debugState()}}
  destroy():void{if(this.dead)return;this.dead=true;this.onCaption=null;this.cloudAudio?.destroy();this.mossAudio?.dispose();this.lakeAudio?.destroy();this.handle.destroy();this.host.remove()}
}
let cached:RecapScene|null=null
export function getRecapScene(id:string,snapshot:AppSnapshot):RecapScene {if(cached?.sessionId!==id){cached?.destroy();cached=new RecapScene(id,snapshot)}return cached!}
export function releaseRecapScene(id?:string):void{if(!id||cached?.sessionId===id){cached?.destroy();cached=null}}

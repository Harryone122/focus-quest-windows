import { lakeTideAt, type LakeSnapshot } from '../../../shared/area03'
import type { AppSettings as Settings } from '../../../shared/types'
import { timeOfDayAt } from '../../../shared/timeOfDay'
const urls=import.meta.glob('./audio/*.wav',{eager:true,query:'?url',import:'default'}) as Record<string,string>
/** Only supplied recordings. No oscillator or synthesized fallback. */
export function createLakeAudio(snapshot:()=>LakeSnapshot|null,scene:()=>Record<string,unknown>|undefined,settings:()=>Settings|undefined,paused:()=>boolean) {
 const ctx=new AudioContext(),buffers=new Map<string,AudioBuffer>(),master=ctx.createGain(),music=ctx.createGain(),loops=new Map<string,{source:AudioBufferSourceNode,gain:GainNode}>(),shots=new Set<AudioBufferSourceNode>()
 master.connect(ctx.destination);music.connect(ctx.destination)
 let dead=false,lastAction=-1,lastStep=-1,lastBird=0,serial=0,lastPosition=0
 const cues=new Set<string>()
 const decoded=Promise.all(Object.entries(urls).map(async([path,url])=>{const b=await ctx.decodeAudioData(await(await fetch(url)).arrayBuffer());buffers.set(path.split('/').at(-1)!.replace('.wav',''),b)})).catch(e=>console.error('湖畔錄音載入失敗',e))
 function loop(name:string,gain:number) {if(!buffers.has(name))return;let entry=loops.get(name);if(!entry){const source=ctx.createBufferSource(),g=ctx.createGain();source.buffer=buffers.get(name)!;source.loop=true;source.connect(g);g.connect(master);g.gain.value=0;source.start(0,(serial++*3.7)%source.buffer.duration);entry={source,gain:g};loops.set(name,entry)}entry.gain.gain.setTargetAtTime(gain,ctx.currentTime,.15)}
 function shot(name:string,gain=1,isMusic=false){if((settings() as Settings & {quietFocus?:boolean})?.quietFocus&&!/lake_(wade_step|mud_step)/.test(name))return;const b=buffers.get(name);if(!b||shots.size>=3)return;const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=b;s.connect(g);g.gain.value=gain;g.connect(isMusic?music:master);shots.add(s);s.onended=()=>{shots.delete(s);g.disconnect()};s.start()}
 function tick(){if(dead)return;const state=snapshot(),set=settings(),mute=paused()||set?.audioMuted||(!set?.environmentVolume&&!set?.musicVolume)
  if(mute||!state){void ctx.suspend();return}if(ctx.state==='suspended')void ctx.resume()
  master.gain.setTargetAtTime((set?.environmentVolume??35)/100*((set as Settings & {quietFocus?:boolean})?.quietFocus?10**(-6/20*(1-1/1.4)):1),ctx.currentTime,.06);music.gain.setTargetAtTime((set?.musicVolume??12)/100*((set as Settings & {quietFocus?:boolean})?.quietFocus?10**(-6/20*(1-1/1.4)):1),ctx.currentTime,.06)
  const debug=scene(),sec=Number(debug?.sim??state.effectiveSeconds),tide=lakeTideAt(state.seed,sec),tod=timeOfDayAt(sec),night=(tod.blend<.5?tod.from:tod.to)==='night',action=state.action,position=action?(sec-action.startSeconds)/(action.endSeconds-action.startSeconds):0,hush=!(set as Settings & {quietFocus?:boolean})?.quietFocus&&action?.eventId==='rare_ring_mirror'&&position>=.30&&position<=.88,k=hush?.3:1
  loop('lake_wind_reeds_loop',.5*(1-.4*tide.level)*k);loop('lake_lap_loop',(1-.975*tide.level)*k);loop('lake_tide_rise_loop',tide.phase==='rising'?Math.sin(Math.PI*tide.level):0);loop('lake_tide_fall_loop',tide.phase==='falling'?Math.sin(Math.PI*tide.level):0);loop('lake_night_insects_loop',night?.8:0)
  if(!night&&ctx.currentTime-lastBird>45){lastBird=ctx.currentTime;shot('lake_birds_day',.6)}
  const a=state.action,tr=debug?.traveller as {moving?:boolean;wading?:boolean;stepIndex?:number;air?:number}|undefined
  if(tr?.moving&&!(tr.air!>0.01)&&tr.stepIndex!==undefined&&tr.stepIndex!==lastStep){lastStep=tr.stepIndex;shot(tr.wading?`lake_wade_step_${'abcd'[serial++%4]}`:`lake_mud_step_${'abc'[serial++%3]}`)}
  if(a&&a.id!==lastAction){lastAction=a.id;cues.clear();lastPosition=position;const age=sec-a.startSeconds;if(age<1.5){const id=a.eventId??'',name=a.kind==='cuff'?'lake_cuff_roll':id==='ev_pool_fish'?`lake_fish_plip_${'ab'[serial++%2]}`:id==='ev_reeds_egret'?`lake_egret_takeoff_${'ab'[serial++%2]}`:null;if(name)shot(name)}}
  if(a&&(a.kind==='event'||a.kind==='rest'||a.kind==='story')) {
   const cue=(at:number,name:string,gain=1,isMusic=false)=>{if(position>=at&&!cues.has(name)){cues.add(name);if(lastPosition<=at && (position-at)*(a.endSeconds-a.startSeconds)<.35)shot(name,gain,isMusic)}}
   if(a.eventId==='rest_cup_first'){cue(.28,'lake_cup_flip');cue(.36,'lake_tea_pour');cue(.97,'lake_cup_set')}
   if(a.eventId==='rest_tea'){cue(.02,'lake_tea_pour');cue(.96,'lake_cup_set')}
   if(a.eventId==='story_second_cup'){cue(.23,'lake_tea_pour');cue(.28,'lake_cup_set')}
   if(a.eventId==='rare_gauge_plate'||a.eventId==='rare_boat_plate')cue(.26,'lake_gauge_pry')
   if(a.eventId==='rare_mirror_shard')cue(.5,'lake_mirror_shard')
   if(a.eventId==='rare_ring_mirror'){cue(.30,'lake_mirror_rise');cue(.9,'core_motif_03',.1,true)}
   else if(a.eventId?.startsWith('rare_'))cue(.92,'tone_item_d4',.08,true)
   if(a.eventId==='ev_arch_hop')cue(.2,`lake_arch_hop_${'ab'[a.id%2]}`)
  }
  lastPosition=position
 }
 const timer=setInterval(tick,100);void decoded.then(tick)
 return {stopShots(){shots.forEach(s=>s.stop());shots.clear();lastAction=-1;cues.clear()},destroy(){dead=true;clearInterval(timer);loops.forEach(e=>e.source.stop());shots.forEach(s=>s.stop());void ctx.close()}}
}

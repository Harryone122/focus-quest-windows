import {NurseryBgmSchedule, type NurseryMusicPeriod} from './nurseryBgm'
const urls = import.meta.glob('./audio/*.wav', { eager: true, query: '?url', import: 'default' }) as Record<string,string>
export interface NurseryAudioSettings { environmentVolume: number; musicVolume?: number; audioMuted?: boolean }
export function createNurseryAudio() {
 const ctx=new AudioContext({latencyHint:'interactive'}), env=ctx.createGain(), music=ctx.createGain(), ambient=ctx.createGain(), filter=ctx.createBiquadFilter()
 env.connect(ctx.destination);music.connect(ctx.destination);ambient.connect(filter);filter.connect(env);filter.type='lowpass'
 // Short environmental reflections use delay taps, without adding a new sound source.
 const delay=ctx.createDelay(.2),wet=ctx.createGain();delay.delayTime.value=.085;wet.gain.value=.12;filter.connect(delay);delay.connect(wet);wet.connect(env)
 const buffers=new Map<string,AudioBuffer>(),loops=new Map<string,{source:AudioBufferSourceNode,gain:GainNode}>(),shots=new Set<AudioBufferSourceNode>(),lastVariant=new Map<string,string>()
 const bgmFilter=ctx.createBiquadFilter(),bgmDuck=ctx.createGain(),schedule=new NurseryBgmSchedule(ctx.currentTime)
 bgmFilter.type='lowpass';bgmFilter.frequency.value=16000;bgmFilter.connect(bgmDuck);bgmDuck.connect(music)
 let bgm:{source:AudioBufferSourceNode;gain:GainNode;name:string;end:number}|null=null,period:NurseryMusicPeriod='day',wasCore=false,duckTarget=1,musicAllowed=false,started=false
 const musicHistory:Array<{name:string;at:number;duration:number}>=[]
 function stopBgm(fade=0) {if(!bgm)return;const old=bgm;bgm=null;const now=ctx.currentTime;old.gain.gain.cancelScheduledValues(now);old.gain.gain.setValueAtTime(old.gain.gain.value,now);old.gain.gain.linearRampToValueAtTime(0,now+fade);try{old.source.stop(now+fade)}catch{}}
 function startBgm(name:string) {const b=buffers.get(name);if(!b||!musicAllowed||dead)return false;stopBgm();const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=b;source.connect(gain);gain.connect(bgmFilter);bgm={source,gain,name,end:ctx.currentTime+b.duration};schedule.last=name;musicHistory.push({name,at:ctx.currentTime,duration:b.duration});if(musicHistory.length>100)musicHistory.shift();source.onended=()=>{if(bgm?.source===source){bgm=null;schedule.ended(ctx.currentTime,period)}source.disconnect();gain.disconnect()};source.start();return true}
 let dead=false,enabled=false,loaded=0,serial=0,failures:string[]=[], history:Array<{name:string,at:number,duration:number}>=[]
 void Promise.all(Object.entries(urls).map(async([path,url])=>{try {const response=await fetch(url);if(!response.ok)throw Error(String(response.status));const b=await ctx.decodeAudioData(await response.arrayBuffer());if(!dead){buffers.set(path.split('/').at(-1)!.replace('.wav',''),b);loaded++}}catch{failures.push(path)}}))
 function stopShots(){shots.forEach(s=>{try{s.stop()}catch{}});shots.clear()}
 function shot(name:string,duration?:number,isMusic=false,gain=1) {
  if(!enabled||dead||ctx.state!=='running'||shots.size>=3)return
  let variants=[...buffers.keys()].filter(k=>k===name||new RegExp('^'+name+'_[abc]$').test(k))
  if(variants.length>1)variants=variants.filter(k=>k!==lastVariant.get(name))
  const pick=variants[Math.floor(Math.random()*variants.length)],b=buffers.get(pick);if(!b)return
  lastVariant.set(name,pick)
  const source=ctx.createBufferSource(),g=ctx.createGain();source.buffer=b
  if(name==='nursery_disc_step')source.playbackRate.value=.97+Math.random()*.06
  source.connect(g);g.connect(isMusic?music:name==='nursery_birds_day'?ambient:env);g.gain.value=gain
  // Water remains audible for the entire visible stream, including the longer first-visit beat.
  const continuous=name==='nursery_tray_water'&&duration!==undefined&&duration>b.duration
  if(continuous){source.loop=true;source.loopStart=.1;source.loopEnd=Math.max(.2,b.duration-.1)}
  const length=continuous?duration!:Math.min(b.duration/source.playbackRate.value,duration??b.duration),fade=Math.min(.04,length/3),now=ctx.currentTime
  g.gain.setValueAtTime(gain,now);g.gain.setValueAtTime(gain,now+length-fade);g.gain.linearRampToValueAtTime(0,now+length)
  const offset=name==='nursery_birds_day'?Math.random()*Math.max(0,b.duration-length):0
  shots.add(source);source.onended=()=>{shots.delete(source);source.disconnect();g.disconnect()};source.start(now,offset);source.stop(now+length)
  history.push({name:pick,at:now,duration:length});if(history.length>250)history.shift()
 }
 function loop(name:string,value:number) {const b=buffers.get(name);if(!b)return;let l=loops.get(name);if(!l){const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=b;source.loop=true;source.connect(gain);gain.connect(ambient);gain.gain.value=0;source.start(0,(serial++*2.7)%b.duration);l={source,gain};loops.set(name,l)}l.gain.gain.setTargetAtTime(value,ctx.currentTime,.12)}
 return {
  shot,stopShots,
  auditionBgm(name:string){if(/^bgm_(a|b|ab|c)$/.test(name))return startBgm(name);return false},
  setShortGaps(value:boolean){schedule.shortGaps=value;if(value&&!bgm)schedule.nextAt=Math.min(schedule.nextAt,ctx.currentTime+3)},
  update(settings: NurseryAudioSettings|undefined,inactive:boolean,state:{paused?:boolean;run:number;turn:number;mist:number;vortex:number;ride:boolean;core:boolean;burst:number;fade:number;period?:NurseryMusicPeriod;action?:boolean}) {
   if(dead)return;const next=!!settings&&!inactive&&!settings.audioMuted&&(settings.environmentVolume>0||(settings.musicVolume??0)>0)
   period=state.period??'day';schedule.setCore(state.core,ctx.currentTime)
   enabled=next;musicAllowed=next&&(settings?.musicVolume??0)>0
   if(!musicAllowed&&!state.paused){stopBgm();schedule.nextAt=Math.max(schedule.nextAt,ctx.currentTime+20)}
   if(!next){env.gain.value=0;music.gain.value=0;if(!state.paused||settings?.audioMuted)stopShots();if(ctx.state==='running')void ctx.suspend();return}
   if(ctx.state==='suspended')void ctx.resume().catch(()=>undefined)
   if(!started){started=true;schedule.nextAt=Math.max(schedule.nextAt,ctx.currentTime+20+Math.random()*20)}
   if(state.core&&!wasCore)stopBgm(4);wasCore=state.core
   const duck=state.action?.5:1
   if(duck!==duckTarget){bgmDuck.gain.cancelScheduledValues(ctx.currentTime);bgmDuck.gain.setValueAtTime(bgmDuck.gain.value,ctx.currentTime);bgmDuck.gain.linearRampToValueAtTime(duck,ctx.currentTime+(duck<duckTarget?.3:1));duckTarget=duck}
   bgmFilter.frequency.setTargetAtTime(period==='night'?16000-(1-state.vortex)*Math.min(1,state.mist)*12000:16000,ctx.currentTime,.1)
   if(musicAllowed&&!bgm&&ctx.state==='running'){const name=schedule.pick(ctx.currentTime,period);if(name&&!startBgm(name))schedule.nextAt=ctx.currentTime+5}
   const volume=(n:number)=>Math.pow(Math.max(0,Math.min(100,n))/100,1.4)
   env.gain.setTargetAtTime(volume(settings!.environmentVolume)*state.fade,ctx.currentTime,.02);music.gain.setTargetAtTime(volume(settings!.musicVolume??0)*state.fade,ctx.currentTime,.02)
   const k=state.core?.3:1;ambient.gain.setTargetAtTime(k,ctx.currentTime,.08)
   filter.frequency.setTargetAtTime(16000-(1-state.vortex)*Math.min(1,state.mist)*12000,ctx.currentTime,.1)
   loop('nursery_leaves_loop',.6*(state.ride?.6:.4+.4*state.run));loop('nursery_turn_loop',state.turn*(state.ride?1.2:1));loop('nursery_spray_loop',state.run+state.burst*.6);loop('nursery_drip_loop',(.3+.7*(1-state.run))*(1+state.mist*.4))
  },
  debugState(){return {loaded,failures,enabled,context:ctx.state,foreground:enabled&&ctx.state==='running'?shots.size:0,heldForeground:shots.size,history:[...history],bgm:bgm?{name:bgm.name,remaining:Math.max(0,bgm.end-ctx.currentTime)}:null,musicHistory:[...musicHistory],musicClock:ctx.currentTime,nextMusicAt:schedule.nextAt,period,duck:duckTarget,bgmLowpass:bgmFilter.frequency.value}},
  destroy(){if(dead)return;dead=true;enabled=false;stopShots();loops.forEach(l=>l.source.stop());stopBgm(1.5);setTimeout(()=>{void ctx.close()},1600)}
 }
}

import { QUARRY_AUDIO_DEFAULTS, QuarryBgmSchedule, type QuarryPeriod } from './quarryBgm'
import manifest from './audio/manifest.json'

const urls = import.meta.glob('./audio/*.wav', {eager:true, query:'?url', import:'default'}) as Record<string,string>
export interface QuarryAudioSettings { environmentVolume:number; musicVolume?:number; audioMuted?:boolean }
interface SceneState {playing:boolean; inactive?:boolean; inCave:boolean; period:QuarryPeriod; saw:boolean; ropeway:number; winch:number; wind:number}
interface Voice {id:string; source:AudioBufferSourceNode; gain:GainNode; start:number; end:number; priority:number; nodes:AudioNode[]; dryEnd:number}
const amplitude=(value:number)=>Math.pow(Math.max(0,Math.min(100,value))/100,1.4)
const db=(value:number)=>Math.pow(10,value/20)

/** Only supplied recordings. Reverb uses delay taps, never a synthesized impulse. */
export function createQuarryAudio() {
  const ctx=new AudioContext({latencyHint:'interactive'}), abort=new AbortController()
  const env=ctx.createGain(), music=ctx.createGain(), ambient=ctx.createGain(), outdoor=ctx.createGain(), indoor=ctx.createGain()
  const outsideFilter=ctx.createBiquadFilter(), bgmFilter=ctx.createBiquadFilter(), bgmDuck=ctx.createGain()
  env.gain.value=0;music.gain.value=0;ambient.connect(env);outsideFilter.type='lowpass';outsideFilter.frequency.value=16000
  outdoor.connect(outsideFilter);outsideFilter.connect(ambient);indoor.connect(ambient)
  bgmFilter.type='lowpass';bgmFilter.frequency.value=16000;bgmFilter.connect(bgmDuck);bgmDuck.connect(music)
  env.connect(ctx.destination);music.connect(ctx.destination)
  const buffers=new Map<string,AudioBuffer>(), voices=new Set<Voice>(), loops=new Map<string,{source:AudioBufferSourceNode;gain:GainNode}>()
  const schedule=new QuarryBgmSchedule(), history:Array<Record<string,unknown>>=[], failures:string[]=[], lastVariants=new Map<string,string>()
  const footCalibration:Record<string,{inputRms:number;gain:number;outputRms:number}>={}
  let settings:QuarryAudioSettings={...QUARRY_AUDIO_DEFAULTS}, state:SceneState={playing:false,inCave:false,period:'day',saw:false,ropeway:0,winch:0,wind:0}
  let disposed=false, seeking=false, coreUntil=0, bellUntil=-99, bellAt=-99, actionUntil=-99, actionAt=-99, windStart=-99, nextWind=Infinity
  let lastWind=false, leafRecovery=-99
  const gainTargets=new WeakMap<AudioParam,number>()
  let nextBell=35, nextBird=18, windCorner=0, clock:ReturnType<typeof setInterval>
  let bgm:{source:AudioBufferSourceNode;gain:GainNode;end:number;offset:number}|null=null
  const ready=Promise.all(Object.entries(urls).map(async([path,url])=>{
    const name=path.split('/').pop()!.replace('.wav','')
    try {const response=await fetch(url,{signal:abort.signal});if(!response.ok)throw Error('missing');const b=await ctx.decodeAudioData(await response.arrayBuffer());if(!disposed)buffers.set(name,b)}
    catch {if(!disposed)failures.push(name)}
  })).then(()=>{
    for(const base of ['stone_step_dry','bridge_plank_step']){
      const group=['a','b','c'].map(v=>({name:base+'_'+v,buffer:buffers.get(base+'_'+v)})).filter(e=>!!e.buffer)
      const measured=group.map(({name,buffer})=>{let sum=0,peak=0;for(let c=0;c<buffer!.numberOfChannels;c++)for(const value of buffer!.getChannelData(c)){sum+=value*value;peak=Math.max(peak,Math.abs(value))}return {name,buffer:buffer!,rms:Math.sqrt(sum/(buffer!.length*buffer!.numberOfChannels)),peak}})
      const target=Math.min(.05,...measured.map(e=>.7*e.rms/Math.max(e.peak,1e-9)))
      for(const e of measured){const scale=target/Math.max(e.rms,1e-9);for(let c=0;c<e.buffer.numberOfChannels;c++){const data=e.buffer.getChannelData(c);for(let i=0;i<data.length;i++)data[i]*=scale}footCalibration[e.name]={inputRms:e.rms,gain:scale,outputRms:target}}
    }
  })
  function note(event:Record<string,unknown>) {history.push({...event,clock:ctx.currentTime});if(history.length>250)history.shift()}
  function gain(param:AudioParam,value:number,seconds=.05) {if(gainTargets.get(param)===value)return;gainTargets.set(param,value);const now=ctx.currentTime;param.cancelScheduledValues(now);param.setValueAtTime(param.value,now);param.linearRampToValueAtTime(value,now+seconds)}
  function enabled(){return !disposed&&!seeking&&state.playing&&!state.inactive&&!settings.audioMuted&&(settings.environmentVolume>0||(settings.musicVolume??25)>0)}
  function cleanup(v:Voice){voices.delete(v);v.source.disconnect();for(const node of v.nodes)node.disconnect()}
  function cancelShots(){for(const v of voices){try{v.source.stop()}catch{}cleanup(v)}}
  function stopMusic(seconds=0){if(!bgm)return;const old=bgm;bgm=null;gain(old.gain.gain,0,seconds);try{old.source.stop(ctx.currentTime+seconds)}catch{}}
  function shot(id:string,options:{delay?:number;rate?:number;gain?:number;pan?:number;lowpass?:number;room?:boolean;priority?:number;music?:boolean;duration?:number;fade?:number;bed?:boolean;offset?:number}={}) {
    const b=buffers.get(id);if(!b||!enabled()||ctx.state!=='running')return false
    const now=ctx.currentTime,start=now+(options.delay??0),rate=options.rate??1,offset=options.offset??0,dryEnd=start+Math.min(options.duration??Infinity,(b.duration-offset)/rate),end=dryEnd+(options.room?2.5:0)
    if(dryEnd-start<.005)return false
    const priority=options.priority??1
    const active=[...voices].filter(v=>v.priority>=0&&v.start<=start&&v.end>start)
    if(!options.bed&&active.length>=3){
      const old=active.sort((a,b)=>a.priority-b.priority||a.start-b.start)[0]
      if(old.priority>priority){note({dropped:id,reason:'theme voice priority'});return false}
      old.end=start;old.gain.gain.cancelScheduledValues(Math.max(now,start-.005));old.gain.gain.setValueAtTime(old.gain.gain.value,Math.max(now,start-.005));old.gain.gain.linearRampToValueAtTime(0,start)
      try{old.source.stop(start)}catch{}note({released:old.id,for:id})
    }
    const source=ctx.createBufferSource(),g=ctx.createGain(),p=ctx.createStereoPanner(),nodes:AudioNode[]=[g,p]
    source.buffer=b;source.playbackRate.value=rate;p.pan.value=options.pan??0
    const level=options.gain??1,fade=Math.min(options.fade??.035,(end-start)/3)
    g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(level,start+.005);g.gain.setValueAtTime(level,end-fade);g.gain.linearRampToValueAtTime(0,end)
    let final:AudioNode=source
    if(options.lowpass){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=options.lowpass;final.connect(f);final=f;nodes.push(f)}
    final.connect(g);g.connect(p);p.connect(options.music?music:env)
    if(options.room){
      const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=4000;final.connect(f);nodes.push(f)
      for(let i=0;i<38;i++){const d=ctx.createDelay(2.6),wet=ctx.createGain();d.delayTime.value=.073+i*2.427/37;wet.gain.value=.035*Math.exp(-3*d.delayTime.value/2.5);f.connect(d);d.connect(wet);wet.connect(g);nodes.push(d,wet)}
    }
    const v={id,source,gain:g,start,end,dryEnd,priority:options.bed?-1:priority,nodes};voices.add(v)
    source.onended=()=>{if(disposed||!options.room||v.end<=ctx.currentTime)cleanup(v);else source.disconnect()};source.start(start,offset);source.stop(dryEnd)
    note({id,start,end,dryEnd,offset,rate,gain:level,priority,pan:options.pan??0,music:!!options.music})
    return true
  }
  function loop(id:string,value:number,bus:AudioNode=outdoor,pan=0) {
    const b=buffers.get(id);if(!b)return
    let l=loops.get(id)
    if(!l){if(value<=0)return;const source=ctx.createBufferSource(),g=ctx.createGain(),p=ctx.createStereoPanner();source.buffer=b;source.loop=true;source.connect(g);g.connect(p);p.pan.value=pan;p.connect(bus);g.gain.value=0;source.start(0,(loops.size*2.7)%b.duration);l={source,gain:g};loops.set(id,l)}
    gain(l.gain.gain,value,id==='a05_stone_saw'?1:.7)
  }
  function variants(base:string,values:string[]) {const candidates=values.filter(v=>v!==lastVariants.get(base));const pick=candidates[Math.floor(Math.random()*candidates.length)];lastVariants.set(base,pick);return pick}
  function updateMix() {
    if(disposed)return
    if(!enabled()) {
      // Pause preserves the audio clock and scheduled cue offsets. Mute/hide
      // drops foreground/music so old events cannot play on restoration.
      if(state.inactive||settings.audioMuted||seeking||state.playing&&settings.environmentVolume<=0&&(settings.musicVolume??25)<=0){cancelShots();stopMusic();schedule.seek(ctx.currentTime)}
      if(ctx.state==='running')void ctx.suspend().catch(()=>undefined)
      return
    }
    if(ctx.state==='suspended')void ctx.resume().catch(()=>undefined)
    gain(env.gain,amplitude(settings.environmentVolume));gain(music.gain,amplitude(settings.musicVolume??25))
    const t=ctx.currentTime,core=t<coreUntil
    const bell= t<bellAt ? 1 : t<bellAt+.3 ? 1-.65*(t-bellAt)/.3 : t<bellUntil ? .35 : t<bellUntil+3 ? .35+.65*(t-bellUntil)/3 : 1
    const action= t<actionAt ? 1 : t<actionAt+.15 ? 1-.5*(t-actionAt)/.15 : t<actionUntil ? .5 : t<actionUntil+1.5 ? .5+.5*(t-actionUntil)/1.5 : 1
    gain(bgmDuck.gain,Math.min(bell,action),.03)
    const envBell=t<bellAt ? 1 : t<bellAt+.3 ? 1-.5*(t-bellAt)/.3 : t<bellUntil-2?.5:t<bellUntil-1?.5+.5*(t-(bellUntil-2)):1
    gain(ambient.gain,core?.3:envBell,.08)
    gain(outsideFilter.frequency,state.inCave?500:16000,.7)
    gain(bgmFilter.frequency,state.period==='night'?2500:16000,.7)
    if(bgm)gain(bgm.gain.gain,(state.inCave?.6:1)*(state.period==='night'?db(-2):1),.7)
    const periods:Record<QuarryPeriod,[number,number,number]>={dawn:[1,.7,.3],day:[1,1,0],dusk:[1,.85,.4],night:[.9,.5,1]}
    const [water,baseLeaves,insects]=periods[state.period],outside=state.inCave?.2:1
    if(lastWind&&state.wind<=0){leafRecovery=t;nextWind=Infinity;for(const v of voices)if(v.priority<0){v.end=Math.min(v.end,t+3);gain(v.gain.gain,0,3);try{v.source.stop(v.end)}catch{}}}
    lastWind=state.wind>0
    const leaves=state.wind>0?baseLeaves+(1-baseLeaves)*Math.min(1,Math.max(0,(t-windStart)/4)):t<leafRecovery+6?1+(baseLeaves-1)*Math.max(0,(t-leafRecovery)/6):baseLeaves
    loop('a05_amb_leaves',leaves*outside)
    loop('a05_amb_waterfall_far',Math.min(water,db(-4)*leaves)*outside,outdoor,-.35)
    loop('a05_amb_night_crickets',insects*outside)
    loop('a05_water_wheel',outside,outdoor,-.45)
    loop('a05_cave_room',state.inCave?1:0,indoor)
    loop('a05_stone_saw',state.saw&&!state.inCave?1:0,indoor)
    loop('a05_ropeway',state.ropeway>0&&!state.inCave?1:0,indoor)
    // Winch is a one-shot at cageBoost onset, not a permanent mechanical bed.
  }
  function tick() {
    for(const v of voices)if(v.end<=ctx.currentTime)cleanup(v)
    updateMix();if(!enabled()||ctx.state!=='running')return
    const now=ctx.currentTime
    if(bgm&&now>=bgm.end)bgm=null
    if(!bgm&&buffers.has('a05_bgm_day')) {
      const buffer=buffers.get('a05_bgm_day')!,cut=schedule.pick(now,state.period,state.wind>0||now<coreUntil,buffer.duration,manifest.musicBarAnalysis.energyPhaseSeconds)
      if(cut){
        const source=ctx.createBufferSource(),g=ctx.createGain();source.buffer=buffer;source.connect(g);g.connect(bgmFilter)
        const level=(state.inCave?.6:1)*(state.period==='night'?db(-2):1)
        // Separate entrance/cave gain from four-second segment fades.
        const envelope=ctx.createGain();g.disconnect();g.connect(envelope);envelope.connect(bgmFilter)
        g.gain.value=level;envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(1,now+4);envelope.gain.setValueAtTime(1,now+cut.seconds-4);envelope.gain.linearRampToValueAtTime(0,now+cut.seconds)
        bgm={source,gain:g,end:now+cut.seconds,offset:cut.offset};source.onended=()=>{source.disconnect();g.disconnect();envelope.disconnect()};source.start(now,cut.offset,cut.seconds)
        note({bgmOffset:cut.offset,bgmSeconds:cut.seconds,period:state.period})
      }
    }
    if(!state.inCave) {
      if(now>=nextBell){
        const windy=state.wind>0
        shot(windy?'a05_wind_bell_gust':'a05_wind_bell_soft',{pan:windy?[-.25,.25,.15,-.15][windCorner++%4]:Math.random()*.5-.25,rate:1+(Math.random()-.5)*.06})
        nextBell=now+(windy?2+Math.random()*3:state.period==='night'?60+Math.random()*60:state.period==='dusk'?40+Math.random()*40:30+Math.random()*30)
      }
      if(state.period!=='night'&&now>=nextBird){
        const name=variants('bird',['bird_0','bird_1','bird_2','bird_3'])
        shot(name,{gain:state.period==='day'?.6:state.period==='dusk'?.2:1,pan:Math.random()*.4-.2})
        nextBird=now+15+Math.random()*25
      }
    }
    if(!state.inCave&&now>=nextWind&&now<windStart+60){
      const rate=1+(Math.random()-.5)*.1,length=Math.min(20/rate,windStart+60-now)
      shot('a05_gust',{rate,duration:length,fade:3,bed:true});shot('a05_gust_leaves',{delay:1,rate,duration:Math.min(15/rate,Math.max(0,windStart+60-now-1)),fade:3,bed:true})
      nextWind=now+17
    }
  }
  clock=setInterval(tick,80)
  const gesture=()=>{if(enabled())void ctx.resume().catch(()=>undefined)}
  window.addEventListener('pointerdown',gesture);window.addEventListener('keydown',gesture)
  function actionDuck(delay=0){actionAt=ctx.currentTime+delay;actionUntil=Math.max(actionUntil,actionAt+.15)}
  function echo(kind:string,mouth=false) {
    const extra=mouth?db(-12):db(-8),o={gain:extra,room:true,lowpass:mouth?1500:undefined,pan:mouth?.5:0,priority:3}
    switch(kind){
      case 'chime':shot('a05_stone_chime_g6',o);shot('a05_stone_chime_d6',{...o,delay:1.1});break
      case 'echo':shot('a05_boulder_call',o);shot('a05_boulder_call',{...o,delay:.6,gain:extra*db(-9),lowpass:mouth?1500:2500});shot('a05_boulder_call',{...o,delay:1.2,gain:extra*db(-15),lowpass:mouth?1500:2500});break
      case 'bell':shot('a05_bell_strike',{...o,gain:mouth?extra:db(-10)});break
      case 'wind':shot('a05_wind_rock',{...o,rate:1.5});break
      case 'wall':shot('a05_wall_knock',o);break
    }
  }
  return {
    ready,
    settings(value:QuarryAudioSettings){settings={...value};updateMix()},
    update(value:SceneState){state={...value};updateMix()},
    cue(kind:string,payload:{strength?:number;echo?:string;k?:number;timelineRate?:number}={}) {
      if(seeking||disposed)return
      switch(kind){
        case 'pull':shot('a05_bell_log_pull');break
        case 'bell':if(shot('a05_bell_strike',{priority:3,rate:1+(Math.random()-.5)*(state.wind>0?.06:.04),gain:db(-3*(1-(payload.strength??1))-(state.wind>0?1+Math.random()*2:0))})){if(ctx.currentTime>=bellUntil)bellAt=ctx.currentTime;bellUntil=ctx.currentTime+8}break
        case 'chime':shot('a05_stone_chime_g6',{delay:.15,priority:3});shot('a05_stone_chime_d6',{delay:1.25,priority:3});actionDuck(.15);break
        case 'clap':shot('a05_boulder_call',{delay:.3});shot('a05_boulder_call',{delay:.9,gain:db(-9),lowpass:2500});shot('a05_boulder_call',{delay:1.5,gain:db(-15),lowpass:2500});actionDuck(.3);break
        case 'windRock':shot('a05_wind_rock',{rate:1.5});actionDuck();break
        case 'wall':shot('a05_wall_knock');actionDuck();break
        case 'cart':shot('a05_handcart');break
        case 'crane':shot('a05_crane');break
        case 'winch':shot('a05_winch');break
        case 'fork':shot('a05_tuning_fork');actionDuck();break
        case 'mica':shot('a05_mica_peel');break
        case 'mouthEcho':echo(payload.echo??'chime',true);break
        case 'caveEcho':echo(payload.echo??'chime');break
        case 'hum':shot('hum_stone_g2',{priority:2});break
        case 'wallWarm':shot('a05_wall_hum',{duration:1.2,room:true});break
        case 'murmur':shot('a05_wall_murmur');break
        case 'whistle':for(const [i,r] of [1,.98,1.01,.97].entries())shot('a05_wall_hum',{delay:i*.9,gain:db(8),rate:r,room:true});shot('a05_grit_fall',{delay:3,room:true});break
        case 'leaf':shot('a05_leaf_on_water',{room:true});break
        case 'coreStart':{
          coreUntil=Infinity;stopMusic(4)
          const peak=3.6/(payload.timelineRate??1)
          shot('a05_core_swell',{priority:3,delay:Math.max(0,peak-2.6),offset:Math.max(0,2.6-peak)})
          break
        }
        case 'coreHum':shot('hum_stone_g2',{priority:3,gain:db((payload.k??1)>=1.25?7:(payload.k??1)>1?5:3),rate:(payload.k??1)>=1.25?1.06:(payload.k??1)>1?1.03:1});break
        case 'coreWave':note({coreWave:ctx.currentTime});break
        case 'coreMotif':shot('core_motif_05',{priority:3,music:true});coreUntil=ctx.currentTime+(buffers.get('core_motif_05')?.duration??6);schedule.core(coreUntil);break
        case 'windStart':windStart=ctx.currentTime;nextWind=windStart;nextBell=windStart+2;if(!state.inCave)shot('a05_birds_flush');break
        case 'woodStep':case 'stoneStep':{
          const base=kind==='woodStep'?'bridge_plank_step':'stone_step_dry',name=variants(base,['a','b','c'].map(v=>base+'_'+v))
          shot(name,{gain:.12,rate:1+(Math.random()-.5)*.1});break
        }
      }
    },
    seek(begin:boolean){seeking=begin;cancelShots();stopMusic();schedule.seek(ctx.currentTime);if(!begin){lastWind=state.wind>0;leafRecovery=-99;if(state.wind>0){windStart=ctx.currentTime-(60-state.wind);nextWind=ctx.currentTime+17-(60-state.wind)%17}else nextWind=Infinity;updateMix()}},
    reset(){cancelShots();stopMusic();coreUntil=0;bellUntil=actionUntil=bellAt=actionAt=-99;windStart=leafRecovery=-99;lastWind=false;nextWind=Infinity;nextBell=ctx.currentTime+35;nextBird=ctx.currentTime+18;schedule.seek(ctx.currentTime)},
    debug(){return {loaded:buffers.size,failures:[...failures],footCalibration,context:ctx.state,clock:ctx.currentTime,settings,foreground:[...voices].filter(v=>v.priority>=0&&v.start<=ctx.currentTime&&v.end>ctx.currentTime).length,history:[...history],nextMusicAt:schedule.nextAt,music:bgm?{end:bgm.end,offset:bgm.offset}:null,coreUntil,windRockRate:1.5,inCave:state.inCave,period:state.period,seeking,bgmDuck:bgmDuck.gain.value,ambientDuck:ambient.gain.value,bgmFilter:bgmFilter.frequency.value,outsideFilter:outsideFilter.frequency.value}},
    dispose(){if(disposed)return;disposed=true;clearInterval(clock);abort.abort();window.removeEventListener('pointerdown',gesture);window.removeEventListener('keydown',gesture);cancelShots();stopMusic();for(const l of loops.values()){try{l.source.stop()}catch{}l.source.disconnect();l.gain.disconnect()}void ctx.close().catch(()=>undefined)}
  }
}

/** Area 05 silhouette only; owns no campfire or other-map sound layers. */
function createQuarryRecording(id:string) {
  const ctx=new AudioContext(),abort=new AbortController(),voices=new Set<AudioBufferSourceNode>()
  let b:AudioBuffer|null=null,disposed=false,settings:QuarryAudioSettings={...QUARRY_AUDIO_DEFAULTS},active=false
  const gains=new Map<AudioBufferSourceNode,GainNode>()
  const ready=fetch(urls[`./audio/${id}.wav`],{signal:abort.signal}).then(r=>r.arrayBuffer()).then(x=>ctx.decodeAudioData(x)).then(buffer=>{if(!disposed)b=buffer}).catch(()=>undefined)
  function cancel(){for(const source of voices){try{source.stop()}catch{}source.disconnect()}voices.clear()}
  return {ready,update(value:QuarryAudioSettings,on:boolean){settings=value;active=on&&!value.audioMuted&&value.environmentVolume>0;for(const g of gains.values())g.gain.setTargetAtTime(amplitude(value.environmentVolume),ctx.currentTime,.025);if(!active){cancel();void ctx.suspend().catch(()=>undefined)}else if(ctx.state==='suspended')void ctx.resume().catch(()=>undefined)},
    play(){if(!active||disposed||!b||ctx.state!=='running')return;cancel();const source=ctx.createBufferSource(),g=ctx.createGain();source.buffer=b;g.gain.value=amplitude(settings.environmentVolume);source.connect(g);g.connect(ctx.destination);source.onended=()=>{voices.delete(source);gains.delete(source);source.disconnect();g.disconnect()};voices.add(source);gains.set(source,g);source.start()},
    debug(){return {ready:!!b,active,context:ctx.state,voices:voices.size}},
    cancel,dispose(){disposed=true;abort.abort();cancel();void ctx.close().catch(()=>undefined)}}
}
export const createQuarryDistantBell=()=>createQuarryRecording('a05_distant_bell')
export const createQuarryHum=()=>createQuarryRecording('hum_stone_g2')

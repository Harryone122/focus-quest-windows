import { useEffect, useRef, useState } from 'react'
import type { AppSnapshot } from '../../../shared/types'
import type { FocusEventRecord, FocusRecap as Recap } from '../../../shared/focusPresentation'
import { recapLampCount, snapRecapEvent } from '../../../shared/focusRecap'
import { RecapDirector, type RecapView } from '../../../shared/recapDirector'
import { focusEventCaption } from '../../../shared/focusEventCatalog'
import { getRecapScene, type RecapScene } from '../recapScene'
import type { AfterFocusActions, AfterFocusModel } from './lobbyTypes'
import './focusRecap.css'

const minute=(s:number)=>Math.floor(Math.max(0,s)/60)
const kind=(e:FocusEventRecord)=>e.kind==='core'?'core':e.kind==='item'?'item':'clue'
const kindName={core:'地圖核心',item:'信物',clue:'故事線索'}
export function FocusRecap({snapshot,model,actions,busy=false}:{snapshot:AppSnapshot;model:AfterFocusModel;actions:AfterFocusActions;busy?:boolean}):React.JSX.Element {
  const sessionId=snapshot.pendingDebrief!.sessionId
  const host=useRef<HTMLDivElement>(null),track=useRef<HTMLDivElement>(null),director=useRef<RecapDirector|null>(null),stage=useRef<RecapScene|null>(null)
  const [recap,setRecap]=useState<Recap|null>(null),[view,setView]=useState<RecapView>({head:0,mode:'auto',event:null}),[error,setError]=useState(''),[ready,setReady]=useState(false),[hover,setHover]=useState<{seconds:number;event:FocusEventRecord|null}|null>(null)
  const skipped=useRef(false),drag=useRef<number|null>(null)
  const pointerClick=useRef(false)
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[])
  const current=useRef({snapshot,model,reduced});current.current={snapshot,model,reduced}
  useEffect(()=>{
    let live=true,raf=0,last=0
    void (async()=>{
      try{
        const data=await window.focusQuest.getFocusRecap(sessionId);if(!live)return;setRecap(data)
        const s=getRecapScene(sessionId,current.current.snapshot);stage.current=s;s.updateSnapshot(current.current.snapshot);s.updateSettings(current.current.snapshot.settings);s.warm(data.events)
        await s.claim(host.current!);if(!live)return
        const d=new RecapDirector(data,{
          event:e=>{let duration=0;s.transition(()=>{duration=s.begin(e,current.current.reduced)},current.current.reduced);return duration},
          frame:t=>s.frame(t,current.current.reduced),
          overview:(head,close)=>s.transition(()=>s.overview(current.current.model.map.litBefore+recapLampCount(data,head),close),current.current.reduced),
          change:v=>{if(live){setView(v);s.lamps(current.current.model.map.litBefore+recapLampCount(data,v.head))}}
        });director.current=d;setReady(true)
        if(skipped.current||model.step==='review')d.skipAll();else d.start()
        const frame=(now:number)=>{if(!live)return;try{d.tick(last?(now-last)/1000:0)}catch(reason){setError(String(reason));d.skipAll()}last=now;raf=requestAnimationFrame(frame)}
        raf=requestAnimationFrame(frame)
      }catch(reason){if(live){setError(String(reason));setView({head:model.effectiveSeconds,mode:'ask',event:null})}}
    })()
    return()=>{live=false;cancelAnimationFrame(raf);director.current=null;stage.current=null}
  },[sessionId])
  useEffect(()=>{stage.current?.updateSettings(snapshot.settings)},[snapshot.settings])
  useEffect(()=>{stage.current?.setReducedMotion(reduced)},[reduced])
  useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();skipAll()}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)},[])
  function skipAll():void{skipped.current=true;director.current?.skipAll();setView({head:model.effectiveSeconds,mode:'ask',event:null})}
  function position(x:number,y:number){const rect=track.current!.getBoundingClientRect(),seconds=Math.max(0,Math.min(1,(x-rect.left)/Math.max(1,rect.width)))*(recap?.effectiveSeconds??0),hit=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-record-id]')?.dataset.recordId,event=recap?.events.find(e=>e.id===hit)??(recap?snapRecapEvent(recap,seconds,rect.width):null);return {seconds:event?.effectiveSeconds??seconds,event}}
  function seek(x:number,y:number){const p=position(x,y);setHover(p);director.current?.seek(p.seconds);if(recap)stage.current?.lamps(model.map.litBefore+recapLampCount(recap,p.seconds));return p}
  const total=recap?.effectiveSeconds??model.effectiveSeconds,pct=(seconds:number)=>`${Math.max(0,Math.min(100,seconds/Math.max(1,total)*100))}%`
  const detail=view.event?focusEventCaption(view.event):null
  const storyFinds=recap?.events.filter(e=>e.kind==='story')??[]
  const asking=view.mode==='ask',automatic=view.mode==='auto'||view.mode==='scrub'
  return <section className={`focus-recap${reduced?' reduced':''}`} aria-label="專注結算回顧" data-mode={view.mode} data-ready={ready} data-event={view.event?.eventId??''}>
    <div className="fr-scene" ref={host}/>
    <header className="fr-top fr-glass"><span className="fr-label">專注結束</span><b>{model.map.title}</b><span>{model.task?.title}</span></header>
    {error&&<p className="fr-error fr-glass" role="alert">{error.replace(/^Error: /,'')}　<button onClick={skipAll}>全部跳過</button></p>}
    {!ready&&!error&&!asking&&<p className="fr-loading fr-glass" role="status">正在準備這一段的回顧…</p>}
    {view.event&&detail&&<article className={`fr-card fr-glass ${kind(view.event)}`} aria-live="polite"><div className="fr-label">第 {minute(view.event.effectiveSeconds)} 分鐘 · {detail.place}</div><div className="fr-card-row"><h3>{detail.name}</h3><span>{kindName[kind(view.event)]}</span></div><p>{detail.text}</p></article>}
    {asking&&<aside className="fr-ask fr-glass" aria-label="工作紀錄">
      <div className="fr-label">專注 {minute(model.effectiveSeconds)} 分鐘</div>
      {model.step==='task'&&model.task?<><h2>「{model.task.title}」</h2><p>完成了嗎？</p><div className="fr-answers"><button className="fr-primary" disabled={busy} onClick={()=>actions.answerTask(true)}>完成了</button><button className="fr-ghost" disabled={busy} onClick={()=>actions.answerTask(false)}>還沒</button></div>{model.nextTask&&<p className="fr-next">下一件：{model.nextTask.title}</p>}</>:<><h2>{model.resolution==='complete'?`${model.map.title}走完了`:'這一段已記下'}</h2>{model.pendingEvents.map(e=><div key={e.id} className="fr-choice"><p>{e.prompt}</p>{e.options.map(o=><button className="fr-ghost" key={o.id} disabled={busy} onClick={()=>actions.chooseEvent(e.id,o.id)}>{o.label}</button>)}</div>)}<button className="fr-primary" disabled={busy} onClick={actions.finish}>回到{model.map.sceneKey==='area-02-moss-station'?'候車室':'樹下'}</button></>}
      <div className="fr-got"><div className="fr-label">這次得到</div>{recap&&recap.lamps.length>0&&<div><i className="lamp"/><span>點亮 {recap.lamps.length} 盞燈</span></div>}{model.finds.map(f=><div key={f.key}><i className={f.kind==='clue'?'clue':f.kind}/><span>{f.title}</span></div>)}{storyFinds.map(e=><div key={e.id}><i className="clue"/><span>{focusEventCaption(e).name}</span></div>)}{!model.finds.length&&!recap?.lamps.length&&!storyFinds.length&&<p>{model.resolution==='too_short'?'這次不到 5 分鐘，工作時間已經記下。':'探索進度已記下，下次接著走。'}</p>}</div>
      <p className="fr-note">點時間軸上的記號，可以再看一次。</p>
    </aside>}
    <footer className="fr-bar fr-glass"><div className="fr-duration"><span className="fr-label">這次專注</span><b>{minute(total)} 分鐘</b></div>
      <div className="fr-track" ref={track} role="slider" aria-label="回顧時間軸" aria-valuemin={0} aria-valuemax={Math.floor(total)} aria-valuenow={Math.floor(view.head)} aria-valuetext={`第 ${minute(view.head)} 分鐘`} tabIndex={0}
        onPointerDown={e=>{if(!director.current||e.button!==0||drag.current!==null)return;e.preventDefault();drag.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);director.current.grab();seek(e.clientX,e.clientY)}}
        onPointerMove={e=>{if(drag.current===e.pointerId)seek(e.clientX,e.clientY);else setHover(position(e.clientX,e.clientY))}}
        onPointerUp={e=>{if(drag.current!==e.pointerId)return;const p=seek(e.clientX,e.clientY);drag.current=null;e.currentTarget.releasePointerCapture(e.pointerId);director.current?.release(p.event);setHover(null);pointerClick.current=true;window.setTimeout(()=>{pointerClick.current=false},0)}}
        onPointerCancel={()=>{drag.current=null;director.current?.release(null);setHover(null)}} onLostPointerCapture={()=>{if(drag.current!==null){drag.current=null;director.current?.release(null);setHover(null)}}} onPointerLeave={()=>{if(drag.current===null)setHover(null)}}
        onKeyDown={e=>{if(!director.current||!recap)return;let p=view.head;if(e.key==='Home')p=0;else if(e.key==='End')p=total;else if(e.key==='ArrowLeft')p-=60;else if(e.key==='ArrowRight')p+=60;else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(view.mode==='scrub')director.current.release(hover?.event??null);else director.current.grab();return}else return;e.preventDefault();if(view.mode!=='scrub')director.current.grab();director.current.seek(p);const event=snapRecapEvent(recap,Math.max(0,Math.min(total,p)),track.current!.clientWidth);setHover({seconds:p,event});stage.current?.lamps(model.map.litBefore+recapLampCount(recap,p))}}>
        <div className="fr-rail"/><div className="fr-fill" style={{width:pct(view.head)}}/>
        {Array.from({length:6},(_,i)=><span key={i} className="fr-tick" style={{left:`${i*20}%`}}>{minute(total*i/5)}</span>)}
        {recap?.lamps.map(e=><i key={e.id} className={`fr-lamp${e.effectiveSeconds<=view.head?' lit':''}`} style={{left:pct(e.effectiveSeconds)}} title={`第 ${minute(e.effectiveSeconds)} 分鐘點燈`}/>)}
        {recap?.events.map((e,i)=><button type="button" key={e.id} data-record-id={e.id} className={`fr-marker ${kind(e)}${view.event?.id===e.id?' active':''}`} style={{left:pct(e.effectiveSeconds),top:[26,8,44][recap.events.slice(0,i).filter(other=>Math.abs(other.effectiveSeconds-e.effectiveSeconds)/Math.max(1,total)*(track.current?.clientWidth??1000)<18).length%3]}} aria-label={`第 ${minute(e.effectiveSeconds)} 分鐘・${focusEventCaption(e).name}`} title={focusEventCaption(e).name} onClick={p=>{p.stopPropagation();if(pointerClick.current){pointerClick.current=false;return}director.current?.choose(e)}}/>)}
        <i className="fr-head" style={{left:pct(view.head)}}/>
        {hover&&<div className="fr-tip" style={{left:pct(hover.seconds)}}>第 {minute(hover.seconds)} 分鐘{hover.event&&` · ${focusEventCaption(hover.event).name}`}</div>}
      </div>
      <div className="fr-controls">{view.event&&<button className="fr-ghost" onClick={()=>director.current?.skipCurrent()}>跳過這段</button>}{automatic&&<button className="fr-ghost" onClick={skipAll}>全部跳過</button>}{!automatic&&!view.event&&<span className="fr-label">拖曳回看</span>}</div>
    </footer>
  </section>
}

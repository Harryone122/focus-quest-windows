import { useEffect, useRef, useState } from 'react'
import type { AppSnapshot } from '../../shared/types'
import { EventPlayback } from './EventPlayback'

export function BeforeFocusPlayback({snapshot,onChanged,ready}:{snapshot:AppSnapshot;onChanged:(s:AppSnapshot)=>void;ready:boolean}):React.JSX.Element {
  const session=snapshot.activeSession!,before=session.beforeFocus!,initial=useRef(before)
  const [index,setIndex]=useState(()=>before.queue.findIndex(e=>!before.startedIds.includes(e.id)))
  const [error,setError]=useState(''),[busy,setBusy]=useState(false)
  const skipped=useRef<string[]>(initial.current.startedIds.slice()),finished=useRef(false),begun=useRef(new Set(before.startedIds)),queue=initial.current.queue
  const event=queue[index]
  const start=async():Promise<void>=>{if(!event||begun.current.has(event.id))return;const s=await window.focusQuest.beginBeforeFocusEvent(session.id,event.id);begun.current.add(event.id);onChanged(s)}
  const next=():void=>setIndex(i=>i+1)
  const skip=async():Promise<void>=>{if(busy||!event)return;setBusy(true);try{await start();skipped.current.push(event.id);next()}catch(e){setError(String(e))}finally{setBusy(false)}}
  useEffect(()=>{
    if(event||finished.current)return;finished.current=true
    void window.focusQuest.finishBeforeFocus(session.id,skipped.current).then(onChanged).catch(e=>{finished.current=false;setError(String(e))})
  },[event?.id])
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();void skip()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[index,busy])
  return <div className="before-focus-playback" role="dialog" aria-modal="true" aria-label="出發前的故事">
    {event&&ready&&<EventPlayback record={event} settings={snapshot.settings} onStarted={start} onDone={next}/>}
    <div className="before-focus-controls"><span>{!ready?'正在抵達…':'出發前的故事'} · 專注尚未開始</span>{event&&<button disabled={busy} onClick={()=>void skip()}>跳過</button>}{error&&<p role="alert">{error}</p>}</div>
  </div>
}

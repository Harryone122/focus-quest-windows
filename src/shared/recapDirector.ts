import type { FocusEventRecord, FocusRecap } from './focusPresentation'

export interface RecapView { head:number; mode:'auto'|'ask'|'single'|'scrub'; event:FocusEventRecord|null }
export interface RecapDriver {
  event:(event:FocusEventRecord)=>number
  frame:(seconds:number)=>void
  overview:(head:number,close:boolean)=>void
  change:(view:RecapView)=>void
}
type Step={kind:'travel';to:number}|{kind:'event';event:FocusEventRecord}
/** Presentation-only state machine. The ledger and task result never depend on this clock. */
export class RecapDirector {
  view:RecapView={head:0,mode:'auto',event:null}
  readonly coreDone=new Set<string>()
  private steps:Step[]=[]
  private step:Step|null=null
  private elapsed=0
  private duration=0
  private from=0
  private completed=false
  private scrubAuto=false
  constructor(readonly recap:FocusRecap,private driver:RecapDriver){}
  start():void {if(this.recap.presentation==='live')this.finish();else this.resume(0,null,true)}
  private publish():void {this.driver.change({...this.view})}
  private next():void {
    this.step=this.steps.shift()??null;this.elapsed=0;this.from=this.view.head
    if(!this.step){this.finish();return}
    if(this.step.kind==='event'){
      this.view.event=this.step.event
      this.duration=this.driver.event(this.step.event)
    }else{
      this.view.event=null;this.driver.overview(this.view.head,false)
      this.duration=this.recap.events.length===0?2:Math.max(.3,Math.min(1.8,Math.abs(this.step.to-this.from)/Math.max(1,this.recap.effectiveSeconds)*4))
    }
    this.publish()
  }
  private finish():void {
    this.step=null;this.steps=[];this.completed=true
    this.view={head:this.recap.effectiveSeconds,mode:'ask',event:null}
    this.driver.overview(this.view.head,true);this.publish()
  }
  private resume(head:number,target:FocusEventRecord|null=null,includeCurrent=false):void {
    this.view={head,mode:'auto',event:null}
    const ordinary=this.recap.events.filter(e=>e.kind!=='core').sort((a,b)=>a.effectiveSeconds-b.effectiveSeconds||a.id.localeCompare(b.id))
    const index=target&&target.kind!=='core'?ordinary.findIndex(e=>e.id===target.id):-1
    const remaining=index>=0?ordinary.slice(index):ordinary.filter(e=>includeCurrent?e.effectiveSeconds>=head:e.effectiveSeconds>head+.0001)
    this.steps=remaining.flatMap(e=>[{kind:'travel',to:Math.max(head,e.effectiveSeconds)},{kind:'event',event:e}] as Step[])
    this.steps.push({kind:'travel',to:this.recap.effectiveSeconds})
    for(const e of this.recap.events.filter(e=>e.kind==='core'&&!this.coreDone.has(e.id)))this.steps.push({kind:'event',event:e})
    this.next()
  }
  tick(delta:number):void {
    if(!this.step||this.view.mode==='scrub'||this.view.mode==='ask')return
    this.elapsed+=Math.max(0,delta)
    if(this.step.kind==='travel'){
      this.view.head=this.from+(this.step.to-this.from)*Math.min(1,this.elapsed/this.duration)
    }else this.driver.frame(Math.min(this.duration,this.elapsed))
    this.publish()
    if(this.elapsed>=this.duration){
      if(this.step.kind==='event'&&this.step.event.kind==='core')this.coreDone.add(this.step.event.id)
      this.next()
    }
  }
  grab():void {
    this.scrubAuto=!this.completed&&this.view.mode==='auto';this.steps=[];this.step=null
    this.view={...this.view,mode:'scrub',event:null};this.driver.overview(this.view.head,false);this.publish()
  }
  seek(head:number):void {this.view.head=Math.max(0,Math.min(this.recap.effectiveSeconds,head));this.publish()}
  release(target:FocusEventRecord|null):void {
    if(this.scrubAuto){this.resume(this.view.head,target);return}
    if(!target){this.finish();return}
    this.view={head:target.effectiveSeconds,mode:'single',event:null};this.steps=[{kind:'event',event:target}];this.next()
  }
  choose(target:FocusEventRecord):void {this.grab();this.seek(target.effectiveSeconds);this.release(target)}
  skipCurrent():void {if(this.step?.kind==='event'){if(this.step.event.kind==='core')this.coreDone.add(this.step.event.id);this.next()}}
  skipAll():void {this.finish()}
}

import { focusEventDefinition } from '../src/shared/focusEventCatalog'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { FocusQuestDatabase } from '../src/main/database'
import { focusElapsedSeconds } from '../src/shared/focusTime'
import { QUIET_FOCUS, recapOrder } from '../src/shared/focusPresentation'
let db:FocusQuestDatabase
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-14T03:00:00Z'));db=new FocusQuestDatabase(':memory:')})
afterEach(()=>{db.close();vi.useRealTimers()})
const advance=(n:number)=>vi.setSystemTime(Date.now()+n*1000)
function start(map='area-01-cloud-ruins') {
  let s=db.addListTask({title:'安靜專注測試'});s=db.startDailyRun(s.taskList.nextTaskId!);const node=s.expeditionNodes[0]
  const b=db.exportBackup();(b.data.expedition_nodes as any[]).find(n=>n.id===node.id).area_id=map;db.importBackup(b)
  s=db.selectExpeditionNode(s.todayRun!.id,node.id)
  return db.startListFocus({minimumMinutes:5,blockedProcessNames:[],runId:s.todayRun!.id,nodeId:node.id,plannedMinutes:node.plannedMinutes})
}
function finishIntro(skipped=false){const session=db.getSnapshot().activeSession!;for(const e of session.beforeFocus?.queue??[])db.beginBeforeFocusEvent(session.id,e.id);return db.finishBeforeFocus(session.id,skipped?session.beforeFocus!.queue.map(e=>e.id):[])}
it('defaults old saves/settings to quiet, saves the mode per session, and changes only the next Focus',()=>{
  const s=start();expect(s.settings.focusPresentation).toBe('quiet');expect(s.activeSession!.presentation).toBe('quiet')
  db.updateSettings({focusPresentation:'live'});expect(db.getSnapshot().activeSession!.presentation).toBe('quiet')
  const b=db.exportBackup();const restored=new FocusQuestDatabase(':memory:');restored.importBackup(b);expect(restored.getSnapshot().settings.focusPresentation).toBe('live');expect(restored.getSnapshot().activeSession!.presentation).toBe('quiet');restored.close()
  const old=structuredClone(b);old.version=13;delete old.data.focus_event_records
  for(const r of old.data.settings as any[])delete r.focus_presentation
  for(const r of old.data.sessions as any[]){delete r.focus_presentation;delete r.before_focus;delete r.before_focus_completed}
  db.importBackup(old);expect(db.getSnapshot().settings.focusPresentation).toBe('quiet')
})
it.each(['area-01-cloud-ruins','area-02-moss-station','area-03-reflection-lake','area-07-glass-nursery'])('keeps %s stories and departures outside time; grants and records on playback start',map=>{
  let s=start(map),session=s.activeSession!;expect(session.beforeFocus!.queue.length).toBeGreaterThan(0)
  advance(90);expect(db.processActiveSpecialFinds()).toBe(false);expect(focusElapsedSeconds(db.getSnapshot().activeSession!)).toBe(0);expect(db.listReplayEvents()).toHaveLength(0)
  for(const e of session.beforeFocus!.queue)expect(focusEventDefinition(e.mapId,e.variant).seconds).toBeGreaterThan(0)
  const event=session.beforeFocus!.queue[0];s=db.beginBeforeFocusEvent(session.id,event.id);expect(db.getReplayEvent(event.id).phase).toBe('before');expect(s.collection.clues.length).toBeGreaterThan(0)
  if(session.beforeFocus!.queue.length>1)expect(()=>db.finishBeforeFocus(session.id)).toThrow();s=finishIntro(true);expect(s.activeSession!.beforeFocus).toBeNull();expect(focusElapsedSeconds(s.activeSession!)).toBe(0)
  expect(db.listReplayEvents().every(e=>e.skipped)).toBe(true)
  advance(600);db.processActiveSpecialFinds();expect(focusElapsedSeconds(db.getSnapshot().activeSession!)).toBe(600);expect(db.getFocusRecap(session.id).lamps.map(e=>e.effectiveSeconds)).toEqual([600])
})
it('recovers a started/closed/skipped story from backup without granting it twice',()=>{
  const s=start(),session=s.activeSession!,e=session.beforeFocus!.queue[0]
  db.beginBeforeFocusEvent(session.id,e.id);const backup=db.exportBackup();db.importBackup(backup)
  const recovered=db.getSnapshot().activeSession!;expect(recovered.beforeFocus!.startedIds).toContain(e.id)
  db.beginBeforeFocusEvent(session.id,e.id);expect(db.listReplayEvents().filter(r=>r.id===e.id)).toHaveLength(1)
  finishIntro(true);expect(db.getReplayEvent(e.id).skipped).toBe(true)
})
it('maintains live behaviour and does not prepare stories before its timer',()=>{
  db.updateSettings({focusPresentation:'live'});const s=start('area-02-moss-station');expect(s.activeSession!.beforeFocus).toBeNull()
  advance(1200);db.processActiveSpecialFinds();expect(db.getFocusRecap(s.activeSession!.id).effectiveSeconds).toBe(1200);expect(db.listReplayEvents().some(e=>e.eventId==='story_open_carving')).toBe(true)
})
it('recap/replay reads cannot modify records, clues, marks or a later journey',()=>{
  const s=start();finishIntro();advance(3000);db.beginSessionDebrief(s.activeSession!.id)
  const before=db.exportBackup().data,recap=db.getFocusRecap(s.activeSession!.id);for(const e of db.listReplayEvents())db.getReplayEvent(e.id)
  expect(db.exportBackup().data).toEqual(before);expect(recap.effectiveSeconds).toBe(3000);expect(recap.lamps).toHaveLength(5)
  const core=recap.events.find(e=>e.kind==='core');if(core)expect(recap.events.at(-1)).toBe(core)
})
it('records time relative to a resumed Focus and never repeats its pre-Focus story',()=>{
  let s=start();finishIntro();advance(900);const first=s.activeSession!.id;db.beginSessionDebrief(first);db.finishListFocus(first,false);s=db.dismissDebrief(first)
  const n=s.expeditionNodes.find(n=>n.id===s.todayRun!.selectedNodeId)!;s=db.startListFocus({minimumMinutes:5,blockedProcessNames:[],runId:s.todayRun!.id,nodeId:n.id,plannedMinutes:n.plannedMinutes})
  expect(s.activeSession!.beforeFocus).toBeNull();advance(300);db.processActiveSpecialFinds();expect(db.getFocusRecap(s.activeSession!.id).lamps.map(e=>e.effectiveSeconds)).toEqual([300])
})
it('pause and sleep freeze quiet Focus and retain immutable replay parameters',()=>{
  let s=start('area-02-moss-station');s=finishIntro();advance(610);s=db.pauseFocus(s.activeSession!.id);const before=db.listReplayEvents()
  db.suspendActiveSession();advance(900);db.resumeActiveSession();expect(focusElapsedSeconds(db.getSnapshot().activeSession!)).toBe(610);expect(db.listReplayEvents()).toEqual(before)
  s=db.resumeFocus(s.activeSession!.id);advance(10);expect(focusElapsedSeconds(s.activeSession!)).toBe(620)
})
it('rejects invalid presentation backups without replacing any save',()=>{
  start();finishIntro();const b=db.exportBackup();(b.data.focus_event_records[0] as any).payload='{"id":1}'
  const before=db.exportBackup().data;expect(()=>db.importBackup(b)).toThrow();expect(db.exportBackup().data).toEqual(before)
})
it('orders recap by effective time with cores last, and centralises quiet calibration',()=>{
  const s=start();finishIntro();const r=db.listReplayEvents()[0]
  const a={...r,phase:'focus' as const,kind:'core' as const,effectiveSeconds:2},b={...r,phase:'focus' as const,kind:'item' as const,effectiveSeconds:23}
  expect(recapOrder([a,b]).map(e=>e.kind)).toEqual(['item','core']);expect(QUIET_FOCUS.audioGain).toBeCloseTo(.501187);expect(QUIET_FOCUS.lampSeconds).toBe(3)
})

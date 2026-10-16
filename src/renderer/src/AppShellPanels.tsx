import { useState } from 'react'
import type { AppSettings, AppSnapshot, ReminderPolicy } from '../../shared/types'
import { DELETE_YESTERDAY_CONFIRMATION } from '../../shared/taskList'
import packageInfo from '../../../package.json'

type Props = { snapshot: AppSnapshot; onChanged: (next: AppSnapshot) => void; onError: (message: string) => void; onNotice: (message: string) => void }
const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error)).replace(/^Error invoking remote method '[^']+': Error: /, '')
const minutes = (seconds: number): number => Math.floor(seconds / 60)
const duration = (seconds: number): string => `${Math.floor(seconds / 3600)} 小時 ${Math.floor((seconds % 3600) / 60)} 分鐘`
const dayLabel = (iso: string): string => { const date = new Date(iso); return `${date.getMonth() + 1}/${date.getDate()}` }
const WEEKDAYS = [{ id: 1, label: '一' }, { id: 2, label: '二' }, { id: 3, label: '三' }, { id: 4, label: '四' }, { id: 5, label: '五' }, { id: 6, label: '六' }, { id: 0, label: '日' }]

export function LogPanel({ snapshot }: { snapshot: AppSnapshot }): React.JSX.Element {
  const { days, sessions, journeys } = snapshot.activityLog
  const lastSeven = days.slice(-7)
  const sevenSeconds = lastSeven.reduce((sum, day) => sum + day.seconds, 0)
  const sevenCompleted = lastSeven.reduce((sum, day) => sum + day.completedTasks, 0)
  const max = Math.max(7200, ...days.map((day) => day.seconds))
  return <div className="shell-panel-body">
    <p className="shell-intro">只看做了什麼，不評價你這個人。</p>
    <div className="shell-stats"><div><span>今天</span><strong>{minutes(days.at(-1)?.seconds ?? 0)}</strong><small>分鐘</small></div><div><span>這 7 天</span><strong>{duration(sevenSeconds)}</strong></div><div><span>這 7 天完成的事</span><strong>{sevenCompleted}</strong><small>件</small></div></div>
    <section className="shell-group"><div className="shell-group-head"><h3>近 14 天的專注</h3><span>平均每天 {minutes(days.reduce((sum, day) => sum + day.seconds, 0) / 14)} 分鐘</span></div>
      <div className="shell-chart"><div className="shell-axis"><span>{Math.ceil(max / 3600)}h</span><span>{Math.ceil(max / 7200)}h</span><span>0</span></div><div className="shell-bars">{days.map((day, index) => <div key={day.day} title={`${day.day.slice(5).replace('-', '/')} · ${minutes(day.seconds)} 分鐘`} className="shell-bar"><i className={index === 13 ? 'today' : ''} style={{ height: `${Math.max(2, day.seconds / max * 100)}%` }} /><small>{index === 13 ? '今天' : index % 2 === 0 && index !== 12 ? day.day.slice(5).replace('-', '/') : ''}</small></div>)}</div></div>
    </section>
    <section className="shell-group"><h3>最近的專注</h3>{sessions.length ? sessions.map((session) => <div className="shell-list-row" key={session.id}><div><strong>{session.title}</strong><small>{dayLabel(session.startedAt)} {new Date(session.startedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} · {session.mapTitle ?? '未指定地圖'}</small></div><span>{minutes(session.seconds)} 分鐘</span><em className={session.completed ? 'done' : ''}>{session.completed ? '✓ 完成' : '還沒做完'}</em></div>) : <p className="shell-empty">還沒有專注紀錄。</p>}</section>
    <section className="shell-group"><h3>走過的旅程</h3>{journeys.length ? journeys.map((journey, index) => <div className="shell-journey" key={journey.id}><div><strong>第 {journeys.length - index} 趟</strong><small>{dayLabel(journey.startedAt)}{journey.endedAt ? ` — ${dayLabel(journey.endedAt)}` : ` · 走到第 ${journey.maps.length} 段`}</small></div><p>{journey.maps.length ? journey.maps.join(' → ') : '尚未踏上地圖'}</p><small>核心：{journey.cores.length ? journey.cores.join('、') : '尚未取得'}</small></div>) : <p className="shell-empty">還沒有旅程紀錄。</p>}</section>
  </div>
}

export function SettingsPanel({ snapshot, onChanged, onError, onNotice }: Props): React.JSX.Element {
  const [confirmRestore, setConfirmRestore] = useState(false)
  const update = async (patch: Partial<AppSettings>): Promise<void> => { try { onChanged(await window.focusQuest.updateSettings(patch)) } catch (error) { onError(errorText(error)) } }
  const exportData = async (kind: 'backup' | 'analytics'): Promise<void> => { try {
    const result = kind === 'backup' ? await window.focusQuest.exportBackup() : await window.focusQuest.exportAnalytics()
    if (!result.canceled) onNotice(kind === 'backup' ? '備份已匯出。' : '匿名使用紀錄已匯出。')
  } catch (error) { onError(errorText(error)) } }
  const restore = async (): Promise<void> => { setConfirmRestore(false); try { const result = await window.focusQuest.importBackup(); if (!result.canceled) { onChanged(await window.focusQuest.getSnapshot()); onNotice('備份已還原。') } } catch (error) { onError(errorText(error)) } }
  const option = <T extends string>(value: T, choices: Array<{ key: T; label: string }>, apply: (key: T) => void): React.JSX.Element => <div className="shell-options">{choices.map((choice) => <button key={choice.key} type="button" aria-pressed={value === choice.key} onClick={() => apply(choice.key)}>{choice.label}</button>)}</div>
  const s = snapshot.settings
  return <div className="shell-panel-body shell-settings">
    <section className="shell-group"><h3>專注</h3><div className="shell-setting-row"><div><strong>提醒</strong><small>{s.reminderPolicy === 'off' ? '不發提醒，讓你安靜前進。' : s.reminderPolicy === 'gentle' ? '需要時輕輕提醒你。' : '依照你的節奏安排提醒。'}</small></div>{option<ReminderPolicy>(s.reminderPolicy, [{ key: 'off', label: '安靜' }, { key: 'gentle', label: '溫和' }, { key: 'structured', label: '有節奏' }], (key) => void update({ reminderPolicy: key }))}</div>
      <div className="shell-setting-row"><div><strong>專注中的演出</strong><small>從下一次專注生效。安靜模式把完整演出留到專注後。</small></div>{option(s.focusPresentation ?? 'quiet', [{key:'quiet',label:'安靜'},{key:'live',label:'現場'}], key=>void update({focusPresentation:key}))}</div>
      {s.reminderPolicy === 'structured'  && <label className="shell-setting-row"><span>晚上整理今天的時間</span><input type="time" value={s.eveningReminder} onChange={(event) => void update({ eveningReminder: event.target.value })} /></label>}
      <label className="shell-setting-row"><span>開始前確認手機放遠</span><input type="checkbox" checked={s.phoneRitual} onChange={(event) => void update({ phoneRitual: event.target.checked })} /></label></section>
    <section className="shell-group shell-audio-group"><h3>旅途聲音</h3><p className="shell-intro">環境聲會跟著天氣變化。拉到 0 就關閉。</p>
      <label className="shell-setting-row"><span>全部靜音</span><input aria-label="全部靜音" type="checkbox" checked={s.audioMuted} onChange={event => void update({ audioMuted: event.target.checked })} /></label>
      <label className="shell-setting-row"><span>環境音</span><input aria-label="環境音音量" type="range" min="0" max="100" value={s.environmentVolume} onChange={event => void update({ environmentVolume: Number(event.target.value) })} /><output>{s.environmentVolume}%</output></label>
      <label className="shell-setting-row"><span>背景音</span><input aria-label="背景音音量" type="range" min="0" max="100" value={s.musicVolume} onChange={event => void update({ musicVolume: Number(event.target.value) })} /><output>{s.musicVolume}%</output></label>
    </section>
    <section className="shell-group"><h3>資料 <small>只存在這台電腦</small></h3><div className="shell-data-actions"><button onClick={() => void exportData('backup')}>備份</button><button onClick={() => setConfirmRestore(true)}>還原</button><button onClick={() => void exportData('analytics')}>匿名使用紀錄</button></div>
      {confirmRestore && <div className="shell-confirm" role="alertdialog" aria-label="確認還原"><p>還原備份會取代目前所有事項與進度。確定繼續嗎？</p><button onClick={() => void restore()}>選擇備份並還原</button><button onClick={() => setConfirmRestore(false)}>取消</button></div>}</section>
    <p className="shell-version">Focus Quest v{packageInfo.version}</p>
  </div>
}

export function AllTasksPanel({ snapshot, onChanged, onError, onNotice }: Props): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [placement, setPlacement] = useState<'today' | 'backlog' | 'routine'>('today')
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const { today, yesterday, backlog, routines } = snapshot.taskList
  const mutate = async (operation: () => Promise<AppSnapshot>, notice?: string): Promise<void> => { if (busy) return; setBusy(true); try { onChanged(await operation()); if (notice) onNotice(notice) } catch (error) { onError(errorText(error)) } finally { setBusy(false) } }
  const add = (): void => { const title = draft.trim(); if (!title || (placement === 'routine' && !weekdays.length)) return
    void mutate(() => placement === 'routine' ? window.focusQuest.saveRoutines([...routines, { title, weekdays, enabled: true }]) : window.focusQuest.addListTask({ title, placement }), '已加入清單。'); setDraft('') }
  return <div className="shell-panel-body shell-tasks">
    {!!yesterday.length && <section className="shell-group shell-yesterday"><h3>昨天沒做完</h3><p>{yesterday.map((task) => task.title).join('、')}</p><div className="shell-actions"><button disabled={busy} onClick={() => void mutate(() => window.focusQuest.moveTasksToToday(yesterday.map((task) => task.id)))}>全部移到今天</button><button disabled={busy} onClick={() => setConfirmDelete(true)}>刪除</button></div>{confirmDelete && <div className="shell-confirm" role="alertdialog" aria-label="確認刪除昨天事項"><p>永久刪除這 {yesterday.length} 件？這個動作無法復原。</p><button disabled={busy} onClick={() => { setConfirmDelete(false); void mutate(() => window.focusQuest.deleteYesterdayTasks({ localDay: snapshot.taskList.localDay, taskIds: yesterday.map((task) => task.id), confirmation: DELETE_YESTERDAY_CONFIRMATION })) }}>永久刪除</button><button onClick={() => setConfirmDelete(false)}>取消</button></div>}</section>}
    <section className="shell-group"><h3>新增一件事</h3><div className="shell-add"><input aria-label="事項名稱" placeholder="寫下這次想做的事" value={draft} disabled={busy} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) add() }} /><button disabled={busy || !draft.trim()} onClick={add}>加入</button></div><div className="shell-options">{([['today', '放到今天'], ['backlog', '之後再做'], ['routine', '每週例行']] as const).map(([key, label]) => <button key={key} aria-pressed={placement === key} onClick={() => setPlacement(key)}>{label}</button>)}</div>{placement === 'routine' && <Weekdays value={weekdays} onChange={setWeekdays} />}</section>
    <section className="shell-group"><h3>今天的清單</h3>{today.length ? today.map((task, index) => <div className="shell-list-row" key={task.id}><span>{index + 1}.</span><strong className={task.completed ? 'completed' : ''}>{task.routineId && '↻ '}{task.title}</strong>{!task.routineId && !task.completed && <button disabled={busy} onClick={() => void mutate(() => window.focusQuest.setTaskRole(task.id, 'backlog'))}>之後再做</button>}</div>) : <p className="shell-empty">今天還沒有事項。</p>}</section>
    <section className="shell-group"><h3>之後再做</h3>{backlog.length ? backlog.map((task) => <div className="shell-list-row" key={task.id}><strong>{task.title}</strong><small>{task.parkedAt ? `暫放於 ${dayLabel(task.parkedAt)}` : '暫放中'}</small><button disabled={busy} onClick={() => void mutate(() => window.focusQuest.moveTasksToToday([task.id]))}>放到今天</button><button className="shell-delete" aria-label={`刪除${task.title}`} disabled={busy} onClick={() => void mutate(() => window.focusQuest.deleteListTask(task.id))}>×</button></div>) : <p className="shell-empty">沒有暫放的事。</p>}</section>
    <section className="shell-group"><h3>每週例行</h3>{routines.length ? routines.map((routine) => <div className="shell-routine" key={routine.id}><strong>↻ {routine.title}</strong><Weekdays value={routine.weekdays} onChange={(days) => { if (days.length) void mutate(() => window.focusQuest.saveRoutines(routines.map((item) => item.id === routine.id ? { ...item, weekdays: days } : item))) }} /><button className="shell-delete" disabled={busy} aria-label={`刪除${routine.title}`} onClick={() => void mutate(() => window.focusQuest.saveRoutines(routines.filter((item) => item.id !== routine.id)))}>×</button></div>) : <p className="shell-empty">還沒有每週例行。</p>}</section>
    <section className="shell-group"><h3>最近完成</h3>{snapshot.activityLog.recentlyCompleted.length ? snapshot.activityLog.recentlyCompleted.map((task) => <div className="shell-list-row" key={task.id}><strong className="completed">{task.title}</strong><small>{dayLabel(task.completedAt)}</small><button disabled={busy} onClick={() => void mutate(() => window.focusQuest.addListTask({ title: task.title, placement: 'today' }))}>再做一次</button></div>) : <p className="shell-empty">近 14 天還沒有完成事項。</p>}</section>
  </div>
}

function Weekdays({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }): React.JSX.Element {
  return <div className="shell-weekdays" role="group" aria-label="每週星期">{WEEKDAYS.map((day) => <button key={day.id} type="button" aria-label={`星期${day.label}`} aria-pressed={value.includes(day.id)} onClick={() => onChange(value.includes(day.id) ? value.filter((item) => item !== day.id) : [...value, day.id].sort())}>{day.label}</button>)}</div>
}

import { TravelLoading } from './loading/TravelLoading'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppSnapshot } from '../../shared/types'
import { CORE_UNDERSTANDING_CLUES } from '../../shared/collectionRoom'
import prototypeHtml from '../../../docs/prototypes/collection-room.html?raw'
import threeModuleUrl from './cloudRuins/vendor/three.module.js?url'
import { IFRAME_FRAME_SOURCE, PACED_IFRAME_FRAME_SOURCE } from './framePacing.js'
import './collectionRoom.css'

const MAP_INDEX: Record<string, number> = {
  'area-01-cloud-ruins': 1,
  'area-02-moss-station': 2,
  'area-03-stillwater-mirror-lake': 3,
  'area-03-reflection-lake': 3,
  'area-04-windcut-broken-bridge': 4,
  'area-05-echo-quarry': 5,
  'area-06-tidal-post': 6,
  'area-07-glass-nursery': 7,
  'area-08-silent-library': 8,
  'area-09-stopped-clocktower': 9,
  'area-10-refraction-observatory': 10
}

interface RoomBridge {
  S: { busy: boolean; bulkPinning: boolean }
  applyExternalState: (state: RoomState) => void
  pinAllClues: (clueIds: string[]) => void
  enterBag: (placeNew: boolean, targetIndex?: number) => void
  enterTable: () => void
  pinClue: (clueId: string) => void
  playLink: () => void
  advance: (seconds: number) => void
}

interface RoomState {
  clues: Record<string, { kind: string; from: string; src: string; text: string; place?: string }>
  visited: string[]
  pinned: string[]
  tray: string[]
  found: string[]
  bag: string[]
  tracking: string | null
  linked: boolean
  journeys: number
  cores: Record<number, 0 | 1 | 2>
  lakeBoots: boolean
  saplingInLuggage: boolean
  nurseryEnding: boolean
}

declare global {
  interface Window { __room?: RoomBridge; __hold?: boolean }
}

export function roomDocument(html = prototypeHtml, threeUrl = new URL(threeModuleUrl, window.location.href).href): string {
  // Raw files retain Windows CRLF. Normalize before matching multiline bridge hooks.
  return html.replace(/\r\n?/g, '\n')
    .replace(/<link rel="preconnect"[^>]*>\s*/g, '')
    .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/g, '')
    .replace('</style>', `.proto { display: none !important; }
      .top-left,.tbar { left: 112px; } .tray { left: 112px; max-width: calc(100% - var(--panel-w) - 160px); }
      #backBtn { display: none; }
      @media (max-width: 760px) { .top-left,.tbar,.tray { left: 16px; } .tray { max-width: calc(100% - 32px); bottom: 90px; } }
      </style>`)
    .replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script>', `<script type="module">\nimport * as THREE from ${JSON.stringify(threeUrl)};\nwindow.THREE = THREE;`)
    .replace(IFRAME_FRAME_SOURCE, PACED_IFRAME_FRAME_SOURCE)
    .replace('function enterBag(placeNew) {', 'function enterBag(placeNew, targetIndex) {')
    .replace("exhibit(3, '留影玻璃'", "exhibit(3, '湖鏡'")
    // The water disc cannot sample its own render target during the reflection pass.
    // Main view includes layer 2; the reflection camera retains the room and ghost layers.
    .replace('e.core.add(water);', 'e.core.add(water); water.layers.set(2); camera.layers.enable(2);')
    .replace("GHOSTS.forEach((gh, n) => { gh.visible = s === 1 ? n < 2 : s > 1; });", "GHOSTS.forEach((gh, n) => { gh.visible = s > 0 && (n < 2 || (n === 3 ? Boolean(S.lakeBoots) : s > 1)); });")
    .replace("let target = null; if (placeNew) { const order = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1]; const i = order.find((n) => EX[n].state === 0); if (i) target = EX[i]; }",
      "let target = null; if (placeNew) { const order = targetIndex ? [targetIndex] : [2, 3, 4, 5, 6, 7, 8, 9, 10, 1]; const i = order.find((n) => EX[n].state === 0); if (i) target = EX[i]; }")
    .replace("for (let i = 1; i <= 10; i++) setState(i, 2, false);", "for (let i = 1; i <= 10; i++) setState(i, Math.max(1, EX[i].state), false);")
    .replace("$('backBtn').addEventListener('click', () => toast('（回到大廳：鏡頭從包口退出來）'));",
      "$('backBtn').addEventListener('click', () => parent.postMessage({ source: 'focusquest-collection-room', type: 'back' }, '*'));")
    .replace("if (S.busy || !S.tray.includes(cid)) return; S.busy = true;",
      "if (S.busy || !S.tray.includes(cid)) return; if (!S.bulkPinning) parent.postMessage({ source: 'focusquest-collection-room', type: 'pin', clueId: cid }, '*'); S.busy = true;")
    .replace("function pinAllClues(list) {", "window.__roomPinAll = (clueIds) => parent.postMessage({ source: 'focusquest-collection-room', type: 'pin-all', clueIds }, '*'); function pinAllClues(list) {")
    .replace("S.tracking = S.tracking === pid ? null : pid; boardDirty = true;",
      "S.tracking = S.tracking === pid ? null : pid; parent.postMessage({ source: 'focusquest-collection-room', type: 'tracking', placeId: S.tracking }, '*'); boardDirty = true;")
    .replace('resize(); applyPreset(1);', 'resize(); applyPreset(0);')
    .replace("{ const v = $('veil'); v.style.opacity = '1'; requestAnimationFrame(() => { v.style.transition = 'opacity 1.2s ease'; v.style.opacity = '0'; }); }", "{ $('veil').style.opacity = '0'; }")
    .replace('const jpItems = [];', `const nurseryCup=new T.Group();scene.add(nurseryCup);nurseryCup.position.set(2.4,.16,2.5);nurseryCup.visible=false;cyl(.18,.14,.23,8,M.paperOld,nurseryCup,0,.12,0);box(.32,.07,.3,M.woodPale,nurseryCup,0,.24,0);cyl(.009,.012,.22,5,M.woodPale,nurseryCup,0,.37,0);const nurseryLeaf=new T.Mesh(new T.ConeGeometry(.08,.18,3),M.woodPale);nurseryLeaf.position.set(.03,.45,0);nurseryLeaf.rotation.z=.7;nurseryCup.add(nurseryLeaf);const jpItems = [];`)
    .replace("  ['h1', 'h2', 'h3'].forEach((h) => p.push", "  if(S.nurseryEnding)p.push({k:'nursery'});\n  ['h1', 'h2', 'h3'].forEach((h) => p.push")
    .replace("  if (pg.k === 'first')", "  if(pg.k==='nursery')return `<div class=\"page\"><p class=\"meta\">照料者支線結局</p><svg viewBox=\"0 0 220 150\" aria-label=\"兩棵樹的素描\"><g fill=\"none\" stroke=\"#625441\" stroke-width=\"2\"><path d=\"M70 135V70M70 80L35 55M70 92L110 65M70 75L65 30M155 135V102M155 113L138 94M155 116L173 98\"/><path d=\"M24 60Q10 24 53 25Q66 5 90 25Q127 19 121 57Q118 83 88 75Q56 94 24 60ZM132 100Q126 77 147 79Q158 66 174 82Q189 101 169 111Q146 122 132 100Z\"/></g></svg><p>第六盤又空了。機器照樣澆它。</p></div>`;\n  if (pg.k === 'first')")
    .replace('window.__room = { S, EX, applyPreset, setState, enterBag, playLink, enterTable, leaveTable, pinClue, pinAllClues, openBook, activate, panelPlace, advance(sec) {',
      `function applyExternalState(data) {
        Object.assign(CLUES, data.clues);
        S.visited = data.visited.slice(); S.pinned = data.pinned.slice(); S.tray = data.tray.slice();
        S.found = data.found.slice(); S.bag = data.bag.slice(); S.tracking = data.tracking;
        S.linked = Boolean(data.linked); S.journeys = data.journeys; S.fx = {}; S.lakeBoots = data.lakeBoots; S.nurseryEnding=data.nurseryEnding; nurseryCup.visible=data.saplingInLuggage;
        for (let i = 1; i <= 10; i++) setState(i, data.cores[i] || 0, true);
        jpItems.forEach((g, n) => { g.visible = n < S.bag.length; }); applyGrowth();
        boardDirty = true; renderHeader(); renderTray();
        if (S.mode === 'table') { panelTableDefault(); layoutHits(); measure(); }
      }
      window.__room = { S, EX, applyPreset, setState, enterBag, playLink, enterTable, leaveTable, pinClue, pinAllClues, openBook, activate, panelPlace, applyExternalState, advance(sec) {`)
    .replace('};\n})();\n</script>', "}; parent.postMessage({ source: 'focusquest-collection-room', type: 'ready' }, '*');\n})();\n</script>")
}

function toRoomState(snapshot: AppSnapshot, omitCoreMapId: string | null = null): RoomState {
  const pinned = snapshot.collection.clues.filter((clue) => clue.pinnedAt).map((clue) => clue.id)
  const pinnedSet = new Set(pinned)
  const cores: Record<number, 0 | 1 | 2> = {}
  for (const core of snapshot.mapCores) {
    if (core.mapId === omitCoreMapId) continue
    const index = MAP_INDEX[core.mapId]
    if (!index) continue
    const clueId = CORE_UNDERSTANDING_CLUES[core.mapId]
    cores[index] = clueId && pinnedSet.has(clueId) ? 2 : 1
  }
  const currentCoreKeys = new Set(snapshot.mapCores.map((core) => core.itemKey))
  return {
    clues: Object.fromEntries(snapshot.collection.clues.map(clue => [clue.id, {
      kind: clue.kind, from: clue.sourceId, src: clue.sourceLabel, text: clue.comparison ? `${clue.text}\n對照：${clue.comparison}` : clue.text,
      ...(clue.placeId ? { place: clue.placeId } : {})
    }])),
    visited: snapshot.collection.visitedMapIds.map((id) => MAP_INDEX[id]).filter(Boolean).map((index) => `m${String(index).padStart(2, '0')}`),
    pinned,
    tray: snapshot.collection.clues.filter((clue) => !clue.pinnedAt).map((clue) => clue.id),
    found: snapshot.collection.hiddenPlaces.filter((place) => place.pageFound).map((place) => place.id),
    bag: Array.from(new Set(snapshot.specialFinds.filter((find) => !currentCoreKeys.has(find.itemKey) && find.kind === 'relic').map((find) => find.title))).slice(0, 3),
    tracking: snapshot.collection.trackingPlaceId,
    linked: snapshot.collection.linkagePlayed,
    journeys: snapshot.collection.completedJourneys,
    cores,
    saplingInLuggage: snapshot.caretaker?.saplingInLuggage??false,
    nurseryEnding: snapshot.collection.clues.some(c=>c.id==='m07_transplant'),
    lakeBoots: snapshot.collection.clues.some(c=>c.id==='c03b')
  }
}

export function CollectionRoom({ snapshot, active, onReady, onChanged, onError, onBack }: {
  snapshot: AppSnapshot
  active: boolean
  onReady: () => void
  onChanged: (snapshot: AppSnapshot) => void
  onError: (message: string) => void
  onBack: () => void
}): React.JSX.Element {
  const frame = useRef<HTMLIFrameElement>(null)
  const latest = useRef(snapshot)
  const presenting = useRef(false)
  const [loaded, setLoaded] = useState(false)
  const visible = useRef(active)
  visible.current = active
  latest.current = snapshot
  const srcDoc = useMemo(() => roomDocument(), [])

  const room = (): RoomBridge | undefined => frame.current?.contentWindow?.__room
  const sync = (): void => room()?.applyExternalState(toRoomState(latest.current))

  useEffect(() => { if (frame.current?.contentWindow) frame.current.contentWindow.__hold = !active }, [active])

  useEffect(() => {
    const message = async (event: MessageEvent): Promise<void> => {
      const data = event.data as { source?: string; type?: string; clueId?: string; placeId?: string | null }
      if (event.source !== frame.current?.contentWindow || data?.source !== 'focusquest-collection-room') return
      try {
        if (data.type === 'ready') {
          if (frame.current?.contentWindow) frame.current.contentWindow.__hold = !active
          sync()
          room()?.advance(0.04)
          onReady()
          setLoaded(true)
          if (import.meta.env.DEV && window.location.hash.includes('collection-table')) {
            room()?.enterTable()
          } else if (import.meta.env.DEV && window.location.hash.includes('collection-pin')) {
            room()?.enterTable()
            window.setTimeout(() => room()?.pinClue('h1c'), 1500)
          }
        } else if (data.type === 'pin' && data.clueId) {
          const saved = await window.focusQuest.pinCollectionClue(data.clueId)
          latest.current = saved; onChanged(saved)
        } else if (data.type === 'pin-all' && Array.isArray((data as { clueIds?: string[] }).clueIds)) {
          const clueIds = (data as { clueIds: string[] }).clueIds
          const saved = await window.focusQuest.pinCollectionClues(clueIds)
          latest.current = saved; onChanged(saved)
          room()?.pinAllClues(clueIds)
        } else if (data.type === 'pin-done' || data.type === 'pin-all-done') {
          sync()
        } else if (data.type === 'tracking') {
          const saved = await window.focusQuest.setTrackingClue(data.placeId ?? null)
          latest.current = saved; onChanged(saved)
        } else if (data.type === 'back') onBack()
      } catch (error) { if (room()) { room()!.S.busy = false; room()!.S.bulkPinning = false; sync() } onError(error instanceof Error ? error.message : String(error)) }
    }
    window.addEventListener('message', message)
    return () => window.removeEventListener('message', message)
  }, [active, onBack, onChanged, onError, onReady])

  useEffect(() => {
    if (!active || !loaded || presenting.current) return
    presenting.current = true
    void (async () => {
      try {
        const pending = latest.current.mapCores.filter(core => !latest.current.collection.presentedCoreMapIds.includes(core.mapId) && MAP_INDEX[core.mapId])
        for (const core of pending) {
          const bridge = room(); if (!bridge || !visible.current) break
          bridge.applyExternalState(toRoomState(latest.current, core.mapId))
          const saved = await window.focusQuest.markCollectionCorePresented(core.mapId)
          latest.current = saved; onChanged(saved)
          bridge.enterBag(true, MAP_INDEX[core.mapId])
          await new Promise(resolve => window.setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 900 : 5900))
        }
        if (visible.current && latest.current.mapCores.length === 10 && !latest.current.collection.linkagePlayed) {
          const saved = await window.focusQuest.markCollectionLinkagePlayed()
          latest.current = saved; onChanged(saved); room()?.playLink()
        }
      } catch (error) { onError(error instanceof Error ? error.message : String(error)) }
      finally { presenting.current = false; sync() }
    })()
  }, [active, loaded])

  useEffect(() => { if (!presenting.current && !room()?.S.busy && !room()?.S.bulkPinning) sync() }, [snapshot])

  return <div className={`collection-room-view${active ? '' : ' is-hidden'}`} aria-hidden={!active}><iframe ref={frame} title="收藏室" srcDoc={srcDoc} />{active && !loaded && <TravelLoading />}</div>
}

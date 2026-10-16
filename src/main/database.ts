import { BEFORE_CLUES, CLOUD_RECORD_EVENTS, focusEventDefinition } from '../shared/focusEventCatalog'
import type { BeforeFocus, FocusEventRecord, FocusRecap } from '../shared/focusPresentation'
import { recapOrder, validFocusEvent } from '../shared/focusPresentation'
import { timeOfDayAt } from '../shared/timeOfDay'
import { weatherAt } from '../shared/weather'
import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { TaskListStore } from './task-list'
import type { AddListTaskInput, DeleteYesterdayInput, SaveRoutineInput, StartListFocusInput } from '../shared/taskList'
import type {
  ArchiveState,
  AppSettings,
  AppSnapshot,
  BackupPayload,
  BlockRule,
  CreateTaskInput,
  DailyRun,
  EndFocusInput,
  ExpeditionNode,
  FocusResult,
  FocusSession,
  PendingDebrief,
  QuestTask,
  RpgChoice,
  RpgState,
  RunRelic,
  SpecialFindAcquisition,
  RunningApplication,
  StartFocusInput,
  TaskRole
} from '../shared/types'
import { calculateLight, effectiveSeconds } from '../shared/rewards'
import { worldStageIndex } from '../shared/world'
import { area01Departure } from '../shared/area01'
import { NURSERY_AREA_ID, advanceNurseryRuntime, createNurseryRuntime, emptyNurseryMarks, nurseryClues, type NurseryRuntime, type NurseryMarks, type NurseryExit } from '../shared/area07'
import { LAKE_AREA_ID, advanceLakeRuntime, createLakeRuntime, emptyLakeMarks, lakeSnapshot, lakeDeparture, lakeStoryEvents, type LakeRuntime, type LakeMarks, type LakeExit } from '../shared/area03'
import { advanceMossRuntime, createMossRuntime, emptyMossMarks, mossSceneSnapshot, mossDeparture, mossStoryEvents, type MossRuntime, type MossWorldMarks, type MossSceneSnapshot } from '../shared/area02'
import { ALL_SPECIAL_FINDS, specialFindsForMap, dueLampCount, FOREST_MAP_ID, MOSS_MAP_ID, SPECIAL_FIND_CHANCE_PER_LAMP } from '../shared/specialFinds'
import { COLLECTION_CLUES, CLOUD_CLUE_COMPARISONS, MAP_JOURNEY_ITEMS, hiddenPlaceProgress } from '../shared/collectionRoom'
import { cloudStoryEventTimes, cloudStorySchedule } from '../shared/cloudStory'
import cloudScene from '../../docs/area-01-cloud-ruins.scene.json'
import { weatherSeedFrom } from '../shared/weather'
import {
  EXPEDITION_EVENTS,
  RUN_RELICS,
  eventForNode,
  generateRoutes,
  relicOptionsForNode,
  resolveExpeditionProgress
} from '../shared/expedition'

type Row = Record<string, unknown>

const DEFAULT_SETTINGS: AppSettings = {
  audioMuted: false,
  environmentVolume: 35,
  musicVolume: 12,
  reminderPolicy: 'gentle',
  eveningReminder: '20:30',
  miniTimer: true,
  phoneRitual: true,
  coatColor: 'navy',
  lanternColor: 'amber'
}

function nowIso(): string {
  return new Date().toISOString()
}

export function localDay(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function bool(value: unknown): boolean {
  return Number(value) === 1
}

function jsonStrings(value: unknown): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(String(value))
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export class FocusQuestDatabase {
  private readonly db: Database.Database
  private readonly taskList: TaskListStore

  constructor(path: string) {
    this.db = new Database(path)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.migrate()
    this.taskList = new TaskListStore(this.db)
    this.recoverMossFindPresentation()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        role TEXT NOT NULL,
        kind TEXT NOT NULL,
        progress_definition TEXT NOT NULL,
        starter_action TEXT,
        obstacle TEXT NOT NULL,
        deadline TEXT,
        cue_type TEXT NOT NULL,
        cue_value TEXT NOT NULL,
        scheduled_date TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS steps (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        position INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        step_id TEXT NOT NULL REFERENCES steps(id),
        started_at TEXT NOT NULL,
        ended_at TEXT,
        minimum_minutes INTEGER NOT NULL,
        paused_seconds INTEGER NOT NULL DEFAULT 0,
        suspended_at TEXT,
        outcome TEXT,
        blocked_attempts INTEGER NOT NULL DEFAULT 0,
        earned_light INTEGER NOT NULL DEFAULT 0,
        local_day TEXT NOT NULL,
        run_id TEXT,
        node_id TEXT,
        planned_minutes INTEGER,
        resolution_applied INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS daily_runs (
        id TEXT PRIMARY KEY,
        local_day TEXT NOT NULL,
        main_task_id TEXT NOT NULL REFERENCES tasks(id),
        seed INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        depth INTEGER NOT NULL DEFAULT 0,
        selected_node_id TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT
      );
      CREATE TABLE IF NOT EXISTS expedition_nodes (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES daily_runs(id) ON DELETE CASCADE,
        parent_node_id TEXT REFERENCES expedition_nodes(id) ON DELETE CASCADE,
        departure_exit_id TEXT,
        depth INTEGER NOT NULL,
        distance TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        environment_hint TEXT NOT NULL,
        planned_minutes INTEGER NOT NULL,
        state TEXT NOT NULL,
        progress_seconds INTEGER NOT NULL DEFAULT 0,
        event_key TEXT,
        reward_options TEXT NOT NULL DEFAULT '[]',
        selected_relic_key TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS run_relics (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES daily_runs(id) ON DELETE CASCADE,
        node_id TEXT NOT NULL REFERENCES expedition_nodes(id) ON DELETE CASCADE,
        relic_key TEXT NOT NULL,
        acquired_at TEXT NOT NULL,
        UNIQUE(run_id, node_id)
      );
      CREATE TABLE IF NOT EXISTS special_find_rolls (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        location_title TEXT NOT NULL,
        lamp_index INTEGER NOT NULL CHECK (lamp_index BETWEEN 1 AND 5),
        item_key TEXT,
        rolled_at TEXT NOT NULL,
        UNIQUE(node_id, lamp_index)
      );
      CREATE TABLE IF NOT EXISTS pending_debriefs (
        session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
        run_id TEXT NOT NULL REFERENCES daily_runs(id) ON DELETE CASCADE,
        node_id TEXT NOT NULL REFERENCES expedition_nodes(id) ON DELETE CASCADE,
        resolution TEXT NOT NULL,
        effective_seconds INTEGER NOT NULL,
        progress_seconds INTEGER NOT NULL,
        threshold_seconds INTEGER NOT NULL,
        outcome TEXT,
        complete_task INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS area_scene_states (
        node_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS map_world_state (
        map_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS forest_explorations (
        node_id TEXT PRIMARY KEY,
        map_id TEXT NOT NULL,
        journey_item TEXT NOT NULL,
        journey_lamp INTEGER NOT NULL CHECK (journey_lamp BETWEEN 1 AND 5),
        guaranteed_lamp INTEGER CHECK (guaranteed_lamp BETWEEN 1 AND 5),
        completed_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS collection_clues (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('way', 'look', 'note')),
        source_id TEXT NOT NULL,
        place_id TEXT,
        source_label TEXT NOT NULL,
        text TEXT NOT NULL,
        acquired_at TEXT NOT NULL,
        pinned_at TEXT
      );
      CREATE TABLE IF NOT EXISTS collection_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        tracking_place_id TEXT,
        linkage_played_at TEXT
      );
      CREATE TABLE IF NOT EXISTS collection_core_presentations (
        map_id TEXT PRIMARY KEY,
        presented_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS collection_pages (
        place_id TEXT PRIMARY KEY,
        acquired_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS forest_reward_rolls (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        location_title TEXT NOT NULL,
        lamp_index INTEGER NOT NULL CHECK (lamp_index BETWEEN 1 AND 5),
        item_key TEXT,
        rolled_at TEXT NOT NULL,
        reward_kind TEXT NOT NULL CHECK (reward_kind IN ('journey', 'core')),
        UNIQUE(node_id, lamp_index, reward_kind)
      );
      CREATE TABLE IF NOT EXISTS map_cores (
        map_id TEXT PRIMARY KEY,
        item_key TEXT NOT NULL UNIQUE,
        acquired_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS lobby_find_reads (
        acquisition_id TEXT PRIMARY KEY,
        seen_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS world_marks (
        map_id TEXT NOT NULL,
        mark TEXT NOT NULL,
        seen_at TEXT NOT NULL,
        PRIMARY KEY(map_id, mark)
      );
      CREATE TABLE IF NOT EXISTS block_rules (
        id TEXT PRIMARY KEY,
        process_name TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rpg_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        chapter INTEGER NOT NULL,
        node INTEGER NOT NULL,
        focus_seconds INTEGER NOT NULL DEFAULT 0,
        light INTEGER NOT NULL,
        star_pages INTEGER NOT NULL,
        materials INTEGER NOT NULL,
        ability TEXT,
        last_loot TEXT
      );
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        reminder_policy TEXT NOT NULL,
        evening_reminder TEXT NOT NULL,
        mini_timer INTEGER NOT NULL,
        phone_ritual INTEGER NOT NULL,
        coat_color TEXT NOT NULL,
        lantern_color TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        numeric_payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS restoration_projects (
        project_key TEXT PRIMARY KEY,
        completed_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_schedule ON tasks(scheduled_date, role, status);
      CREATE INDEX IF NOT EXISTS idx_sessions_day ON sessions(local_day, ended_at);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_runs_active_day ON daily_runs(local_day) WHERE status = 'active';
      CREATE INDEX IF NOT EXISTS idx_expedition_nodes_run_depth ON expedition_nodes(run_id, depth, created_at);
    `)

    const taskColumns = this.db.prepare('PRAGMA table_info(tasks)').all() as Row[]
    if (!taskColumns.some((column) => String(column.name) === 'starter_action')) {
      this.db.exec('ALTER TABLE tasks ADD COLUMN starter_action TEXT')
    }
    const rpgColumns = this.db.prepare('PRAGMA table_info(rpg_state)').all() as Row[]
    if (!rpgColumns.some((column) => String(column.name) === 'focus_seconds')) {
      this.db.exec('ALTER TABLE rpg_state ADD COLUMN focus_seconds INTEGER NOT NULL DEFAULT 0')
      this.db.exec(`
        UPDATE rpg_state SET focus_seconds = COALESCE((
          SELECT SUM(CAST(MAX(0, (julianday(ended_at) - julianday(started_at)) * 86400 - paused_seconds) AS INTEGER))
          FROM sessions WHERE ended_at IS NOT NULL
        ), 0)
      `)
    }
    const sessionColumns = this.db.prepare('PRAGMA table_info(sessions)').all() as Row[]
    if (!sessionColumns.some((column) => String(column.name) === 'manual_paused')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN manual_paused INTEGER NOT NULL DEFAULT 0')
    }
    if (!sessionColumns.some((column) => String(column.name) === 'system_paused')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN system_paused INTEGER NOT NULL DEFAULT 0')
      this.db.exec('UPDATE sessions SET system_paused = 1 WHERE ended_at IS NULL AND suspended_at IS NOT NULL')
    }
    if (!sessionColumns.some((column) => String(column.name) === 'run_id')) this.db.exec('ALTER TABLE sessions ADD COLUMN run_id TEXT')
    if (!sessionColumns.some((column) => String(column.name) === 'node_id')) this.db.exec('ALTER TABLE sessions ADD COLUMN node_id TEXT')
    if (!sessionColumns.some((column) => String(column.name) === 'planned_minutes')) this.db.exec('ALTER TABLE sessions ADD COLUMN planned_minutes INTEGER')
    if (!sessionColumns.some((column) => String(column.name) === 'resolution_applied')) this.db.exec('ALTER TABLE sessions ADD COLUMN resolution_applied INTEGER NOT NULL DEFAULT 0')
    for (const [column, definition] of [['focus_presentation', "TEXT NOT NULL DEFAULT 'quiet'"], ['before_focus', 'TEXT'], ['before_focus_completed', 'INTEGER NOT NULL DEFAULT 0']] as const) {
      if (!sessionColumns.some(c => c.name === column)) this.db.exec(`ALTER TABLE sessions ADD COLUMN ${column} ${definition}`)
    }
    const presentationColumns = this.db.prepare('PRAGMA table_info(settings)').all() as Row[]
    if (!presentationColumns.some(c => c.name === 'focus_presentation')) this.db.exec("ALTER TABLE settings ADD COLUMN focus_presentation TEXT NOT NULL DEFAULT 'quiet'")
    this.db.exec(`CREATE TABLE IF NOT EXISTS focus_event_records (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, run_id TEXT NOT NULL, node_id TEXT NOT NULL, event_id TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(node_id, event_id))`)
    const nodeColumns = this.db.prepare('PRAGMA table_info(expedition_nodes)').all() as Row[]
    if (!nodeColumns.some((column) => String(column.name) === 'area_id')) {
      this.db.exec("ALTER TABLE expedition_nodes ADD COLUMN area_id TEXT NOT NULL DEFAULT 'area-01-cloud-ruins'")
    }
    if (!nodeColumns.some((column) => String(column.name) === 'departure_exit_id')) {
      this.db.exec('ALTER TABLE expedition_nodes ADD COLUMN departure_exit_id TEXT')
    }
    const explorationColumns = this.db.prepare('PRAGMA table_info(forest_explorations)').all() as Row[]
    const audioSettingColumns = this.db.prepare('PRAGMA table_info(settings)').all() as Row[]
    if (!audioSettingColumns.some(row => row.name === 'audio_muted')) this.db.exec('ALTER TABLE settings ADD COLUMN audio_muted INTEGER NOT NULL DEFAULT 0')
    for (const [column, value] of [['environment_volume', 35], ['music_volume', 12]] as const) {
      if (!audioSettingColumns.some(row => row.name === column)) this.db.exec(`ALTER TABLE settings ADD COLUMN ${column} INTEGER NOT NULL DEFAULT ${value}`)
    }
    if (!explorationColumns.some((column) => String(column.name) === 'ambient_history')) {
      this.db.exec("ALTER TABLE forest_explorations ADD COLUMN ambient_history TEXT NOT NULL DEFAULT '[]'")
    }
    if (!explorationColumns.some((column) => String(column.name) === 'requested_item')) {
      this.db.exec('ALTER TABLE forest_explorations ADD COLUMN requested_item TEXT')
    }
    if (!explorationColumns.some((column) => String(column.name) === 'story_records')) {
      this.db.exec("ALTER TABLE forest_explorations ADD COLUMN story_records TEXT NOT NULL DEFAULT '[]'")
      // Migrate already acquired visit clues without suppressing item stories on a later visit.
      this.migrateCloudStoryRecords()
    }

    this.db.prepare(`
      INSERT OR IGNORE INTO rpg_state
      (id, chapter, node, focus_seconds, light, star_pages, materials, ability, last_loot)
      VALUES (1, 1, 0, 0, 0, 0, 0, NULL, NULL)
    `).run()
    this.db.prepare(`
      INSERT OR IGNORE INTO settings
      (id, reminder_policy, evening_reminder, mini_timer, phone_ritual, coat_color, lantern_color)
      VALUES (1, @reminderPolicy, @eveningReminder, @miniTimer, @phoneRitual, @coatColor, @lanternColor)
    `).run({
      ...DEFAULT_SETTINGS,
      miniTimer: Number(DEFAULT_SETTINGS.miniTimer),
      phoneRitual: Number(DEFAULT_SETTINGS.phoneRitual)
    })
    this.db.prepare('INSERT OR IGNORE INTO collection_state (id, tracking_place_id, linkage_played_at) VALUES (1, NULL, NULL)').run()
    this.backfillDepartureExits()
    this.backfillForestCore()
  }

  private backfillForestCore(): void {
    // Preserve the original acquisition timestamp; never roll again for an owned legacy core.
    this.db.prepare(`INSERT OR IGNORE INTO map_cores (map_id, item_key, acquired_at)
      SELECT ?, 'astrolabe_core', MIN(rolled_at) FROM special_find_rolls
      WHERE item_key = 'astrolabe_core' HAVING COUNT(*) > 0`).run(FOREST_MAP_ID)
  }

  private mapIdForNode(nodeId: string): string {
    const row = this.db.prepare('SELECT area_id FROM expedition_nodes WHERE id = ?').get(nodeId) as Row | undefined
    if (!row) throw new Error('找不到這次地圖探索。')
    const mapId = String(row.area_id)
    specialFindsForMap(mapId) // Reject unknown IDs instead of silently awarding forest items.
    return mapId
  }

  private forestPlan(nodeId: string, requestedItem: string | null = null): Row {
    const saved = this.db.prepare('SELECT * FROM forest_explorations WHERE node_id = ?').get(nodeId) as Row | undefined
    if (saved) {
      const savedChoice = saved.requested_item ? String(saved.requested_item) : null
      if (requestedItem !== null && requestedItem !== savedChoice) throw new Error('這次探索的信物已經決定，開始後不能更改。')
      return saved
    }
    const mapId = this.mapIdForNode(nodeId)
    const finds = specialFindsForMap(mapId)
    const allowedItems = MAP_JOURNEY_ITEMS[mapId] ?? finds.filter((find) => find.kind === 'relic').map((find) => find.itemKey)
    if (requestedItem !== null) {
      if (!this.db.prepare('SELECT 1 FROM map_cores WHERE map_id = ?').get(mapId)) throw new Error('找到這張地圖的核心之後，才能指定信物。')
      if (!allowedItems.includes(requestedItem)) throw new Error('這件信物不屬於目前的地圖。')
    }
    // Legacy partials keep all previous awards/misses and their original duration.
    const legacy = this.db.prepare('SELECT * FROM special_find_rolls WHERE node_id = ? ORDER BY lamp_index').all(nodeId) as Row[]
    const previousItem = legacy.find((row) => finds.some(find => find.kind === 'relic' && find.itemKey === row.item_key))
    const remainingStart = Math.min(5, 1 + Math.max(0, ...legacy.map((row) => Number(row.lamp_index))))
    const item = previousItem?.item_key ?? requestedItem ?? finds.filter((find) => find.kind === 'relic')[Math.floor(Math.random() * 2)].itemKey
    const lamp = previousItem?.lamp_index ?? remainingStart + Math.floor(Math.random() * (6 - remainingStart))
    const completed = this.db.prepare('SELECT COUNT(*) AS count FROM forest_explorations WHERE map_id = ? AND completed_at IS NOT NULL').get(mapId) as Row
    const owned = this.db.prepare('SELECT 1 FROM map_cores WHERE map_id = ?').get(mapId)
    const guarantee = !owned && Number(completed.count) >= 4 ? remainingStart + Math.floor(Math.random() * (6 - remainingStart)) : null
    this.db.prepare(`INSERT INTO forest_explorations
      (node_id, map_id, journey_item, journey_lamp, guaranteed_lamp, completed_at, created_at, requested_item)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`).run(nodeId, mapId, item, lamp, guarantee, nowIso(), requestedItem)
    return this.db.prepare('SELECT * FROM forest_explorations WHERE node_id = ?').get(nodeId) as Row
  }

  private nurseryMarks(): NurseryMarks {
    const row=this.db.prepare('SELECT state_json FROM map_world_state WHERE map_id = ?').get(NURSERY_AREA_ID) as Row|undefined
    return {...emptyNurseryMarks(),...(row?JSON.parse(String(row.state_json)):{})}
  }
  private saveNurseryMarks(marks:NurseryMarks):void {
    this.db.prepare('INSERT INTO map_world_state (map_id,state_json) VALUES (?,?) ON CONFLICT(map_id) DO UPDATE SET state_json=excluded.state_json').run(NURSERY_AREA_ID,JSON.stringify(marks))
  }
  private ensureNurseryState(nodeId:string):NurseryRuntime {
    const row=this.db.prepare('SELECT state_json FROM area_scene_states WHERE node_id = ?').get(nodeId) as Row|undefined
    if(row)return JSON.parse(String(row.state_json))
    const node=this.db.prepare('SELECT run_id FROM expedition_nodes WHERE id = ?').get(nodeId) as Row
    const marks=this.nurseryMarks(),clues=new Set((this.db.prepare('SELECT id FROM collection_clues').all() as Row[]).map(r=>String(r.id)))
    const stories:string[]=[]
    if(!clues.has('m07_tray'))stories.push('story_first_tray')
    else if(!clues.has('m07_chart'))stories.push('story_second_chart')
    if(this.db.prepare("SELECT 1 FROM forest_reward_rolls WHERE run_id = ? AND item_key = 'silvered_shard'").get(node.run_id))stories.push('carry_silvered_shard')
    if(marks.saplingInLuggage&&!marks.saplingPlanted)stories.push('carry_sapling')
    if(marks.saplingPlanted&&!marks.saplingTransplanted){marks.saplingStage=Math.min(2,marks.saplingStage+1);this.saveNurseryMarks(marks)}
    const state=createNurseryRuntime(nodeId,stories)
    this.db.prepare('INSERT INTO area_scene_states (node_id,state_json) VALUES (?,?)').run(nodeId,JSON.stringify(state))
    return state
  }
  private advanceNurseryScene(session:Row,seconds:number):boolean {
    const id=String(session.node_id)
    if(this.mapIdForNode(id)!==NURSERY_AREA_ID)return false
    if(seconds<300){advanceNurseryRuntime(this.ensureNurseryState(id),Number(session.progress_seconds)+seconds,this.nurseryMarks(),[],(s,m)=>this.captureRuntimeEvent(session,s.seconds,s.action!.eventId!,{nursery:{areaId:NURSERY_AREA_ID,nodeId:id,seed:s.seed,effectiveSeconds:s.seconds,action:s.action,worldMarks:m,coreTaken:false}}));return false}
    const saved=this.ensureNurseryState(id),progress=Number(session.progress_seconds)+seconds
    if(progress<=saved.seconds)return false
    const finds=(this.db.prepare('SELECT id,item_key,lamp_index FROM forest_reward_rolls WHERE node_id = ? AND item_key IS NOT NULL ORDER BY lamp_index').all(id) as Row[])
      .map(r=>({id:String(r.id),lampIndex:Number(r.lamp_index),eventId:ALL_SPECIAL_FINDS.find(f=>f.itemKey===r.item_key)!.eventId}))
    const {state,marks}=advanceNurseryRuntime(saved,progress,this.nurseryMarks(),finds,(s,m)=>this.captureRuntimeEvent(session,s.seconds,s.action!.eventId!,{nursery:{areaId:NURSERY_AREA_ID,nodeId:id,seed:s.seed,effectiveSeconds:s.seconds,action:s.action,worldMarks:m,coreTaken:false}}))
    this.db.prepare('UPDATE area_scene_states SET state_json = ? WHERE node_id = ?').run(JSON.stringify(state),id)
    this.saveNurseryMarks(marks)
    const clueByStory:Record<string,string>={story_first_tray:'m07_tray',story_second_chart:'m07_chart',carry_silvered_shard:'m07_glass',carry_sapling:'m07_planted'}
    for(const e of state.startedStories)if(clueByStory[e])this.acquireCollectionClue(clueByStory[e])
    return true
  }
  getNurseryScene(nodeId:string) {
    if(this.mapIdForNode(nodeId)!==NURSERY_AREA_ID)return null
    const row=this.db.prepare('SELECT state_json FROM area_scene_states WHERE node_id = ?').get(nodeId) as Row|undefined
    if(!row)return null // Merely offering a route must not advance sapling growth.
    let state=JSON.parse(String(row.state_json)) as NurseryRuntime,marks=this.nurseryMarks()
    const active=this.db.prepare('SELECT sessions.*, expedition_nodes.progress_seconds FROM sessions JOIN expedition_nodes ON expedition_nodes.id=sessions.node_id WHERE sessions.node_id=? AND ended_at IS NULL').get(nodeId) as Row|undefined
    if(active&&!active.before_focus){const seconds=effectiveSeconds(String(active.started_at),active.suspended_at?String(active.suspended_at):nowIso(),Number(active.paused_seconds))
      if(seconds<300){const preview=advanceNurseryRuntime(state,Number(active.progress_seconds)+seconds,marks,[]);state=preview.state;marks=preview.marks}}
    return {areaId:NURSERY_AREA_ID,nodeId,seed:state.seed,effectiveSeconds:state.seconds,action:state.action,worldMarks:marks,
      coreTaken:!!this.db.prepare('SELECT 1 FROM map_cores WHERE map_id = ?').get(NURSERY_AREA_ID)}
  }
  getNurseryDeparture(sessionId:string) {
    const node=this.db.prepare('SELECT expedition_nodes.* FROM sessions JOIN expedition_nodes ON expedition_nodes.id=sessions.node_id WHERE sessions.id=?').get(sessionId) as Row|undefined
    if(!node?.parent_node_id||Number(node.progress_seconds)>0||this.mapIdForNode(String(node.parent_node_id))!==NURSERY_AREA_ID)return null
    if(!['exit_corridor','exit_cellar'].includes(String(node.departure_exit_id)))return null
    return {fromExpeditionNodeId:String(node.parent_node_id),exit:node.departure_exit_id as NurseryExit,durationMs:8000}
  }
  private caretakerChoices() {
    const marks=this.nurseryMarks(),run=this.currentRun()
    let takeNodeId:string|null=null,transplantNodeId:string|null=null
    if(run&&!this.db.prepare('SELECT 1 FROM sessions WHERE ended_at IS NULL').get()){
      const rows=this.db.prepare(`SELECT expedition_nodes.*,area_scene_states.state_json FROM expedition_nodes JOIN area_scene_states ON area_scene_states.node_id=expedition_nodes.id
        WHERE run_id=? AND state IN ('awaiting_route','cleared','awaiting_reward') ORDER BY depth DESC`).all(run.id) as Row[]
      for(const r of rows.slice(0,1)){const s=JSON.parse(String(r.state_json))
        if(!takeNodeId&&r.area_id===MOSS_MAP_ID&&s.saplingWrapped&&!s.takeOffered&&!marks.saplingInLuggage&&!marks.saplingPlanted)takeNodeId=String(r.id)
        if(!transplantNodeId&&r.area_id===NURSERY_AREA_ID&&marks.saplingStage===2&&!marks.saplingTransplanted&&!s.transplantOffered)transplantNodeId=String(r.id)
      }
    }
    return {saplingInLuggage:marks.saplingInLuggage,takeNodeId,transplantNodeId}
  }
  chooseCaretaker(nodeId:string,choice:'take'|'leave'|'transplant'|'wait'):AppSnapshot {
    if(!['take','leave','transplant','wait'].includes(choice))throw new Error('未知的照料者選擇。')
    this.db.transaction(()=>{
      const offers=this.caretakerChoices(),take=choice==='take'||choice==='leave'
      if(nodeId!==(take?offers.takeNodeId:offers.transplantNodeId))throw new Error('這個選擇尚未開放或已經保存。')
      const row=this.db.prepare('SELECT state_json FROM area_scene_states WHERE node_id = ?').get(nodeId) as Row
      const state=JSON.parse(String(row.state_json)),marks=this.nurseryMarks()
      if(take){state.takeOffered=true;if(choice==='take')marks.saplingInLuggage=true}
      else {state.transplantOffered=true;if(choice==='transplant'){state.transplantAccepted=true;marks.saplingTransplanted=true;this.acquireCollectionClue('m07_transplant')}}
      this.db.prepare('UPDATE area_scene_states SET state_json=? WHERE node_id=?').run(JSON.stringify(state),nodeId)
      this.saveNurseryMarks(marks)
    })()
    return this.getSnapshot()
  }

  private ensureLakeState(nodeId: string): LakeRuntime {
    const row = this.db.prepare('SELECT state_json FROM area_scene_states WHERE node_id = ?').get(nodeId) as Row | undefined
    const previous = row ? JSON.parse(String(row.state_json)) as LakeRuntime : null
    if (previous?.storyPlan) return previous
    const node = this.db.prepare('SELECT run_id FROM expedition_nodes WHERE id = ?').get(nodeId) as Row
    const clues = new Set((this.db.prepare('SELECT id FROM collection_clues').all() as Row[]).map(r=>String(r.id)))
    const prior = this.db.prepare('SELECT 1 FROM sessions WHERE node_id IS NOT NULL AND node_id <> ? LIMIT 1').get(nodeId)
    const rewards = this.db.prepare('SELECT journey_lamp, guaranteed_lamp FROM forest_explorations WHERE node_id = ?').get(nodeId) as Row|undefined
    const carried = (this.db.prepare(`SELECT item_key FROM forest_reward_rolls WHERE run_id = ? AND item_key IS NOT NULL
      UNION SELECT item_key FROM special_find_rolls WHERE run_id = ? AND item_key IS NOT NULL
      UNION SELECT relic_key AS item_key FROM run_relics WHERE run_id = ?`).all(node.run_id,node.run_id,node.run_id) as Row[]).map(r=>String(r.item_key))
    const core = this.db.prepare('SELECT acquired_at FROM map_cores WHERE map_id = ?').get(LAKE_AREA_ID) as Row|undefined
    const firstSession = this.db.prepare('SELECT started_at FROM sessions WHERE node_id = ? ORDER BY started_at LIMIT 1').get(nodeId) as Row|undefined
    const state = {...(previous??createLakeRuntime(nodeId)),storyPlan: {opening:!prior&&!clues.has('m03_open')&&(previous?.seconds??0)<120,
      visitEvent:!clues.has('m03_lag')?'story_first_lag':!clues.has('c03')?'story_second_cup':null,
      coreEvent:!!core&&(!firstSession||String(core.acquired_at)<String(firstSession.started_at))&&!clues.has('c03b'),
      carriedItems:carried,eligibleAfter:previous?.seconds??0,reservedSegments:[rewards?.journey_lamp,rewards?.guaranteed_lamp].filter(v=>v!=null).map(Number)}}
    this.db.prepare('INSERT INTO area_scene_states (node_id, state_json) VALUES (?, ?) ON CONFLICT(node_id) DO UPDATE SET state_json = excluded.state_json').run(nodeId, JSON.stringify(state))
    return state
  }
  private lakeMarks(): LakeMarks {
    const row = this.db.prepare('SELECT state_json FROM map_world_state WHERE map_id = ?').get(LAKE_AREA_ID) as Row | undefined
    return row ? { ...emptyLakeMarks(), ...JSON.parse(String(row.state_json)) } : emptyLakeMarks()
  }
  private advanceLakeScene(session: Row, seconds: number): boolean {
    const id = String(session.node_id)
    if (this.mapIdForNode(id) !== LAKE_AREA_ID) return false
    if(seconds<300){advanceLakeRuntime(this.ensureLakeState(id),Number(session.progress_seconds)+seconds,this.lakeMarks(),[],(s,m)=>this.captureRuntimeEvent(session,s.seconds,s.action!.eventId!,{lake:lakeSnapshot(id,s,m,false)}));return true}
    const saved = this.ensureLakeState(id), progress = Number(session.progress_seconds) + seconds
    if (progress <= saved.seconds) return false
    const rewards = this.db.prepare('SELECT id, item_key, lamp_index FROM forest_reward_rolls WHERE node_id = ? AND item_key IS NOT NULL ORDER BY lamp_index, reward_kind DESC').all(id) as Row[]
    const finds = rewards.map(r => ({ id: String(r.id), lampIndex: Number(r.lamp_index), eventId: ALL_SPECIAL_FINDS.find(f => f.itemKey === r.item_key)!.eventId }))
    const { state, marks } = advanceLakeRuntime(saved, progress, this.lakeMarks(), finds,(s,m)=>this.captureRuntimeEvent(session,s.seconds,s.action!.eventId!,{lake:lakeSnapshot(id,s,m,false)}))
    if (this.db.prepare('SELECT 1 FROM map_cores WHERE map_id = ?').get(LAKE_AREA_ID)) marks.ringStill = false
    this.db.prepare('UPDATE area_scene_states SET state_json = ? WHERE node_id = ?').run(JSON.stringify(state), id)
    this.db.prepare('INSERT INTO map_world_state (map_id, state_json) VALUES (?, ?) ON CONFLICT(map_id) DO UPDATE SET state_json = excluded.state_json').run(LAKE_AREA_ID, JSON.stringify(marks))
    return true
  }
  getLakeScene(nodeId: string) {
    if (this.mapIdForNode(nodeId) !== LAKE_AREA_ID) return null
    let state = this.ensureLakeState(nodeId), marks = this.lakeMarks()
    const active = this.db.prepare('SELECT sessions.*, expedition_nodes.progress_seconds FROM sessions JOIN expedition_nodes ON expedition_nodes.id = sessions.node_id WHERE sessions.node_id = ? AND ended_at IS NULL').get(nodeId) as Row | undefined
    if (active && !active.before_focus) {
      const end = active.suspended_at ? String(active.suspended_at) : nowIso()
      const seconds = effectiveSeconds(String(active.started_at), end, Number(active.paused_seconds))
      if (seconds < 300) { const preview = advanceLakeRuntime(state, Number(active.progress_seconds) + seconds, marks, []); state = preview.state; marks = preview.marks }
    }
    return lakeSnapshot(nodeId, state, marks, !!this.db.prepare('SELECT 1 FROM map_cores WHERE map_id = ?').get(LAKE_AREA_ID))
  }
  getLakeDeparture(sessionId: string) {
    const node = this.db.prepare('SELECT expedition_nodes.* FROM sessions JOIN expedition_nodes ON expedition_nodes.id = sessions.node_id WHERE sessions.id = ?').get(sessionId) as Row | undefined
    if (!node?.parent_node_id || this.mapIdForNode(String(node.parent_node_id)) !== LAKE_AREA_ID || Number(node.progress_seconds) > 0) return null
    return lakeDeparture(String(node.parent_node_id), node.departure_exit_id as LakeExit)
  }

  private syncLakeStoryClues(session:Row,ending=false):boolean {
    if(!session.node_id||this.mapIdForNode(String(session.node_id))!==LAKE_AREA_ID)return false
    const state=this.ensureLakeState(String(session.node_id));let changed=false
    const grant=(id:string)=>{if(!this.db.prepare('SELECT 1 FROM collection_clues WHERE id = ?').get(id)){this.acquireCollectionClue(id);changed=true}}
    for(const id of state.startedStories??[]){const e=lakeStoryEvents.find(e=>e.id===id);if(e?.clue&&id!=='story_open_gauge')grant(e.clue)}
    if(ending&&state.storyPlan?.opening){
      grant('m03_open')
      const marks=this.lakeMarks();if(!marks.gaugeCarving){marks.gaugeCarving=true
        this.db.prepare('INSERT INTO map_world_state (map_id, state_json) VALUES (?, ?) ON CONFLICT(map_id) DO UPDATE SET state_json = excluded.state_json').run(LAKE_AREA_ID,JSON.stringify(marks));changed=true}
    }
    const items=(this.db.prepare(`SELECT item_key FROM forest_reward_rolls WHERE node_id = ? AND item_key IS NOT NULL`).all(session.node_id) as Row[]).map(r=>r.item_key)
    if(items.includes('tide_gauge_plate'))grant('n_plate')
    if(items.includes('silvered_shard'))grant('n_shard')
    return changed
  }
  private lakeDiscoveries(runId:string|undefined):Array<{id:string;title:string;text:string}>{
    if(!runId)return []
    const rows=this.db.prepare(`SELECT area_scene_states.node_id, state_json FROM area_scene_states JOIN expedition_nodes
      ON expedition_nodes.id = area_scene_states.node_id WHERE run_id = ? AND area_id = ?`).all(runId,LAKE_AREA_ID) as Row[]
    return rows.flatMap(r=>(JSON.parse(String(r.state_json)) as LakeRuntime).notes.filter(n=>n.eventId.startsWith('carry_')).map(n=>({
      id:`lake-story:${r.node_id}:${n.eventId}`,title:lakeStoryEvents.find(e=>e.id===n.eventId)!.name,text:n.text})))
  }

  private ensureMossState(nodeId: string): MossRuntime {
    const row = this.db.prepare('SELECT state_json FROM area_scene_states WHERE node_id = ?').get(nodeId) as Row | undefined
    if (row) return JSON.parse(String(row.state_json)) as MossRuntime
    const node = this.db.prepare('SELECT run_id FROM expedition_nodes WHERE id = ?').get(nodeId) as Row | undefined
    const records = new Set((this.db.prepare('SELECT id FROM collection_clues').all() as Row[]).map(row => String(row.id)))
    const prior = this.db.prepare('SELECT 1 FROM sessions WHERE node_id IS NOT NULL AND node_id <> ? LIMIT 1').get(nodeId)
    const visitEvent = !records.has('h1b') ? 'story_first_lantern'
      : !records.has('h1c') ? 'story_second_sketch' : null
    const carried = node ? (this.db.prepare(`SELECT item_key FROM forest_reward_rolls WHERE run_id = ? AND item_key IS NOT NULL
      UNION SELECT item_key FROM special_find_rolls WHERE run_id = ? AND item_key IS NOT NULL
      UNION SELECT relic_key AS item_key FROM run_relics WHERE run_id = ?`).all(node.run_id, node.run_id, node.run_id) as Row[])
      .map(row => String(row.item_key)) : []
    const state = createMossRuntime(nodeId, {
      opening: !prior,
      visitEvent,
      coreEvents: this.db.prepare('SELECT 1 FROM map_cores WHERE map_id = ?').get(MOSS_MAP_ID) && !records.has('c02')
        ? ['story_core_newtag'] : [],
      carriedItems: carried.filter(item=>item!=='mulch_cloth'||(!this.nurseryMarks().saplingInLuggage&&!this.nurseryMarks().saplingPlanted))
    })
    this.db.prepare('INSERT INTO area_scene_states (node_id, state_json) VALUES (?, ?)').run(nodeId, JSON.stringify(state))
    return state
  }

  private mossMarks(): MossWorldMarks {
    const row = this.db.prepare('SELECT state_json FROM map_world_state WHERE map_id = ?').get(MOSS_MAP_ID) as Row | undefined
    return row ? { ...emptyMossMarks(), ...JSON.parse(String(row.state_json)) as MossWorldMarks } : emptyMossMarks()
  }

  private advanceMossScene(session: Row, seconds: number): boolean {
    const nodeId = String(session.node_id)
    if (this.mapIdForNode(nodeId) !== MOSS_MAP_ID) return false
    // Preserve the existing five-minute acceptance gate. Before it, snapshots preview
    // the deterministic traveller without committing notes, world marks or elapsed time.
    if(seconds<300){advanceMossRuntime(this.ensureMossState(nodeId),Number(session.progress_seconds)+seconds,this.mossMarks(),[],(s,m)=>this.captureRuntimeEvent(session,s.seconds,s.action!.eventId!,{moss:mossSceneSnapshot(nodeId,s,m,false)}));return true}
    const saved = this.ensureMossState(nodeId)
    const progress = Number(session.progress_seconds) + seconds
    if (progress <= saved.seconds) return false
    const rewards = this.db.prepare('SELECT id, item_key, lamp_index FROM forest_reward_rolls WHERE node_id = ? AND item_key IS NOT NULL ORDER BY lamp_index, reward_kind DESC')
      .all(nodeId) as Row[]
    const finds = rewards.map(row => ({ id: String(row.id), lampIndex: Number(row.lamp_index), itemKey: String(row.item_key),
      eventId: ALL_SPECIAL_FINDS.find(find => find.itemKey === row.item_key)!.eventId }))
    const { state, marks } = advanceMossRuntime(saved, progress, this.mossMarks(), finds,(s,m)=>this.captureRuntimeEvent(session,s.seconds,s.action!.eventId!,{moss:mossSceneSnapshot(nodeId,s,m,false)}))
    this.db.prepare('UPDATE area_scene_states SET state_json = ? WHERE node_id = ?').run(JSON.stringify(state), nodeId)
    this.db.prepare('INSERT INTO map_world_state (map_id, state_json) VALUES (?, ?) ON CONFLICT(map_id) DO UPDATE SET state_json = excluded.state_json')
      .run(MOSS_MAP_ID, JSON.stringify(marks))
    for (const mark of ['signalLowered', 'towelLeft', 'bench_tea_seen'] as const) {
      if (marks[mark]) this.db.prepare('INSERT OR IGNORE INTO world_marks (map_id, mark, seen_at) VALUES (?, ?, ?)').run(MOSS_MAP_ID, mark, nowIso())
    }
    for (const mark of ['carvingSeen', 'drawerTagLeft'] as const) if (marks[mark])
      this.db.prepare('INSERT OR IGNORE INTO world_marks (map_id, mark, seen_at) VALUES (?, ?, ?)').run(MOSS_MAP_ID, mark, nowIso())
    return true
  }

  private syncMossStoryClues(session: Row, ending = false): boolean {
    if (!session.node_id || this.mapIdForNode(String(session.node_id)) !== MOSS_MAP_ID) return false
    const state = this.ensureMossState(String(session.node_id))
    const clues: Record<string, string> = {
      story_first_lantern: 'h1b', story_first_lantern_rain: 'h1b', story_second_sketch: 'h1c',
      story_core_newtag: 'c02', story_core_ledger08: 'c08', carry_old_wick: 'm02_wick',
      carry_weathered_lens: 'm02_lens', carry_charcoal_rubbing: 'm02_sign', carry_mulch_cloth: 'm02_sapling'
    }
    let changed = false
    for (const id of state.usedEvents) {
      const clue = clues[id]
      if (clue && !this.db.prepare('SELECT 1 FROM collection_clues WHERE id = ?').get(clue)) {
        this.acquireCollectionClue(clue); changed = true
      }
    }
    if (ending && state.storyPlan?.opening && !this.db.prepare("SELECT 1 FROM collection_clues WHERE id = 'm02_open'").get()) {
      this.acquireCollectionClue('m02_open'); changed = true
    }
    const items = new Set((this.db.prepare(`SELECT item_key FROM forest_reward_rolls
      WHERE node_id IN (SELECT id FROM expedition_nodes WHERE area_id = ?) AND item_key IN ('old_luggage_tag', 'charcoal_rubbing')`)
      .all(MOSS_MAP_ID) as Row[]).map(row => String(row.item_key)))
    for (const [item, clue] of [['old_luggage_tag', 'n_tag'], ['charcoal_rubbing', 'n_rub']]) {
      if (items.has(item) && !this.db.prepare('SELECT 1 FROM collection_clues WHERE id = ?').get(clue)) {
        this.acquireCollectionClue(clue); changed = true
      }
    }
    return changed
  }

  private mossDiscoveries(runId: string | undefined): Array<{ id: string; title: string; text: string }> {
    if (!runId) return []
    const rows = this.db.prepare(`SELECT area_scene_states.node_id, area_scene_states.state_json FROM area_scene_states
      JOIN expedition_nodes ON expedition_nodes.id = area_scene_states.node_id
      WHERE expedition_nodes.run_id = ? AND expedition_nodes.area_id = ?`).all(runId, MOSS_MAP_ID) as Row[]
    const names = new Map(mossStoryEvents.filter(event => event.id.startsWith('carry_')).map(event => [event.id, event.name]))
    return rows.flatMap(row => {
      const state = JSON.parse(String(row.state_json)) as MossRuntime
      return state.notes.filter(note => names.has(note.eventId)).map(note => ({
        id: `moss-story:${row.node_id}:${note.eventId}`, title: names.get(note.eventId)!,
        text: [note.text, state.notes.find(other => other.eventId === `${note.eventId}:combo`)?.text].filter(Boolean).join(' ')
      }))
    })
  }

  private cloudDiscoveries(runId: string | undefined): Array<{ id: string; title: string; text: string }> {
    if (!runId) return []
    const rows = this.db.prepare(`SELECT forest_explorations.node_id, story_records FROM forest_explorations
      JOIN expedition_nodes ON expedition_nodes.id = forest_explorations.node_id
      WHERE expedition_nodes.run_id = ? AND forest_explorations.map_id = ?`).all(runId, FOREST_MAP_ID) as Row[]
    return rows.flatMap(row => (JSON.parse(String(row.story_records)) as string[])
      .filter(id => ['c01_rubbing', 'c01_tag'].includes(id)).map(id => {
        const clue = COLLECTION_CLUES.find(clue => clue.id === id)!
        return { id: `cloud-story:${row.node_id}:${id}`, title: clue.sourceLabel, text: clue.text }
      }))
  }

  /** Read-only presentation contract. The main-process ticker owns all decisions and results. */
  getMossScene(nodeId: string): MossSceneSnapshot | null {
    if (this.mapIdForNode(nodeId) !== MOSS_MAP_ID) return null
    const row = this.db.prepare('SELECT state_json FROM area_scene_states WHERE node_id = ?').get(nodeId) as Row | undefined
    let state = row ? JSON.parse(String(row.state_json)) as MossRuntime : this.ensureMossState(nodeId)
    const marks = this.mossMarks()
    const active = this.db.prepare(`SELECT sessions.*, expedition_nodes.progress_seconds FROM sessions
      JOIN expedition_nodes ON expedition_nodes.id = sessions.node_id WHERE node_id = ? AND ended_at IS NULL`).get(nodeId) as Row | undefined
    if (active && !active.before_focus) {
      const seconds = effectiveSeconds(String(active.started_at), String(active.suspended_at ?? nowIso()), Number(active.paused_seconds))
      if (seconds < 300) {
        const preview = advanceMossRuntime(state, Number(active.progress_seconds) + seconds, marks, [])
        // Before the existing acceptance gate, only movement is a preview.
        state = { ...preview.state, notes: state.notes }
      }
    }
    const owned = !!this.db.prepare('SELECT 1 FROM map_cores WHERE map_id = ?').get(MOSS_MAP_ID)
    const snapshot = mossSceneSnapshot(nodeId, state, marks, owned)
    snapshot.saplingTaken = this.nurseryMarks().saplingInLuggage || this.nurseryMarks().saplingPlanted
    if (snapshot.action?.eventId) {
      const plan = this.db.prepare('SELECT requested_item FROM forest_explorations WHERE node_id = ?').get(nodeId) as Row | undefined
      const find = ALL_SPECIAL_FINDS.find((entry) => entry.eventId === snapshot.action?.eventId ||
        (snapshot.action?.eventId === 'rare_ledger_rubbing' && entry.eventId === 'rare_tablet_rubbing'))
      if (plan?.requested_item && find?.itemKey === String(plan.requested_item)) snapshot.action = { ...snapshot.action, specifiedByCore: true }
    }
    return snapshot
  }

  private recoverMossFindPresentation(): void {
    this.db.transaction(() => {
      const rows = this.db.prepare('SELECT node_id, state_json FROM area_scene_states').all() as Row[]
      for (const row of rows) {
        const state = JSON.parse(String(row.state_json)) as MossRuntime
        const finds = this.db.prepare('SELECT id FROM forest_reward_rolls WHERE node_id = ? AND item_key IS NOT NULL').all(row.node_id) as Row[]
        state.handledFinds = [...new Set([...state.handledFinds, ...finds.map(find => String(find.id))])]
        if (state.intent?.kind === 'special') { state.intent = null; state.action = null }
        this.db.prepare('UPDATE area_scene_states SET state_json = ? WHERE node_id = ?').run(JSON.stringify(state), row.node_id)
      }
    })()
  }

  getMossDeparture(sessionId: string): ReturnType<typeof mossDeparture> | null {
    const session = this.db.prepare('SELECT node_id FROM sessions WHERE id = ?').get(sessionId) as Row | undefined
    if (!session?.node_id) return null
    const node = this.db.prepare('SELECT parent_node_id, departure_exit_id FROM expedition_nodes WHERE id = ?').get(session.node_id) as Row
    if (!node.parent_node_id || this.mapIdForNode(String(node.parent_node_id)) !== MOSS_MAP_ID) return null
    const first = this.db.prepare('SELECT id FROM sessions WHERE node_id = ? ORDER BY started_at, id LIMIT 1').get(session.node_id) as Row
    if (first.id !== sessionId) return null
    const exit = node.departure_exit_id === 'exit_boat' ? 'exit_boat' : node.departure_exit_id === 'exit_tunnel' ? 'exit_tunnel' : null
    if (!exit) return null
    const rain = this.getMossScene(String(node.parent_node_id))?.weather.phase === 'rain'
    return mossDeparture(String(node.parent_node_id), exit, rain)
  }

  recordWorldMark(sessionId: string, mark: string): AppSnapshot {
    const pebbleToken = mark.startsWith('shrinePebble:') ? mark.slice('shrinePebble:'.length) : null
    const ambient = /^ambientEvent:([\w-]+):(\d+(?:\.\d+)?)$/.exec(mark)
    if (!['tree_traces_seen', 'paperBoat', 'chestOpen'].includes(mark) && !pebbleToken && !ambient) throw new Error('未知的森林世界記憶。')
    const session = this.db.prepare(`SELECT sessions.*, expedition_nodes.progress_seconds
      FROM sessions JOIN expedition_nodes ON expedition_nodes.id = sessions.node_id
      WHERE sessions.id = ?`).get(sessionId) as Row | undefined
    if (!session || !session.planned_minutes || this.mapIdForNode(String(session.node_id)) !== FOREST_MAP_ID) throw new Error('找不到這次森林探索。')
    const end = session.ended_at ?? session.suspended_at ?? nowIso()
    const progress = session.ended_at ? Number(session.progress_seconds)
      : Number(session.progress_seconds) + effectiveSeconds(String(session.started_at), String(end), Number(session.paused_seconds))
    if (mark === 'tree_traces_seen' && progress < Number(session.planned_minutes) * 60) throw new Error('尚未抵達大樹休息階段。')
    if (mark !== 'tree_traces_seen' && (session.ended_at || session.suspended_at)) throw new Error('這次專注已停止。')
    if (ambient) {
      const id = ambient[1], at = Number(ambient[2])
      if (!cloudScene.events.some(event => event.id === id && event.outcome === 'ambient') || !Number.isFinite(at) || at > progress + 2) throw new Error('無效的環境事件紀錄。')
      const row = this.db.prepare('SELECT ambient_history FROM forest_explorations WHERE node_id = ?').get(session.node_id) as Row
      const history = JSON.parse(String(row.ambient_history)) as Array<{ id: string; at: number }>
      const previous = history.find(event => event.id === id)
      if (!previous || at > previous.at) {
        this.db.prepare('UPDATE forest_explorations SET ambient_history = ? WHERE node_id = ?')
          .run(JSON.stringify([...history.filter(event => event.id !== id), { id, at }]), session.node_id)
      }
      return this.getSnapshot()
    }
    const insert = this.db.prepare('INSERT OR IGNORE INTO world_marks (map_id, mark, seen_at) VALUES (?, ?, ?)')
    this.db.transaction(() => {
      if (pebbleToken) {
        if (pebbleToken.length > 180 || !pebbleToken.startsWith(`${session.node_id}:`) || !/^[\w:.-]+$/.test(pebbleToken)) throw new Error('無效的石祠事件紀錄。')
        if (!insert.run(FOREST_MAP_ID, `shrine_event:${pebbleToken}`, nowIso()).changes) return
        const count = Number((this.db.prepare("SELECT COUNT(*) AS count FROM world_marks WHERE map_id = ? AND mark GLOB 'shrine_pebble_[0-9]*'").get(FOREST_MAP_ID) as Row).count)
        if (count < 15) insert.run(FOREST_MAP_ID, `shrine_pebble_${count + 1}`, nowIso())
      } else insert.run(FOREST_MAP_ID, mark, nowIso())
    })()
    return this.getSnapshot()
  }

  private backfillDepartureExits(): void {
    const rows = this.db.prepare(`
      SELECT expedition_nodes.id, expedition_nodes.parent_node_id, expedition_nodes.depth,
             daily_runs.seed, daily_runs.id AS run_id
      FROM expedition_nodes JOIN daily_runs ON daily_runs.id = expedition_nodes.run_id
      WHERE expedition_nodes.parent_node_id IS NOT NULL AND expedition_nodes.departure_exit_id IS NULL
    `).all() as Row[]
    const update = this.db.prepare('UPDATE expedition_nodes SET departure_exit_id = ? WHERE id = ?')
    for (const row of rows) {
      const routes = generateRoutes(Number(row.seed), Number(row.depth), String(row.parent_node_id))
      const route = routes.find((candidate) => `${row.run_id}:${candidate.stableKey}` === row.id)
      if (route?.departureExitId) update.run(this.mapIdForNode(String(row.parent_node_id)) === MOSS_MAP_ID
        ? route.departureExitId === 'exit_high' ? 'exit_boat' : 'exit_tunnel'
          : this.mapIdForNode(String(row.parent_node_id)) === NURSERY_AREA_ID ? route.departureExitId === 'exit_high' ? 'exit_corridor' : 'exit_cellar'
          : this.mapIdForNode(String(row.parent_node_id)) === LAKE_AREA_ID ? route.departureExitId === 'exit_high' ? 'a_arch' : 'b_far' : route.departureExitId, row.id)
    }
  }

  close(): void {
    this.db.close()
  }

  private currentRun(): Row | undefined {
    // Old DBs may contain several unended daily runs. Keep every record, but prefer
    // the live session/review, then the most recent journey. Dates never reset it.
    return this.db.prepare(`SELECT daily_runs.* FROM daily_runs WHERE status = 'active'
      ORDER BY EXISTS(SELECT 1 FROM sessions WHERE run_id = daily_runs.id AND ended_at IS NULL) DESC,
        EXISTS(SELECT 1 FROM pending_debriefs WHERE run_id = daily_runs.id) DESC,
        started_at DESC, id DESC LIMIT 1`).get() as Row | undefined
  }

  private taskFromRow(row: Row): QuestTask {
    const steps = this.db.prepare('SELECT * FROM steps WHERE task_id = ? ORDER BY position').all(row.id) as Row[]
    return {
      id: String(row.id),
      title: String(row.title),
      role: row.role as QuestTask['role'],
      kind: row.kind as QuestTask['kind'],
      progressDefinition: String(row.progress_definition),
      starterAction: row.starter_action ? String(row.starter_action) : null,
      obstacle: row.obstacle as QuestTask['obstacle'],
      deadline: row.deadline ? String(row.deadline) : null,
      startCue: { type: row.cue_type as QuestTask['startCue']['type'], value: String(row.cue_value) },
      scheduledDate: row.scheduled_date ? String(row.scheduled_date) : null,
      status: row.status as QuestTask['status'],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      steps: steps.map((step) => ({
        id: String(step.id),
        taskId: String(step.task_id),
        text: String(step.text),
        position: Number(step.position),
        status: step.status as QuestTask['steps'][number]['status']
      }))
    }
  }

  private sessionFromRow(row: Row): FocusSession {
    const departureNode = row.node_id ? this.db.prepare(`
      SELECT parent_node_id, departure_exit_id, area_id FROM expedition_nodes WHERE id = ?
    `).get(row.node_id) as Row | undefined : undefined
    const departureExit = departureNode?.departure_exit_id
    const firstNodeSession = row.node_id ? this.db.prepare(`
      SELECT id FROM sessions WHERE node_id = ? ORDER BY started_at, id LIMIT 1
    `).get(row.node_id) as Row | undefined : undefined
    return {
      id: String(row.id),
      taskId: String(row.task_id),
      stepId: String(row.step_id),
      taskTitle: row.task_title ? String(row.task_title) : undefined,
      stepText: row.step_text ? String(row.step_text) : undefined,
      startedAt: String(row.started_at),
      endedAt: row.ended_at ? String(row.ended_at) : null,
      minimumMinutes: Number(row.minimum_minutes) as FocusSession['minimumMinutes'],
      presentation: row.focus_presentation === 'live' ? 'live' : 'quiet',
      beforeFocusCompleted: Boolean(row.before_focus_completed),
      beforeFocus: row.before_focus ? JSON.parse(String(row.before_focus)) : null,
      pausedSeconds: Number(row.paused_seconds),
      suspendedAt: row.suspended_at ? String(row.suspended_at) : null,
      manuallyPaused: Boolean(row.manual_paused),
      outcome: (row.outcome as FocusSession['outcome']) ?? null,
      blockedAttempts: Number(row.blocked_attempts),
      earnedLight: Number(row.earned_light),
      runId: row.run_id ? String(row.run_id) : null,
      nodeId: row.node_id ? String(row.node_id) : null,
      plannedMinutes: row.planned_minutes ? Number(row.planned_minutes) as FocusSession['plannedMinutes'] : null,
      departure: firstNodeSession?.id === row.id && departureNode?.parent_node_id &&
        this.mapIdForNode(String(departureNode.parent_node_id)) === FOREST_MAP_ID &&
        (departureExit === 'exit_high' || departureExit === 'exit_pines')
        ? area01Departure(String(departureNode.parent_node_id), departureExit)
        : null
    }
  }

  private runFromRow(row: Row): DailyRun {
    return {
      id: String(row.id),
      localDay: String(row.local_day),
      mainTaskId: String(row.main_task_id),
      seed: Number(row.seed),
      status: row.status as DailyRun['status'],
      depth: Number(row.depth),
      selectedNodeId: row.selected_node_id ? String(row.selected_node_id) : null,
      startedAt: String(row.started_at),
      endedAt: row.ended_at ? String(row.ended_at) : null
    }
  }

  private nodeFromRow(row: Row): ExpeditionNode {
    return {
      id: String(row.id),
      runId: String(row.run_id),
      areaId: String(row.area_id) as ExpeditionNode['areaId'],
      nurseryExitId: row.departure_exit_id === 'exit_corridor' || row.departure_exit_id === 'exit_cellar' ? row.departure_exit_id : null,
      lakeExitId: row.departure_exit_id === 'a_arch' || row.departure_exit_id === 'b_far' ? row.departure_exit_id : null,
      mossExitId: row.departure_exit_id === 'exit_boat' || row.departure_exit_id === 'exit_tunnel' ? row.departure_exit_id : null,
      parentNodeId: row.parent_node_id ? String(row.parent_node_id) : null,
      departureExitId: row.departure_exit_id === 'exit_high' || row.departure_exit_id === 'exit_pines' || row.departure_exit_id === 'exit_bridge' || row.departure_exit_id === 'exit_steps'
        ? row.departure_exit_id
        : null,
      depth: Number(row.depth),
      distance: row.distance as ExpeditionNode['distance'],
      type: row.type as ExpeditionNode['type'],
      title: String(row.title),
      description: String(row.description),
      environmentHint: String(row.environment_hint),
      plannedMinutes: Number(row.planned_minutes) as ExpeditionNode['plannedMinutes'],
      state: row.state as ExpeditionNode['state'],
      progressSeconds: Number(row.progress_seconds),
      eventKey: row.event_key ? String(row.event_key) : null,
      rewardOptions: jsonStrings(row.reward_options),
      selectedRelicKey: row.selected_relic_key ? String(row.selected_relic_key) : null,
      createdAt: String(row.created_at)
    }
  }

  private relicFromRow(row: Row): RunRelic {
    return {
      id: String(row.id),
      runId: String(row.run_id),
      nodeId: String(row.node_id),
      relicKey: String(row.relic_key),
      acquiredAt: String(row.acquired_at)
    }
  }

  private specialFindFromRow(row: Row): SpecialFindAcquisition {
    const find = ALL_SPECIAL_FINDS.find((entry) => entry.itemKey === String(row.item_key))
    return {
      id: String(row.id),
      runId: String(row.run_id),
      nodeId: String(row.node_id),
      sessionId: String(row.session_id),
      lampIndex: Number(row.lamp_index),
      eventId: find?.eventId ?? '',
      itemKey: String(row.item_key),
      title: find?.title ?? '未知的發現',
      kind: find?.kind ?? 'relic',
      acquiredAt: String(row.rolled_at),
      specifiedByCore: Boolean(row.specified_by_core)
    }
  }

  private pendingFromRow(row: Row): PendingDebrief {
    return {
      sessionId: String(row.session_id),
      runId: String(row.run_id),
      nodeId: String(row.node_id),
      resolution: row.resolution as PendingDebrief['resolution'],
      effectiveSeconds: Number(row.effective_seconds),
      progressSeconds: Number(row.progress_seconds),
      thresholdSeconds: Number(row.threshold_seconds),
      outcome: (row.outcome as PendingDebrief['outcome']) ?? null,
      completeTask: row.complete_task == null ? null : bool(row.complete_task),
      createdAt: String(row.created_at)
    }
  }

  private archiveState(): ArchiveState {
    const specialRows = this.db.prepare(`
      SELECT id, run_id, node_id, session_id, location_title, lamp_index, item_key, rolled_at FROM special_find_rolls WHERE item_key IS NOT NULL
      UNION ALL SELECT id, run_id, node_id, session_id, location_title, lamp_index, item_key, rolled_at FROM forest_reward_rolls WHERE item_key IS NOT NULL ORDER BY rolled_at
    `).all() as Row[]
    const specialFinds: ArchiveState['specialFinds'] = []
    for (const row of specialRows) {
      const acquired = this.specialFindFromRow(row)
      const existing = specialFinds.find((entry) => entry.key === acquired.itemKey)
      if (existing) existing.acquiredCount += 1
      else specialFinds.push({
        key: acquired.itemKey,
        eventId: acquired.eventId,
        title: acquired.title,
        kind: acquired.kind,
        firstDiscoveredAt: acquired.acquiredAt,
        firstLocation: String(row.location_title),
        acquiredCount: 1
      })
    }
    const relicRows = this.db.prepare(`
      SELECT run_relics.relic_key, run_relics.acquired_at, expedition_nodes.title AS location_title,
             tasks.title AS task_title
      FROM run_relics
      JOIN expedition_nodes ON expedition_nodes.id = run_relics.node_id
      JOIN daily_runs ON daily_runs.id = run_relics.run_id
      JOIN tasks ON tasks.id = daily_runs.main_task_id
      ORDER BY run_relics.acquired_at
    `).all() as Row[]
    const relics: ArchiveState['relics'] = []
    for (const row of relicRows) {
      const key = String(row.relic_key)
      const known = RUN_RELICS[key as keyof typeof RUN_RELICS]
      const existing = relics.find((entry) => entry.key === key)
      if (existing) {
        existing.acquiredCount += 1
      } else {
        relics.push({
          key,
          title: known?.title ?? '未命名遺物',
          description: known?.description ?? '一件由遠征帶回的物件。',
          firstDiscoveredAt: String(row.acquired_at),
          firstLocation: String(row.location_title),
          firstTaskTitle: String(row.task_title),
          acquiredCount: 1
        })
      }
    }

    const visitedRows = this.db.prepare(`
      SELECT expedition_nodes.id, expedition_nodes.title, expedition_nodes.event_key,
             COALESCE(MIN(sessions.ended_at), expedition_nodes.created_at) AS visited_at,
             COALESCE(SUM(CASE WHEN sessions.ended_at IS NOT NULL THEN
               CAST(MAX(0, (julianday(sessions.ended_at) - julianday(sessions.started_at)) * 86400 - sessions.paused_seconds) AS INTEGER)
             ELSE 0 END), 0) AS focus_seconds
      FROM expedition_nodes
      LEFT JOIN sessions ON sessions.node_id = expedition_nodes.id
      WHERE expedition_nodes.state IN ('cleared', 'awaiting_reward', 'awaiting_route')
      GROUP BY expedition_nodes.id
      ORDER BY visited_at
    `).all() as Row[]
    const locations: ArchiveState['locations'] = []
    const events: ArchiveState['events'] = []
    for (const row of visitedRows) {
      const title = String(row.title)
      const eventKey = row.event_key ? String(row.event_key) : null
      const event = eventKey ? EXPEDITION_EVENTS[eventKey as keyof typeof EXPEDITION_EVENTS] : null
      const existingLocation = locations.find((entry) => entry.key === title)
      if (existingLocation) {
        existingLocation.visitCount += 1
        existingLocation.focusSeconds += Number(row.focus_seconds)
        if (event && !existingLocation.relatedEvents.includes(event.title)) existingLocation.relatedEvents.push(event.title)
      } else {
        locations.push({
          key: title,
          title,
          firstVisitedAt: String(row.visited_at),
          visitCount: 1,
          focusSeconds: Number(row.focus_seconds),
          relatedEvents: event ? [event.title] : []
        })
      }
      if (eventKey && event) {
        const existingEvent = events.find((entry) => entry.key === eventKey)
        if (existingEvent) existingEvent.discoveredCount += 1
        else events.push({
          key: eventKey,
          title: event.title,
          description: event.description,
          firstDiscoveredAt: String(row.visited_at),
          firstLocation: title,
          discoveredCount: 1
        })
      }
    }
    const lostLetter = events.find((entry) => entry.key === 'lost_letter')
    const letters: ArchiveState['letters'] = lostLetter ? [{
      key: 'lost_letter',
      title: '沒有寄出的信',
      description: '一封在檔案館深處被遺落、仍等待收錄的信。',
      firstDiscoveredAt: lostLetter.firstDiscoveredAt,
      firstLocation: lostLetter.firstLocation
    }] : []

    const completedRow = this.db.prepare('SELECT completed_at FROM restoration_projects WHERE project_key = ?')
      .get('restore_astrolabe') as Row | undefined
    const requirements = [
      { key: 'glass_observatory', label: '找到玻璃觀測台', met: locations.some((entry) => entry.title === '玻璃觀測台') },
      { key: 'broken_compass', label: '帶回破損指南針', met: relics.some((entry) => entry.key === 'broken_compass') },
      { key: 'lost_letter', label: '收錄一封遺失信件', met: letters.length > 0 }
    ]
    const metCount = requirements.filter((requirement) => requirement.met).length
    const completedAt = completedRow ? String(completedRow.completed_at) : null
    const latestCandidates = [
      ...specialFinds.map((entry) => ({ title: entry.title, at: entry.firstDiscoveredAt })),
      ...relics.map((entry) => ({ title: entry.title, at: entry.firstDiscoveredAt })),
      ...locations.map((entry) => ({ title: entry.title, at: entry.firstVisitedAt })),
      ...events.map((entry) => ({ title: entry.title, at: entry.firstDiscoveredAt }))
    ].sort((a, b) => b.at.localeCompare(a.at))

    return {
      relics,
      specialFinds,
      locations,
      events,
      letters,
      restoration: {
        key: 'restore_astrolabe',
        title: '修復星盤',
        description: '把遠征帶回的線索重新放回黃銅星盤，讓觀測廳恢復方向。',
        requirements,
        progress: requirements.length ? metCount / requirements.length : 0,
        canComplete: !completedAt && metCount === requirements.length,
        completedAt
      },
      litRegionCount: locations.length,
      activeFacilityCount: completedAt ? 1 : 0,
      recentDiscovery: latestCandidates[0]?.title ?? null
    }
  }

  private acquireCollectionClue(clueId: string, acquiredAt = nowIso()): void {
    const clue = COLLECTION_CLUES.find((entry) => entry.id === clueId)
    if (!clue) throw new Error('未知的收藏室線索。')
    this.db.prepare(`INSERT OR IGNORE INTO collection_clues
      (id, kind, source_id, place_id, source_label, text, acquired_at, pinned_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`)
      .run(clue.id, clue.kind, clue.sourceId, clue.placeId, clue.sourceLabel, clue.text, acquiredAt)
  }

  private cloudStoryForSession(session: Row): NonNullable<AppSnapshot['cloudStory']> | null {
    if (!session.node_id || this.mapIdForNode(String(session.node_id)) !== FOREST_MAP_ID) return null
    const nodeId = String(session.node_id)
    // Snapshot reads must not create an exploration plan for old imported sessions.
    const plan = this.db.prepare('SELECT node_id, story_records, ambient_history FROM forest_explorations WHERE node_id = ?').get(nodeId) as Row | undefined
    if (!plan) return null
    const position = this.db.prepare('SELECT rowid AS seq FROM forest_explorations WHERE node_id = ?').get(nodeId) as Row
    const visit = Number((this.db.prepare('SELECT COUNT(*) AS count FROM forest_explorations WHERE map_id = ? AND rowid <= ?')
      .get(FOREST_MAP_ID, position.seq) as Row).count)
    const first = this.db.prepare('SELECT node_id FROM sessions WHERE node_id IS NOT NULL ORDER BY started_at, id LIMIT 1').get() as Row | undefined
    const itemRows = this.db.prepare(`SELECT item_key FROM forest_reward_rolls WHERE run_id = ? AND node_id != ? AND item_key IS NOT NULL
      UNION SELECT item_key FROM special_find_rolls WHERE run_id = ? AND node_id != ? AND item_key IS NOT NULL
      UNION SELECT relic_key AS item_key FROM run_relics WHERE run_id = ? AND node_id != ?`)
      .all(session.run_id, nodeId, session.run_id, nodeId, session.run_id, nodeId) as Row[]
    const aliases: Record<string, string> = { charcoal_rubbing: 'charcoal_paper', copper_wind_whistle: 'wind_whistle' }
    const items = [...new Set(itemRows.map((row) => aliases[String(row.item_key)] ?? String(row.item_key)))]
    const records = JSON.parse(String(plan.story_records)) as string[]
    const knownClues = (this.db.prepare("SELECT id FROM collection_clues WHERE source_id = 'm01'").all() as Row[]).map(row => String(row.id))
    const story = { nodeId, visit, opening: visit === 1 && first?.node_id === nodeId, items, whaleSeed: weatherSeedFrom(nodeId), records, knownClues }
    return { ...story, scheduledEvents: cloudStorySchedule(story), eventHistory: JSON.parse(String(plan.ambient_history)) }
  }

  private migrateCloudStoryRecords(): void {
    this.db.exec(`UPDATE forest_explorations SET story_records = COALESCE((SELECT json_group_array(id)
      FROM collection_clues WHERE source_id = 'm01' AND acquired_at >= forest_explorations.created_at
      AND acquired_at < COALESCE((SELECT MIN(next.created_at) FROM forest_explorations next
        WHERE next.created_at > forest_explorations.created_at), '9999')
      AND id IN ('c01_first_tree','c01_bark_date','c01_stele_scale','h1a','c01_rubbing','c01_tag')), '[]')
      WHERE map_id = 'area-01-cloud-ruins'`)
    // Even a very short completed first Focus retires the cinematic opening.
    const first = this.db.prepare('SELECT node_id FROM sessions WHERE node_id IS NOT NULL ORDER BY started_at, id LIMIT 1').get() as Row | undefined
    if (first && this.db.prepare('SELECT 1 FROM sessions WHERE node_id = ? AND ended_at IS NOT NULL').get(first.node_id)
      && this.db.prepare('SELECT 1 FROM forest_explorations WHERE node_id = ? AND map_id = ?').get(first.node_id, FOREST_MAP_ID)) {
      this.saveCloudStoryRecord(String(first.node_id), 'c01_first_tree')
    }
  }

  private saveCloudStoryRecord(nodeId: string, id: string): boolean {
    const row = this.db.prepare('SELECT story_records FROM forest_explorations WHERE node_id = ?').get(nodeId) as Row
    const records = JSON.parse(String(row.story_records)) as string[]
    if (records.includes(id)) return false
    records.push(id)
    this.db.prepare('UPDATE forest_explorations SET story_records = ? WHERE node_id = ?').run(JSON.stringify(records), nodeId)
    if (COLLECTION_CLUES.some(clue => clue.id === id)) this.acquireCollectionClue(id)
    return true
  }

  private syncCloudStoryClues(session: Row, seconds: number, ending = false): boolean {
    const story = this.cloudStoryForSession(session)
    if (!story) return false
    const plannedSeconds = Number(session.planned_minutes) * 60
    const progress = Number(session.progress_seconds) + seconds
    let changed = false
    for (const [id, time] of Object.entries(cloudStoryEventTimes(story, plannedSeconds))) {
      if(progress>=time.earliest)this.saveFocusEvent(session,id==='c01_first_tree'?(story.opening?'opening_a':'notebook_a'):CLOUD_RECORD_EVENTS[id]??id,'story',time.earliest)
      if (progress < time.fallback && !(ending && id === 'c01_first_tree' && (story.opening || progress >= time.earliest))) continue
      changed = this.saveCloudStoryRecord(story.nodeId, id) || changed
    }
    // The first complete route has seen the same tree traces even if rendering was unavailable.
    if (ending && !story.knownClues?.includes('c01_bark_date') && progress >= plannedSeconds) {
      this.db.prepare('INSERT OR IGNORE INTO world_marks (map_id, mark, seen_at) VALUES (?, ?, ?)')
        .run(FOREST_MAP_ID, 'tree_traces_seen', nowIso())
      changed = this.saveCloudStoryRecord(story.nodeId, 'c01_bark_date') || changed
    }
    return changed
  }

  recordCloudStoryClue(sessionId: string, clueId: string): AppSnapshot {
    const session = this.db.prepare(`SELECT sessions.*, expedition_nodes.progress_seconds FROM sessions
      JOIN expedition_nodes ON expedition_nodes.id = sessions.node_id WHERE sessions.id = ?`).get(sessionId) as Row | undefined
    if (!session || !session.planned_minutes) throw new Error('找不到這次雲上遺庭探索。')
    if (session.ended_at || session.suspended_at) throw new Error('這次專注已停止，不能新增故事紀錄。')
    const story = this.cloudStoryForSession(session)
    if (!story) throw new Error('這次探索不在雲上遺庭。')
    // The durable fallback can finish before a slow animation reports the same
    // clue. Acknowledging that saved record must not turn into a UI error.
    if (story.records.includes(clueId)) return this.getSnapshot()
    const allowed = cloudStoryEventTimes(story, Number(session.planned_minutes) * 60)
    if (!allowed[clueId]) throw new Error('這次探索沒有這個線索。')
    const end = session.ended_at ?? session.suspended_at ?? nowIso()
    const seconds = effectiveSeconds(String(session.started_at), String(end), Number(session.paused_seconds))
    if (Number(session.progress_seconds) + seconds < allowed[clueId].earliest) throw new Error('尚未抵達這個故事事件。')
    this.saveFocusEvent(session,clueId==='c01_first_tree'?(story.opening?'opening_a':'notebook_a'):CLOUD_RECORD_EVENTS[clueId]??clueId,'story',Number(session.progress_seconds)+seconds)
    this.saveCloudStoryRecord(story.nodeId, clueId)
    return this.getSnapshot()
  }

  private syncCollectionDiscoveries(): void {
    const firstFocus = this.db.prepare(`SELECT sessions.ended_at, expedition_nodes.area_id FROM sessions
      JOIN expedition_nodes ON expedition_nodes.id = sessions.node_id
      WHERE sessions.ended_at IS NOT NULL ORDER BY sessions.ended_at LIMIT 1`).get() as Row | undefined
    if (firstFocus?.area_id === FOREST_MAP_ID) this.acquireCollectionClue('c01_first_tree', String(firstFocus.ended_at))
    // Moss clues now come from saved scene events or first item acquisition, not visit counts.
    for(const [item,clue] of [['tide_gauge_plate','n_plate'],['silvered_shard','n_shard']]){
      const found=this.db.prepare('SELECT rolled_at FROM forest_reward_rolls WHERE item_key = ? ORDER BY rolled_at LIMIT 1').get(item) as Row|undefined
      if(found)this.acquireCollectionClue(clue,String(found.rolled_at))
    }
  }

  private collectionRoomState(): AppSnapshot['collection'] {
    this.syncCollectionDiscoveries()
    const clues: AppSnapshot['collection']['clues'] = (this.db.prepare("SELECT * FROM collection_clues WHERE id != 'n_seed' AND (id != 'n_first' OR NOT EXISTS (SELECT 1 FROM collection_clues WHERE id = 'c01_first_tree')) ORDER BY acquired_at, id").all() as Row[]).map((row) => ({
      id: String(row.id), kind: row.kind as 'way' | 'look' | 'note', sourceId: String(row.source_id),
      placeId: row.place_id ? String(row.place_id) : null, sourceLabel: String(row.source_label), text: String(row.text),
      acquiredAt: String(row.acquired_at), pinnedAt: row.pinned_at ? String(row.pinned_at) : null
    }))
    const state = this.db.prepare('SELECT * FROM collection_state WHERE id = 1').get() as Row
    const pinned = new Set(clues.filter((clue) => clue.pinnedAt).map((clue) => clue.id))
    const pages = new Set((this.db.prepare('SELECT place_id FROM collection_pages').all() as Row[]).map((row) => String(row.place_id)))
    const visitedMapIds = (this.db.prepare(`SELECT DISTINCT expedition_nodes.area_id FROM expedition_nodes
      LEFT JOIN sessions ON sessions.node_id = expedition_nodes.id
      WHERE expedition_nodes.progress_seconds > 0 OR sessions.id IS NOT NULL OR expedition_nodes.state IN ('awaiting_reward', 'awaiting_route', 'cleared')`).all() as Row[])
      .map((row) => String(row.area_id))
    // Existing saves retain clue IDs and pin positions, but display the corrected authored wording.
    // Places mentioned in a note remain unnamed until the traveller has visited them.
    const visited = new Set(visitedMapIds)
    const ownedCores = new Set((this.db.prepare('SELECT map_id FROM map_cores').all() as Row[]).map(row => String(row.map_id)))
    const unknownNames: Array<[string, string]> = [
      ['area-04-wind-bridge', '風切斷橋'], ['area-07-glass-nursery', '玻璃苗圃'],
      ['area-10-prism-observatory', '折光觀測台']
    ]
    for (const clue of clues) {
      const definition = COLLECTION_CLUES.find(entry => entry.id === clue.id)
      if (!definition) continue
      clue.sourceLabel = definition.sourceLabel
      clue.text = definition.text
      const comparison = CLOUD_CLUE_COMPARISONS[clue.id]
      if (comparison && ownedCores.has(comparison.mapId)) clue.comparison = comparison.text
      for (const [mapId, name] of unknownNames) if (!visited.has(mapId)) clue.text = clue.text.replaceAll(name, '？？？')
    }
    return {
      clues,
      trackingPlaceId: state.tracking_place_id ? String(state.tracking_place_id) : null,
      presentedCoreMapIds: (this.db.prepare('SELECT map_id FROM collection_core_presentations ORDER BY presented_at').all() as Row[]).map((row) => String(row.map_id)),
      linkagePlayed: Boolean(state.linkage_played_at),
      visitedMapIds,
      completedJourneys: Number((this.db.prepare("SELECT COUNT(*) AS count FROM daily_runs WHERE status = 'ended'").get() as Row).count),
      hiddenPlaces: hiddenPlaceProgress(pinned, pages),
      explorationItemChoices: (this.db.prepare('SELECT node_id, requested_item FROM forest_explorations').all() as Row[])
        .map((row) => ({ nodeId: String(row.node_id), itemKey: row.requested_item ? String(row.requested_item) : null }))
    }
  }

  getSnapshot(): AppSnapshot {
    const taskList = this.taskList.snapshot()
    const firstDay = new Date()
    firstDay.setHours(0, 0, 0, 0)
    firstDay.setDate(firstDay.getDate() - 13)
    const activityRows = this.db.prepare(`SELECT sessions.id, sessions.started_at, sessions.ended_at, sessions.paused_seconds, sessions.local_day,
      tasks.title AS task_title, expedition_nodes.title AS map_title,
      COALESCE(pending_debriefs.complete_task, CASE WHEN sessions.outcome = 'completed' THEN 1 ELSE 0 END) AS completed
      FROM sessions JOIN tasks ON tasks.id = sessions.task_id
      LEFT JOIN expedition_nodes ON expedition_nodes.id = sessions.node_id
      LEFT JOIN pending_debriefs ON pending_debriefs.session_id = sessions.id
      WHERE sessions.ended_at IS NOT NULL AND sessions.local_day >= ? ORDER BY sessions.ended_at DESC`).all(localDay(firstDay)) as Row[]
    const recentActivityRows = this.db.prepare(`SELECT sessions.id, sessions.started_at, sessions.ended_at, sessions.paused_seconds,
      tasks.title AS task_title, expedition_nodes.title AS map_title,
      COALESCE(pending_debriefs.complete_task, CASE WHEN sessions.outcome = 'completed' THEN 1 ELSE 0 END) AS completed
      FROM sessions JOIN tasks ON tasks.id = sessions.task_id
      LEFT JOIN expedition_nodes ON expedition_nodes.id = sessions.node_id
      LEFT JOIN pending_debriefs ON pending_debriefs.session_id = sessions.id
      WHERE sessions.ended_at IS NOT NULL ORDER BY sessions.ended_at DESC LIMIT 5`).all() as Row[]
    const dayRows = new Map<string, { day: string; seconds: number; completedTasks: number }>()
    for (let offset = 0; offset < 14; offset++) {
      const day = new Date(firstDay); day.setDate(firstDay.getDate() + offset)
      const key = localDay(day)
      dayRows.set(key, { day: key, seconds: 0, completedTasks: 0 })
    }
    for (const row of activityRows) {
      const day = dayRows.get(String(row.local_day))
      if (day) day.seconds += effectiveSeconds(String(row.started_at), String(row.ended_at), Number(row.paused_seconds))
    }
    const completedRows = this.db.prepare(`SELECT id, title, updated_at FROM tasks WHERE status = 'done' AND deleted_at IS NULL AND updated_at >= ? ORDER BY updated_at DESC`).all(firstDay.toISOString()) as Row[]
    for (const row of completedRows) {
      const day = dayRows.get(localDay(new Date(String(row.updated_at))))
      if (day) day.completedTasks++
    }
    const journeyRows = this.db.prepare('SELECT id, started_at, ended_at FROM daily_runs ORDER BY started_at DESC').all() as Row[]
    const visitedNodeRows = this.db.prepare(`SELECT run_id, title FROM expedition_nodes
      WHERE progress_seconds > 0 OR state IN ('awaiting_reward','awaiting_route','cleared') ORDER BY depth, created_at`).all() as Row[]
    const coreRollRows = this.db.prepare("SELECT DISTINCT run_id, item_key FROM forest_reward_rolls WHERE reward_kind = 'core' AND item_key IS NOT NULL").all() as Row[]
    const mapsByRun = new Map<string, string[]>(), coresByRun = new Map<string, string[]>()
    for (const node of visitedNodeRows) mapsByRun.set(String(node.run_id), [...(mapsByRun.get(String(node.run_id)) ?? []), String(node.title)])
    for (const core of coreRollRows) coresByRun.set(String(core.run_id), [...(coresByRun.get(String(core.run_id)) ?? []),
      ALL_SPECIAL_FINDS.find((item) => item.itemKey === core.item_key)?.title ?? String(core.item_key)])
    const activityLog: AppSnapshot['activityLog'] = {
      days: [...dayRows.values()],
      sessions: recentActivityRows.map((row) => ({ id: String(row.id), title: String(row.task_title), startedAt: String(row.started_at),
        seconds: effectiveSeconds(String(row.started_at), String(row.ended_at), Number(row.paused_seconds)),
        mapTitle: row.map_title ? String(row.map_title) : null, completed: Boolean(row.completed) })),
      journeys: journeyRows.map((row) => ({ id: String(row.id), startedAt: String(row.started_at), endedAt: row.ended_at ? String(row.ended_at) : null,
        maps: mapsByRun.get(String(row.id)) ?? [], cores: coresByRun.get(String(row.id)) ?? [] })),
      recentlyCompleted: completedRows.map((row) => ({ id: String(row.id), title: String(row.title), completedAt: String(row.updated_at) }))
    }
    const taskRows = this.db.prepare(`
      SELECT * FROM tasks
      WHERE status != 'archived' AND deleted_at IS NULL
        AND (routine_id IS NULL OR scheduled_date = ? OR id IN (SELECT task_id FROM sessions WHERE ended_at IS NULL))
      ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, list_position, created_at, id
    `).all(taskList.localDay) as Row[]
    const activeRow = this.db.prepare(`
      SELECT sessions.*, tasks.title AS task_title, steps.text AS step_text
      FROM sessions
      JOIN tasks ON tasks.id = sessions.task_id
      JOIN steps ON steps.id = sessions.step_id
      WHERE sessions.ended_at IS NULL
      ORDER BY sessions.started_at DESC LIMIT 1
    `).get() as Row | undefined
    const recentRows = this.db.prepare(`
      SELECT sessions.*, tasks.title AS task_title, steps.text AS step_text
      FROM sessions
      JOIN tasks ON tasks.id = sessions.task_id
      JOIN steps ON steps.id = sessions.step_id
      WHERE sessions.ended_at IS NOT NULL
      ORDER BY sessions.ended_at DESC LIMIT 30
    `).all() as Row[]
    const blockRows = this.db.prepare('SELECT * FROM block_rules ORDER BY display_name').all() as Row[]
    const rpgRow = this.db.prepare('SELECT * FROM rpg_state WHERE id = 1').get() as Row
    const settingsRow = this.db.prepare('SELECT * FROM settings WHERE id = 1').get() as Row
    const runRow = this.currentRun()
    const pendingRow = this.db.prepare(`
      SELECT pending_debriefs.* FROM pending_debriefs
      JOIN daily_runs ON daily_runs.id = pending_debriefs.run_id
      WHERE daily_runs.status = 'active' AND daily_runs.id = ?
      ORDER BY pending_debriefs.created_at DESC LIMIT 1
    `).get(runRow?.id ?? '') as Row | undefined
    const contextRunId = runRow?.id ?? pendingRow?.run_id ?? activeRow?.run_id
    const nodeRows = contextRunId
      ? this.db.prepare('SELECT * FROM expedition_nodes WHERE run_id = ? ORDER BY depth, created_at').all(contextRunId) as Row[]
      : []
    const relicRows = contextRunId
      ? this.db.prepare('SELECT * FROM run_relics WHERE run_id = ? ORDER BY acquired_at').all(contextRunId) as Row[]
      : []
    const specialRows = contextRunId
      ? this.db.prepare(`SELECT id, run_id, node_id, session_id, location_title, lamp_index, item_key, rolled_at, 0 AS specified_by_core FROM special_find_rolls WHERE run_id = ? AND item_key IS NOT NULL
          UNION ALL SELECT forest_reward_rolls.id, run_id, forest_reward_rolls.node_id, session_id, location_title, lamp_index, item_key, rolled_at,
            CASE WHEN reward_kind = 'journey' AND forest_explorations.requested_item = forest_reward_rolls.item_key THEN 1 ELSE 0 END AS specified_by_core
          FROM forest_reward_rolls JOIN forest_explorations ON forest_explorations.node_id = forest_reward_rolls.node_id
          WHERE run_id = ? AND item_key IS NOT NULL ORDER BY rolled_at`).all(contextRunId, contextRunId) as Row[]
      : []

    return {
      activityLog,
      nursery: runRow?.selected_node_id ? this.getNurseryScene(String(runRow.selected_node_id)) : null,
      caretaker: this.caretakerChoices(),
      lake: runRow?.selected_node_id ? this.getLakeScene(String(runRow.selected_node_id)) : null,
      mossStation: runRow?.selected_node_id ? this.getMossScene(String(runRow.selected_node_id)) : null,
      mossDiscoveries: this.mossDiscoveries(contextRunId ? String(contextRunId) : undefined),
      lakeDiscoveries: this.lakeDiscoveries(contextRunId ? String(contextRunId) : undefined),
      cloudDiscoveries: this.cloudDiscoveries(contextRunId ? String(contextRunId) : undefined),
      cloudStory: activeRow?.node_id ? this.cloudStoryForSession(activeRow) : null,
      seenFindIds: (this.db.prepare('SELECT acquisition_id FROM lobby_find_reads').all() as Row[]).map((row) => String(row.acquisition_id)),
      mapVisits: (this.db.prepare("SELECT area_id, COUNT(*) AS count FROM expedition_nodes WHERE state IN ('awaiting_reward', 'awaiting_route', 'cleared') GROUP BY area_id").all() as Row[])
        .map(row => ({ mapId: String(row.area_id), completed: Number(row.count) })),
      taskList,
      mapCores: (this.db.prepare('SELECT * FROM map_cores').all() as Row[]).map((row) => ({ mapId: String(row.map_id), itemKey: String(row.item_key), acquiredAt: String(row.acquired_at) })),
      worldMarks: (this.db.prepare('SELECT * FROM world_marks').all() as Row[]).map((row) => ({ mapId: String(row.map_id), mark: String(row.mark), seenAt: String(row.seen_at) })),
      collection: this.collectionRoomState(),
      tasks: taskRows.map((row) => this.taskFromRow(row)),
      activeSession: activeRow ? this.sessionFromRow(activeRow) : null,
      recentSessions: recentRows.map((row) => this.sessionFromRow(row)),
      blockRules: blockRows.map((row): BlockRule => ({
        id: String(row.id),
        processName: String(row.process_name),
        displayName: String(row.display_name),
        enabled: bool(row.enabled),
        createdAt: String(row.created_at)
      })),
      rpg: {
        chapter: Number(rpgRow.chapter),
        node: Number(rpgRow.node),
        focusSeconds: Number(rpgRow.focus_seconds),
        light: Number(rpgRow.light),
        starPages: Number(rpgRow.star_pages),
        materials: Number(rpgRow.materials),
        ability: (rpgRow.ability as RpgChoice | null) ?? null,
        lastLoot: rpgRow.last_loot ? String(rpgRow.last_loot) : null
      },
      settings: {
        focusPresentation: settingsRow.focus_presentation === 'live' ? 'live' : 'quiet',
        audioMuted: bool(settingsRow.audio_muted),
        environmentVolume: Number(settingsRow.environment_volume),
        musicVolume: Number(settingsRow.music_volume),
        reminderPolicy: settingsRow.reminder_policy as AppSettings['reminderPolicy'],
        eveningReminder: String(settingsRow.evening_reminder),
        miniTimer: bool(settingsRow.mini_timer),
        phoneRitual: bool(settingsRow.phone_ritual),
        coatColor: settingsRow.coat_color as AppSettings['coatColor'],
        lanternColor: settingsRow.lantern_color as AppSettings['lanternColor']
      },
      todayRun: runRow ? this.runFromRow(runRow) : null,
      expeditionNodes: nodeRows.map((row) => this.nodeFromRow(row)),
      runRelics: relicRows.map((row) => this.relicFromRow(row)),
      specialFinds: specialRows.map((row) => this.specialFindFromRow(row)),
      pendingDebrief: pendingRow ? this.pendingFromRow(pendingRow) : null,
      archive: this.archiveState()
    }
  }

  inspectLobbyFind(acquisitionId: string): AppSnapshot {
    const exists = this.db.prepare(`SELECT id FROM special_find_rolls WHERE id = ? AND item_key IS NOT NULL
      UNION ALL SELECT id FROM forest_reward_rolls WHERE id = ? AND item_key IS NOT NULL`).get(acquisitionId, acquisitionId)
    const runId = String(this.currentRun()?.id ?? '')
    if (!exists && ![...this.mossDiscoveries(runId), ...this.cloudDiscoveries(runId), ...this.lakeDiscoveries(runId)].some(discovery => discovery.id === acquisitionId))
      throw new Error('找不到這項發現。')
    this.db.prepare('INSERT OR IGNORE INTO lobby_find_reads (acquisition_id, seen_at) VALUES (?, ?)').run(acquisitionId, nowIso())
    return this.getSnapshot()
  }

  pinCollectionClue(clueId: string): AppSnapshot {
    return this.pinCollectionClues([clueId])
  }

  pinCollectionClues(clueIds: string[]): AppSnapshot {
    if (!Array.isArray(clueIds) || clueIds.length === 0 || clueIds.some((id) => typeof id !== 'string')) throw new Error('請選擇要釘上的線索。')
    const pin = this.db.prepare('UPDATE collection_clues SET pinned_at = ? WHERE id = ? AND pinned_at IS NULL')
    const exists = this.db.prepare('SELECT 1 FROM collection_clues WHERE id = ?')
    this.db.transaction(() => {
      const at = nowIso()
      for (const id of new Set(clueIds)) {
        if (!exists.get(id)) throw new Error('這條線索還沒有取得。')
        pin.run(at, id)
      }
    })()
    return this.getSnapshot()
  }

  setTrackingClue(placeId: string | null): AppSnapshot {
    if (placeId !== null) {
      const progress = this.collectionRoomState().hiddenPlaces.find((place) => place.id === placeId)
      if (!progress?.revealed) throw new Error('這個地點還沒有完整浮現。')
    }
    this.db.prepare('UPDATE collection_state SET tracking_place_id = ? WHERE id = 1').run(placeId)
    return this.getSnapshot()
  }

  markCollectionCorePresented(mapId: string): AppSnapshot {
    if (!this.db.prepare('SELECT 1 FROM map_cores WHERE map_id = ?').get(mapId)) throw new Error('這件核心還沒有取得。')
    this.db.prepare('INSERT OR IGNORE INTO collection_core_presentations (map_id, presented_at) VALUES (?, ?)').run(mapId, nowIso())
    return this.getSnapshot()
  }

  markCollectionLinkagePlayed(): AppSnapshot {
    const count = Number((this.db.prepare('SELECT COUNT(*) AS count FROM map_cores').get() as Row).count)
    if (count < 10) throw new Error('十件核心還沒有集齊。')
    this.db.prepare('UPDATE collection_state SET linkage_played_at = COALESCE(linkage_played_at, ?) WHERE id = 1').run(nowIso())
    return this.getSnapshot()
  }

  inspectCampfireTrace(stage: number): AppSnapshot {
    if (!Number.isInteger(stage) || stage < 1 || stage > 4) throw new Error('未知的營火痕跡。')
    const met = this.db.prepare("SELECT 1 FROM world_marks WHERE map_id = 'campfire-start' AND mark = 'future_self_met'").get()
    const count = Number((this.db.prepare('SELECT COUNT(*) AS count FROM map_cores').get() as Row).count)
    const current = !met ? 0 : count === 0 ? 1 : count < 4 ? 2 : count < 7 ? 3 : 4
    if (stage !== current) throw new Error('這件痕跡還沒有出現。')
    this.db.prepare('INSERT OR IGNORE INTO lobby_find_reads (acquisition_id, seen_at) VALUES (?, ?)').run(`campfire-stage-${stage}`, nowIso())
    return this.getSnapshot()
  }

  addListTask(input: AddListTaskInput): AppSnapshot {
    this.taskList.add(input)
    return this.getSnapshot()
  }

  renameListTask(taskId: string, title: string): AppSnapshot {
    this.taskList.rename(taskId, title)
    return this.getSnapshot()
  }

  reorderTodayTasks(day: string, taskIds: string[]): AppSnapshot {
    this.taskList.reorder(day, taskIds)
    return this.getSnapshot()
  }

  moveTasksToToday(taskIds: string[]): AppSnapshot {
    this.taskList.moveToToday(taskIds)
    return this.getSnapshot()
  }

  setListTaskDone(taskId: string, done: boolean): AppSnapshot {
    this.taskList.setDone(taskId, done)
    return this.getSnapshot()
  }

  deleteListTask(taskId: string): AppSnapshot {
    this.taskList.remove(taskId)
    return this.getSnapshot()
  }

  deleteYesterdayTasks(input: DeleteYesterdayInput): AppSnapshot {
    this.taskList.deleteYesterday(input)
    return this.getSnapshot()
  }

  saveRoutines(inputs: SaveRoutineInput[]): AppSnapshot {
    this.taskList.saveRoutines(inputs)
    return this.getSnapshot()
  }

  startListFocus(input: StartListFocusInput): AppSnapshot {
    const list = this.taskList.snapshot()
    const taskId = input.taskId ?? list.nextTaskId
    const task = list.today.find((item) => item.id === taskId && !item.completed)
    if (!task?.stepId) throw new Error('請先加入或選擇今天要做的事項。')
    return this.startFocus({ ...input, taskId: task.id, stepId: task.stepId })
  }

  finishListFocus(sessionId: string, completed: boolean): AppSnapshot {
    if (typeof completed !== 'boolean') throw new Error('請回答事項完成了嗎。')
    this.endFocus({ sessionId, outcome: completed ? 'completed' : 'progress', completeTask: completed })
    return this.getSnapshot()
  }

  createTask(input: CreateTaskInput): AppSnapshot {
    const title = input.title.trim()
    if (!title) throw new Error('請輸入任務名稱。')
    const progressDefinition = input.progressDefinition.trim()
    if (!progressDefinition) throw new Error('請寫下今天做到什麼，就算真的有進展。')
    const starterAction = input.starterAction?.trim() || null

    const id = randomUUID()
    const timestamp = nowIso()
    const scheduledDate = input.role === 'backlog' ? null : localDay()
    const transaction = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO tasks
        (id, title, role, kind, progress_definition, starter_action, obstacle, deadline, cue_type, cue_value, scheduled_date, status, created_at, updated_at)
        VALUES (@id, @title, @role, @kind, @progressDefinition, @starterAction, @obstacle, @deadline, @cueType, @cueValue, @scheduledDate, 'active', @createdAt, @updatedAt)
      `).run({
        id,
        title,
        role: input.role,
        kind: input.kind,
        progressDefinition,
        starterAction,
        obstacle: input.obstacle,
        deadline: input.deadline || null,
        cueType: input.startCue.type,
        cueValue: input.startCue.value.trim(),
        scheduledDate,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      const statement = this.db.prepare('INSERT INTO steps (id, task_id, text, position, status) VALUES (?, ?, ?, ?, ?)')
      statement.run(randomUUID(), id, progressDefinition, 0, 'pending')
      this.recordEvent('task_created', { roleMain: input.role === 'main', starterSelected: Boolean(starterAction) })
    })
    transaction()
    return this.getSnapshot()
  }

  setTaskRole(taskId: string, role: TaskRole): AppSnapshot {
    if (!['main', 'side', 'backlog'].includes(role)) throw new Error('未知的舊版事項分類。')
    this.db.transaction(() => {
      if (role === 'backlog') this.taskList.park(taskId)
      else this.taskList.moveToToday([taskId])
      // Only the legacy renderer reads this label; there are no role limits.
      this.db.prepare('UPDATE tasks SET role = ? WHERE id = ?').run(role, taskId)
    })()
    return this.getSnapshot()
  }

  archiveTask(taskId: string): AppSnapshot {
    return this.deleteListTask(taskId)
  }

  deleteTask(taskId: string): AppSnapshot {
    return this.deleteListTask(taskId)
  }

  private insertGeneratedRoutes(runId: string, seed: number, depth: number, parentNodeId: string | null): void {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO expedition_nodes
      (id, area_id, run_id, parent_node_id, departure_exit_id, depth, distance, type, title, description, environment_hint,
       planned_minutes, state, progress_seconds, event_key, reward_options, selected_relic_key, created_at)
      VALUES (@id, @areaId, @runId, @parentNodeId, @departureExitId, @depth, @distance, @type, @title, @description, @environmentHint,
               @plannedMinutes, 'available', 0, NULL, '[]', NULL, @createdAt)
    `)
    const visitedAreaIds = (this.db.prepare(`SELECT DISTINCT area_id FROM expedition_nodes
      WHERE run_id = ? AND state IN ('awaiting_reward', 'awaiting_route', 'cleared')`).all(runId) as Row[]).map((row) => String(row.area_id))
    const ownedCoreAreaIds = (this.db.prepare('SELECT map_id FROM map_cores').all() as Row[]).map((row) => String(row.map_id))
    for (const route of generateRoutes(seed, depth, parentNodeId, { visitedAreaIds, ownedCoreAreaIds })) {
      insert.run({
        ...route,
        departureExitId: parentNodeId && this.mapIdForNode(parentNodeId) === MOSS_MAP_ID
          ? route.departureExitId === 'exit_high' ? 'exit_boat' : 'exit_tunnel'
          : parentNodeId && this.mapIdForNode(parentNodeId) === NURSERY_AREA_ID ? route.departureExitId === 'exit_high' ? 'exit_corridor' : 'exit_cellar'
          : parentNodeId && this.mapIdForNode(parentNodeId) === LAKE_AREA_ID ? route.departureExitId === 'exit_high' ? 'a_arch' : 'b_far' : route.departureExitId,
        id: `${runId}:${route.stableKey}`,
        runId,
        parentNodeId,
        createdAt: nowIso()
      })
    }
  }

  startDailyRun(mainTaskId: string): AppSnapshot {
    this.taskList.prepareDay()
    const existing = this.currentRun()
    if (existing) return this.getSnapshot()
    const task = this.db.prepare(`
      SELECT id FROM tasks WHERE id = ? AND status = 'active' AND deleted_at IS NULL AND scheduled_date = ?
    `).get(mainTaskId, localDay())
    if (!task) throw new Error('請先選擇今天要做的事項。')

    const id = randomUUID()
    const seed = Number.parseInt(randomUUID().replaceAll('-', '').slice(0, 8), 16) & 0x7fffffff
    const timestamp = nowIso()
    const transaction = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO daily_runs (id, local_day, main_task_id, seed, status, depth, selected_node_id, started_at, ended_at)
        VALUES (?, ?, ?, ?, 'active', 0, NULL, ?, NULL)
      `).run(id, localDay(), mainTaskId, seed, timestamp)
      this.insertGeneratedRoutes(id, seed, 0, null)
      this.recordEvent('daily_run_started', { depth: 0 })
    })
    transaction()
    return this.getSnapshot()
  }

  selectExpeditionNode(runId: string, nodeId: string): AppSnapshot {
    const transaction = this.db.transaction(() => {
      const run = this.db.prepare("SELECT * FROM daily_runs WHERE id = ? AND status = 'active'").get(runId) as Row | undefined
      if (!run) throw new Error('找不到今天的遠征。')
      if (this.currentRun()?.id !== runId) throw new Error('這不是目前的旅程。')
      if (this.db.prepare('SELECT 1 FROM sessions WHERE ended_at IS NULL').get()) throw new Error('專注進行中時不能改走其他路。')
      const node = this.db.prepare('SELECT * FROM expedition_nodes WHERE id = ? AND run_id = ?').get(nodeId, runId) as Row | undefined
      if (!node) throw new Error('這條路不屬於目前的遠征。')
      const currentNodeId = run.selected_node_id ? String(run.selected_node_id) : null
      if (currentNodeId === nodeId && ['selected', 'partial'].includes(String(node.state))) return
      if (!['available', 'partial'].includes(String(node.state))) throw new Error('這條路目前不能被選擇。')
      if (Number(node.depth) !== Number(run.depth)) throw new Error('這條路還不在目前可選的深度。')
      if (currentNodeId) {
        const current = this.db.prepare('SELECT * FROM expedition_nodes WHERE id = ? AND run_id = ?').get(currentNodeId, runId) as Row | undefined
        if (!current || !['selected', 'partial'].includes(String(current.state))) throw new Error('專注進行中時不能改走其他路。')
        if (current.state === 'partial') throw new Error('請先完成目前地圖的探索，才能選擇下一條路。')
        if (String(current.parent_node_id ?? '') !== String(node.parent_node_id ?? '')) throw new Error('這不是同一個岔路口的候選路線。')
        if (current.state === 'selected') {
          const released = this.db.prepare("UPDATE expedition_nodes SET state = 'available' WHERE id = ? AND state = 'selected'").run(currentNodeId)
          if (released.changes !== 1) throw new Error('目前路線狀態已改變，請重新確認。')
        }
      }
      if (node.state === 'available') {
        const selected = this.db.prepare("UPDATE expedition_nodes SET state = 'selected' WHERE id = ? AND state = 'available'").run(nodeId)
        if (selected.changes !== 1) throw new Error('這條路目前不能被選擇。')
      }
      this.db.prepare('UPDATE daily_runs SET selected_node_id = ? WHERE id = ?').run(nodeId, runId)
      this.recordEvent('expedition_route_selected', {
        depth: Number(node.depth),
        plannedMinutes: Number(node.planned_minutes),
        switched: Boolean(currentNodeId)
      })
    })
    transaction()
    return this.getSnapshot()
  }

  private eventScene(session: Row, at: number): FocusEventRecord['scene'] {
    const id = String(session.node_id), map = this.mapIdForNode(id)
    const row = this.db.prepare('SELECT state_json FROM area_scene_states WHERE node_id = ?').get(id) as Row | undefined
    const state = row ? JSON.parse(String(row.state_json)) : null
    const core = !!this.db.prepare('SELECT 1 FROM map_cores WHERE map_id = ?').get(map)
    if (map === MOSS_MAP_ID && state) return {moss:mossSceneSnapshot(id, {...state,seconds:at}, this.mossMarks(), core)}
    if (map === LAKE_AREA_ID && state) return {lake:lakeSnapshot(id,{...state,seconds:at},this.lakeMarks(),core)}
    if (map === NURSERY_AREA_ID && state) return {nursery:{areaId:NURSERY_AREA_ID,nodeId:id,seed:state.seed,effectiveSeconds:at,action:state.action,worldMarks:this.nurseryMarks(),coreTaken:core}}
    return {cloud:this.cloudStoryForSession(session),coreTaken:core,worldMarks:(this.db.prepare('SELECT mark FROM world_marks WHERE map_id = ?').all(map) as Row[]).map(r=>String(r.mark))}
  }

  private makeFocusEvent(session: Row, eventId: string, kind: FocusEventRecord['kind'], at: number, phase: FocusEventRecord['phase'] = 'focus', scene = this.eventScene(session,at)): FocusEventRecord {
    const node = this.db.prepare('SELECT * FROM expedition_nodes WHERE id = ?').get(session.node_id) as Row
    const mapId = String(node.area_id), seed = scene.moss?.weatherSeed ?? scene.lake?.seed ?? scene.nursery?.seed ?? weatherSeedFrom(String(node.id))
    const carried = (this.db.prepare(`SELECT item_key FROM forest_reward_rolls WHERE run_id = ? AND item_key IS NOT NULL AND rolled_at <= ?
      UNION SELECT item_key FROM special_find_rolls WHERE run_id = ? AND item_key IS NOT NULL
      UNION SELECT relic_key AS item_key FROM run_relics WHERE run_id = ?`).all(node.run_id,nowIso(),node.run_id,node.run_id) as Row[]).map(r=>String(r.item_key))
    return {id:randomUUID(),eventId,kind,phase,sessionId:String(session.id),runId:String(node.run_id),nodeId:String(node.id),mapId,segment:Number(node.depth)+1,
      explorationSeconds:at,effectiveSeconds:phase==='before'?0:Math.max(0,at-Number(session.progress_seconds??node.progress_seconds)),timeOfDay:timeOfDayAt(at),
      weather:mapId===MOSS_MAP_ID?weatherAt(seed,at).phase:'clear',seed,carriedItems:carried,variant:eventId,skipped:false,recordedAt:nowIso(),scene:structuredClone(scene)}
  }

  private insertFocusEvent(record: FocusEventRecord): void {
    this.db.prepare('INSERT OR IGNORE INTO focus_event_records (id,session_id,run_id,node_id,event_id,payload) VALUES (?,?,?,?,?,?)')
      .run(record.id,record.sessionId,record.runId,record.nodeId,record.eventId,JSON.stringify(record))
  }
  private saveFocusEvent(session:Row,id:string,kind:FocusEventRecord['kind'],at:number,scene?:FocusEventRecord['scene']):void {
    if(this.db.prepare('SELECT 1 FROM focus_event_records WHERE node_id=? AND event_id=?').get(session.node_id,id))return
    this.insertFocusEvent(this.makeFocusEvent(session,id,kind,at,'focus',scene))
  }
  private captureRuntimeEvent(session:Row,at:number,id:string,scene:FocusEventRecord['scene']):void {
    const find=ALL_SPECIAL_FINDS.find(f=>f.eventId===id || (id==='rare_boat_plate'&&f.eventId==='rare_gauge_plate') || (id==='rare_ledger_rubbing'&&f.eventId==='rare_tablet_rubbing'))
    const map=this.mapIdForNode(String(session.node_id))
    const coreRecord=this.db.prepare("SELECT payload FROM focus_event_records WHERE node_id=? AND json_extract(payload,'$.kind')='core'").get(session.node_id) as Row|undefined
    const coreTaken=find?.kind!=='token'&&!!this.db.prepare('SELECT 1 FROM map_cores WHERE map_id=?').get(map)&&(!coreRecord||(JSON.parse(String(coreRecord.payload)) as FocusEventRecord).explorationSeconds<=at)
    if(scene.moss)scene.moss.coreTaken=coreTaken
    if(scene.lake){scene.lake.coreTaken=coreTaken;scene.lake.worldMarks.ringStill=!coreTaken}
    if(scene.nursery)scene.nursery.coreTaken=coreTaken
    const canonical=find?.eventId??id
    const old=this.db.prepare('SELECT payload,id FROM focus_event_records WHERE node_id=? AND event_id=?').get(session.node_id,canonical) as Row|undefined
    if(old){const record=JSON.parse(String(old.payload)) as FocusEventRecord;record.variant=id;record.scene=structuredClone(scene);this.db.prepare('UPDATE focus_event_records SET payload=? WHERE id=?').run(JSON.stringify(record),old.id)}
    else this.saveFocusEvent(session,id,find?(find.kind==='token'?'core':'item'):'story',at,scene)
  }
  private recordFocusLamps(session:Row,seconds:number):void {
    if (!session.node_id || seconds<300) return
    const base=Number(session.progress_seconds??0),step=Number(session.planned_minutes)*60/5
    for(let lamp=1;lamp<=5;lamp++)if(lamp*step>base&&lamp*step<=base+seconds)this.saveFocusEvent(session,`lamp:${lamp}`,'lamp',lamp*step)
  }

  private prepareBeforeFocus(session:Row):void {
    const node=this.db.prepare('SELECT * FROM expedition_nodes WHERE id = ?').get(session.node_id) as Row
    // Only the exploration's first Focus gets this queue. Partial resumes never consume another visit.
    if(this.db.prepare('SELECT 1 FROM sessions WHERE node_id = ? AND id <> ?').get(node.id,session.id))return
    const map=String(node.area_id),scene=this.eventScene(session,0),ids:string[]=[]
    if(map===FOREST_MAP_ID) {
      const plan=scene.cloud!
      if(!plan.knownClues?.includes('c01_first_tree'))ids.push(plan.opening?'opening_a':'notebook_a')
      if(plan.visit>=2){if(!plan.knownClues?.includes('c01_stele_scale'))ids.push('stele');if(!plan.knownClues?.includes('h1a'))ids.push('well')}
    } else if(map===MOSS_MAP_ID){const st=this.ensureMossState(String(node.id));if(st.storyPlan?.opening&&!this.db.prepare("SELECT 1 FROM collection_clues WHERE id='m02_open'").get())ids.push('story_open_carving');if(st.storyPlan?.visitEvent)ids.push(st.storyPlan.visitEvent==='story_first_lantern'&&weatherAt(st.weatherSeed,0).phase==='rain'?'story_first_lantern_rain':st.storyPlan.visitEvent)}
    else if(map===LAKE_AREA_ID){const st=this.ensureLakeState(String(node.id));if(st.storyPlan?.opening)ids.push('story_open_gauge');if(st.storyPlan?.visitEvent)ids.push(st.storyPlan.visitEvent)}
    else if(map===NURSERY_AREA_ID)ids.push(...this.ensureNurseryState(String(node.id)).stories.filter(id=>id.startsWith('story_first')||id.startsWith('story_second')))
    if(!ids.length)return
    const before:BeforeFocus={startedAt:String(session.started_at),queue:ids.map(id=>this.makeFocusEvent({...session,progress_seconds:0},id,'story',0,'before',scene)),startedIds:[]}
    this.db.prepare('UPDATE sessions SET before_focus = ?, suspended_at = started_at WHERE id = ?').run(JSON.stringify(before),session.id)
  }

  beginBeforeFocusEvent(sessionId:string,recordId:string):AppSnapshot {
    this.db.transaction(()=>{
      const session=this.db.prepare('SELECT * FROM sessions WHERE id=? AND ended_at IS NULL').get(sessionId) as Row|undefined
      if(!session?.before_focus)throw new Error('沒有待播的故事。')
      const before=JSON.parse(String(session.before_focus)) as BeforeFocus,record=before.queue.find(e=>e.id===recordId)
      if(!record)throw new Error('未知的故事。')
      if(before.startedIds.includes(recordId))return
      const next=before.queue.find(e=>!before.startedIds.includes(e.id))
      if(next?.id!==recordId)throw new Error('請依故事順序播放。')
      this.insertFocusEvent(record);before.startedIds.push(recordId)
      for(const clue of BEFORE_CLUES[record.eventId]??[]) {
        if(record.mapId===FOREST_MAP_ID)this.saveCloudStoryRecord(record.nodeId,clue)
        else this.acquireCollectionClue(clue)
      }
      const row=this.db.prepare('SELECT state_json FROM area_scene_states WHERE node_id=?').get(record.nodeId) as Row|undefined
      if(row){const state=JSON.parse(String(row.state_json))
        if(record.mapId===MOSS_MAP_ID){state.usedEvents.push(record.eventId);if(record.eventId.startsWith('story_first'))state.storyPlan.visitEvent=null;if(record.eventId==='story_open_carving'){state.storyPlan.opening=false;const marks=this.mossMarks();marks.carvingSeen=true;this.db.prepare('INSERT INTO map_world_state (map_id,state_json) VALUES (?,?) ON CONFLICT(map_id) DO UPDATE SET state_json=excluded.state_json').run(record.mapId,JSON.stringify(marks))}}
        if(record.mapId===LAKE_AREA_ID){state.startedStories.push(record.eventId);if(record.eventId===state.storyPlan.visitEvent)state.storyPlan.visitEvent=null;if(record.eventId==='story_open_gauge'){state.storyPlan.opening=false;const marks=this.lakeMarks();marks.gaugeCarving=true;this.db.prepare('INSERT INTO map_world_state (map_id,state_json) VALUES (?,?) ON CONFLICT(map_id) DO UPDATE SET state_json=excluded.state_json').run(record.mapId,JSON.stringify(marks))}}
        if(record.mapId===NURSERY_AREA_ID)state.startedStories.push(record.eventId)
        this.db.prepare('UPDATE area_scene_states SET state_json=? WHERE node_id=?').run(JSON.stringify(state),record.nodeId)
      }
      this.db.prepare('UPDATE sessions SET before_focus=? WHERE id=?').run(JSON.stringify(before),sessionId)
    })()
    return this.getSnapshot()
  }
  finishBeforeFocus(sessionId:string,skippedIds:string[]=[]):AppSnapshot {
    this.db.transaction(()=>{
      const session=this.db.prepare('SELECT * FROM sessions WHERE id=? AND ended_at IS NULL').get(sessionId) as Row|undefined
      if(!session)throw new Error('找不到進行中的專注。')
      if(!session.before_focus)return
      const before=JSON.parse(String(session.before_focus)) as BeforeFocus
      if(before.startedIds.length!==before.queue.length)throw new Error('請先播放或跳過待播故事。')
      for(const id of skippedIds){if(!before.startedIds.includes(id))throw new Error('無效的跳過紀錄。');this.db.prepare("UPDATE focus_event_records SET payload=json_set(payload,'$.skipped',json('true')) WHERE id=? AND session_id=?").run(id,sessionId)}
      this.db.prepare('UPDATE sessions SET before_focus=NULL,before_focus_completed=1,started_at=?,local_day=?,suspended_at=NULL,paused_seconds=0 WHERE id=?').run(nowIso(),localDay(),sessionId)
    })()
    return this.getSnapshot()
  }
  listReplayEvents(runId?:string):FocusEventRecord[] {
    const rows=(runId?this.db.prepare('SELECT payload FROM focus_event_records WHERE run_id=? ORDER BY rowid').all(runId):this.db.prepare('SELECT payload FROM focus_event_records ORDER BY rowid').all()) as Row[]
    return rows.map(r=>JSON.parse(String(r.payload)) as FocusEventRecord).filter(e=>e.kind!=='lamp'&&e.kind!=='item')
  }
  getReplayEvent(id:string):FocusEventRecord {
    const row=this.db.prepare('SELECT payload FROM focus_event_records WHERE id=?').get(id) as Row|undefined
    if(!row)throw new Error('找不到這段回想。')
    return JSON.parse(String(row.payload))
  }
  getFocusRecap(sessionId:string):FocusRecap {
    const row=this.db.prepare('SELECT * FROM sessions WHERE id=?').get(sessionId) as Row|undefined
    if(!row)throw new Error('找不到這次專注。')
    const records=(this.db.prepare('SELECT payload FROM focus_event_records WHERE session_id=?').all(sessionId) as Row[]).map(r=>JSON.parse(String(r.payload)) as FocusEventRecord)
    const seconds=effectiveSeconds(String(row.started_at),String(row.ended_at??row.suspended_at??nowIso()),Number(row.paused_seconds))
    return {sessionId,effectiveSeconds:seconds,presentation:row.focus_presentation==='live'?'live':'quiet',lamps:records.filter(e=>e.kind==='lamp').sort((a,b)=>a.effectiveSeconds-b.effectiveSeconds),events:recapOrder(records)}
  }

  startFocus(input: StartFocusInput): AppSnapshot {
    this.taskList.prepareDay()
    const existing = this.db.prepare('SELECT id FROM sessions WHERE ended_at IS NULL').get()
    if (existing) throw new Error('目前已有進行中的專注。')
    if (this.db.prepare('SELECT 1 FROM pending_debriefs WHERE outcome IS NULL').get()) throw new Error('請先回答這次事項完成了嗎。')
    const step = this.db.prepare(`
      SELECT steps.id, steps.task_id FROM steps JOIN tasks ON tasks.id = steps.task_id
      WHERE steps.id = ? AND tasks.id = ? AND steps.status = 'pending' AND tasks.status = 'active' AND tasks.deleted_at IS NULL AND tasks.scheduled_date = ?
    `).get(input.stepId, input.taskId, localDay())
    if (!step) throw new Error('這個步驟已完成或不存在。')

    const expeditionValues = input.runId || input.nodeId || input.plannedMinutes
    if (expeditionValues && (!input.runId || !input.nodeId || !input.plannedMinutes)) {
      throw new Error('遠征專注缺少必要的路線資料。')
    }

    const timestamp = nowIso()
    const transaction = this.db.transaction(() => {
      if (input.runId && input.nodeId && input.plannedMinutes) {
        const run = this.db.prepare("SELECT * FROM daily_runs WHERE id = ? AND status = 'active'").get(input.runId) as Row | undefined
        if (!run) throw new Error('找不到目前的遠征。')
        if (this.currentRun()?.id !== input.runId) throw new Error('這不是目前的旅程。')
        const currentTask = this.db.prepare("SELECT id FROM tasks WHERE id = ? AND status = 'active' AND deleted_at IS NULL AND scheduled_date = ?")
          .get(input.taskId, localDay())
        if (!currentTask) throw new Error('請先把這件事項排到今天。')
        if (String(run.main_task_id) !== input.taskId) {
          this.db.prepare('UPDATE daily_runs SET main_task_id = ? WHERE id = ?').run(input.taskId, input.runId)
          this.recordEvent('expedition_task_rebound', { retainedProgress: true })
        }
        if (String(run.selected_node_id) !== input.nodeId) throw new Error('必須先選定這條路才能開始。')
        const node = this.db.prepare('SELECT * FROM expedition_nodes WHERE id = ? AND run_id = ?').get(input.nodeId, input.runId) as Row | undefined
        if (!node || !['selected', 'partial'].includes(String(node.state))) throw new Error('這條路目前不能開始探索。')
        if (Number(node.planned_minutes) !== input.plannedMinutes) throw new Error('路線時間與已保存的資料不一致。')
        this.db.prepare("UPDATE expedition_nodes SET state = 'active' WHERE id = ?").run(input.nodeId)
        if (node.area_id === MOSS_MAP_ID && input.plannedMinutes !== 50) throw new Error('苔痕驛站每次探索為 50 分鐘。')
        this.forestPlan(input.nodeId, input.requestedJourneyItem ?? null)
        if (node.area_id === MOSS_MAP_ID) this.ensureMossState(input.nodeId)
        if (node.area_id === NURSERY_AREA_ID) { if (input.plannedMinutes !== 50) throw new Error('玻璃苗圃每次探索為 50 分鐘。'); this.ensureNurseryState(input.nodeId) }
        if (node.area_id === LAKE_AREA_ID) { if (input.plannedMinutes !== 50) throw new Error('倒影湖畔每次探索為 50 分鐘。'); this.ensureLakeState(input.nodeId) }
      }

      this.db.prepare(`
        INSERT INTO sessions
        (id, task_id, step_id, started_at, ended_at, minimum_minutes, paused_seconds, outcome,
         blocked_attempts, earned_light, local_day, run_id, node_id, planned_minutes, resolution_applied)
        VALUES (?, ?, ?, ?, NULL, ?, 0, NULL, 0, 0, ?, ?, ?, ?, 0)
      `).run(
        randomUUID(), input.taskId, input.stepId, timestamp, input.minimumMinutes, localDay(),
        input.runId ?? null, input.nodeId ?? null, input.plannedMinutes ?? null
      )
      const created = this.db.prepare('SELECT * FROM sessions WHERE ended_at IS NULL').get() as Row
      const mode = (this.db.prepare('SELECT focus_presentation FROM settings WHERE id = 1').get() as Row).focus_presentation
      this.db.prepare('UPDATE sessions SET focus_presentation = ? WHERE id = ?').run(mode, created.id)
      if (mode !== 'live' && created.node_id) this.prepareBeforeFocus({ ...created, focus_presentation: 'quiet' })
      this.enableOnlyBlockRules(input.blockedProcessNames)
      this.taskList.promote(input.taskId)
      this.recordEvent('focus_started', {
        minimumMinutes: input.minimumMinutes,
        blockerCount: input.blockedProcessNames.length,
        expedition: Boolean(input.nodeId)
      })
    })
    transaction()
    return this.getSnapshot()
  }

  private settledPausedSeconds(row: Row, at: string): number {
    return Number(row.paused_seconds) + (row.suspended_at
      ? Math.max(0, (Date.parse(at) - Date.parse(String(row.suspended_at))) / 1000) : 0)
  }

  private setPause(sessionId: string, source: 'manual' | 'system', paused: boolean): void {
    this.db.transaction(() => {
      const row = this.db.prepare('SELECT * FROM sessions WHERE id = ? AND ended_at IS NULL').get(sessionId) as Row | undefined
      if (!row) throw new Error('找不到進行中的專注。')
      if (row.before_focus) return // The presentation clock is not the focus clock.
      const manual = source === 'manual' ? paused : Boolean(row.manual_paused)
      const system = source === 'system' ? paused : Boolean(row.system_paused)
      const at = nowIso()
      // Persist any milestone earned BEFORE the pause, in the same transaction.
      if (paused && !row.suspended_at) this.processActiveSpecialFinds(at)
      const suspendedAt = manual || system ? row.suspended_at ?? at : null
      const pausedSeconds = suspendedAt ? Number(row.paused_seconds) : this.settledPausedSeconds(row, at)
      this.db.prepare(`UPDATE sessions SET manual_paused = ?, system_paused = ?, suspended_at = ?, paused_seconds = ? WHERE id = ?`)
        .run(Number(manual), Number(system), suspendedAt, pausedSeconds, sessionId)
    })()
  }

  pauseFocus(sessionId: string): AppSnapshot {
    this.setPause(sessionId, 'manual', true)
    return this.getSnapshot()
  }

  resumeFocus(sessionId: string): AppSnapshot {
    this.setPause(sessionId, 'manual', false)
    return this.getSnapshot()
  }

  suspendActiveSession(): void {
    const row = this.db.prepare('SELECT id FROM sessions WHERE ended_at IS NULL LIMIT 1').get() as Row | undefined
    if (row) this.setPause(String(row.id), 'system', true)
  }

  resumeActiveSession(): void {
    const row = this.db.prepare('SELECT id FROM sessions WHERE ended_at IS NULL LIMIT 1').get() as Row | undefined
    if (row) this.setPause(String(row.id), 'system', false)
  }

  // The main process calls this while Focus runs. The database clock, rather than
  // rendered lamp animations, decides which milestones have actually been reached.
  processActiveSpecialFinds(at = nowIso()): boolean {
    const session = this.db.prepare(`
      SELECT sessions.*, expedition_nodes.progress_seconds, expedition_nodes.title AS location_title,
             expedition_nodes.state AS node_state
      FROM sessions JOIN expedition_nodes ON expedition_nodes.id = sessions.node_id
      WHERE sessions.ended_at IS NULL LIMIT 1
    `).get() as Row | undefined
    if (!session || session.suspended_at || session.node_state !== 'active' || !session.planned_minutes) return false
    const seconds = effectiveSeconds(String(session.started_at), at, Number(session.paused_seconds))
    return this.db.transaction(() => {
      const rewardsChanged = this.rollDueSpecialFinds(session, seconds)
      const nurseryChanged = this.advanceNurseryScene(session, seconds)
      const sceneChanged = this.advanceMossScene(session, seconds) || this.advanceLakeScene(session, seconds)
      const storyChanged = this.syncCloudStoryClues(session, seconds) || this.syncMossStoryClues(session)
      const lakeStoryChanged = this.syncLakeStoryClues(session)
      this.recordFocusLamps(session, seconds)
      return rewardsChanged || sceneChanged || storyChanged || lakeStoryChanged || nurseryChanged
    })()
  }

  private rollDueSpecialFinds(session: Row, sessionSeconds: number): boolean {
    // Sub-five-minute sessions do not add durable Area progress or awards.
    if (sessionSeconds < 5 * 60) return false
    const plannedMinutes = Number(session.planned_minutes) as 25 | 50 | 90
    const due = dueLampCount(Number(session.progress_seconds) + sessionSeconds, plannedMinutes)
    const plan = this.forestPlan(String(session.node_id))
    const mapId = String(plan.map_id)
    const coreKey = specialFindsForMap(mapId).find(find => find.kind === 'token')!.itemKey
    let acquired = false
    for (let lamp = 1; lamp <= due; lamp += 1) {
      for (const kind of ['journey', 'core'] as const) {
        if (kind === 'journey' && lamp !== Number(plan.journey_lamp)) continue
        const existing = this.db.prepare('SELECT 1 FROM forest_reward_rolls WHERE node_id = ? AND lamp_index = ? AND reward_kind = ?')
          .get(session.node_id, lamp, kind)
        if (existing) continue
        // A legacy roll is final, including a miss. Never use an upgrade to reroll it.
        const legacy = this.db.prepare('SELECT 1 FROM special_find_rolls WHERE node_id = ? AND lamp_index = ?').get(session.node_id, lamp)
        if (legacy) continue
        let item: string | null = null
        if (kind === 'journey') item = String(plan.journey_item)
        else {
          if (this.db.prepare('SELECT 1 FROM map_cores WHERE map_id = ?').get(mapId)) continue
          if (lamp === plan.guaranteed_lamp || Math.random() < SPECIAL_FIND_CHANCE_PER_LAMP) item = coreKey
        }
        if(item){const find=ALL_SPECIAL_FINDS.find(f=>f.itemKey===item)!;this.saveFocusEvent(session,find.eventId,kind==='core'?'core':'item',lamp*plannedMinutes*60/5)}
        const at = nowIso()
        this.db.prepare(`INSERT INTO forest_reward_rolls
          (id, run_id, node_id, session_id, location_title, lamp_index, item_key, rolled_at, reward_kind)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(randomUUID(), session.run_id, session.node_id, session.id, session.location_title, lamp, item, at, kind)
        if (item === coreKey) {
          this.db.prepare('INSERT INTO map_cores (map_id, item_key, acquired_at) VALUES (?, ?, ?)').run(mapId, item, at)
          this.db.prepare('UPDATE forest_explorations SET guaranteed_lamp = NULL WHERE map_id = ?').run(mapId)
        }
        if (item) {
          acquired = true
          this.recordEvent('special_find_acquired', { lampIndex: lamp, token: kind === 'core' })
        }
      }
    }
    // Full exploration counts as soon as the effective clock reaches the target,
    // even if the player keeps focusing. Historical 25/90-minute visits are not pity credit.
    if (due === 5 && plannedMinutes === 50) {
      this.db.prepare('UPDATE forest_explorations SET completed_at = ? WHERE node_id = ? AND completed_at IS NULL')
        .run(nowIso(), session.node_id)
    }
    return acquired
  }

  incrementBlockedAttempt(): void {
    this.db.prepare(`UPDATE sessions SET blocked_attempts = blocked_attempts + 1 WHERE ended_at IS NULL`).run()
    this.recordEvent('blocker_triggered', { count: 1 })
  }

  beginSessionDebrief(sessionId: string): AppSnapshot {
    const existingPending = this.db.prepare('SELECT session_id FROM pending_debriefs WHERE session_id = ?').get(sessionId)
    if (existingPending) return this.getSnapshot()
    const alreadyResolved = this.db.prepare('SELECT ended_at, resolution_applied FROM sessions WHERE id = ?').get(sessionId) as Row | undefined
    if (alreadyResolved?.ended_at && Number(alreadyResolved.resolution_applied)) return this.getSnapshot()

    const transaction = this.db.transaction(() => {
      const row = this.db.prepare(`
        SELECT sessions.*, tasks.role AS task_role
        FROM sessions JOIN tasks ON tasks.id = sessions.task_id
        WHERE sessions.id = ? AND sessions.ended_at IS NULL
      `).get(sessionId) as Row | undefined
      if (!row) throw new Error('找不到進行中的專注。')
      if (!row.run_id || !row.node_id || !row.planned_minutes) throw new Error('這不是遠征專注。')

      const node = this.db.prepare(`SELECT * FROM expedition_nodes WHERE id = ? AND run_id = ?`).get(row.node_id, row.run_id) as Row | undefined
      if (!node || node.state !== 'active') throw new Error('遠征節點狀態不正確。')
      const run = this.db.prepare("SELECT * FROM daily_runs WHERE id = ? AND status = 'active'").get(row.run_id) as Row | undefined
      if (!run || String(run.selected_node_id) !== String(row.node_id)) throw new Error('這條路不屬於目前的遠征。')

      const endedAt = nowIso()
      const pausedSeconds = this.settledPausedSeconds(row, endedAt)
      const seconds = effectiveSeconds(String(row.started_at), endedAt, pausedSeconds)
      this.rollDueSpecialFinds({ ...row, progress_seconds: node.progress_seconds, location_title: node.title }, seconds)
      this.advanceMossScene({ ...row, progress_seconds: node.progress_seconds }, seconds)
      this.advanceLakeScene({ ...row, progress_seconds: node.progress_seconds }, seconds)
      this.advanceNurseryScene({ ...row, progress_seconds: node.progress_seconds }, seconds)
      this.syncCloudStoryClues({ ...row, progress_seconds: node.progress_seconds }, seconds, true)
      this.syncMossStoryClues({ ...row, progress_seconds: node.progress_seconds }, true)
      this.syncLakeStoryClues({ ...row, progress_seconds: node.progress_seconds }, true)
      this.recordFocusLamps({ ...row, progress_seconds: node.progress_seconds }, seconds)
      const daily = this.db.prepare(`SELECT COALESCE(SUM(earned_light), 0) AS total FROM sessions WHERE local_day = ?`).get(row.local_day) as Row
      const earnedLight = calculateLight(seconds, Number(row.minimum_minutes), Number(daily.total))
      const resolution = resolveExpeditionProgress(
        Number(node.progress_seconds),
        seconds,
        Number(row.planned_minutes) as 25 | 50 | 90
      )

      this.db.prepare(`
        UPDATE sessions SET ended_at = ?, earned_light = ?, paused_seconds = ?, suspended_at = NULL,
          manual_paused = 0, system_paused = 0, resolution_applied = 1
        WHERE id = ? AND ended_at IS NULL
      `).run(endedAt, earnedLight, pausedSeconds, sessionId)

      const current = this.db.prepare('SELECT focus_seconds FROM rpg_state WHERE id = 1').get() as Row
      this.db.prepare('UPDATE rpg_state SET focus_seconds = ?, light = light + ? WHERE id = 1')
        .run(Number(current.focus_seconds) + seconds, earnedLight)

      if (resolution.resolution === 'full') {
        const eventKey = eventForNode(Number(run.seed), String(node.id))
        const forest = this.db.prepare('SELECT journey_item FROM forest_explorations WHERE node_id = ?').get(node.id) as Row | undefined
        const rewardOptions = forest ? [] : relicOptionsForNode(Number(run.seed), String(node.id))
        this.db.prepare(`
          UPDATE expedition_nodes
          SET state = ?, progress_seconds = ?, event_key = ?, reward_options = ?, selected_relic_key = ?
          WHERE id = ? AND state = 'active'
        `).run(forest ? 'awaiting_route' : 'awaiting_reward', resolution.progressSeconds, eventKey, JSON.stringify(rewardOptions), forest?.journey_item ?? null, node.id)
        this.insertGeneratedRoutes(String(run.id), Number(run.seed), Number(node.depth) + 1, String(node.id))
      } else {
        const nextState = resolution.resolution === 'partial' || Number(node.progress_seconds) > 0 ? 'partial' : 'selected'
        this.db.prepare('UPDATE expedition_nodes SET state = ?, progress_seconds = ? WHERE id = ? AND state = ?')
          .run(nextState, resolution.progressSeconds, node.id, 'active')
      }

      this.db.prepare(`
        INSERT INTO pending_debriefs
        (session_id, run_id, node_id, resolution, effective_seconds, progress_seconds, threshold_seconds,
         outcome, complete_task, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
      `).run(
        sessionId, row.run_id, row.node_id, resolution.resolution, seconds,
        resolution.progressSeconds, resolution.thresholdSeconds, endedAt
      )
      this.recordEvent('expedition_session_resolved', {
        effectiveSeconds: seconds,
        full: resolution.resolution === 'full',
        partial: resolution.resolution === 'partial',
        tooShort: resolution.resolution === 'too_short'
      })
    })
    transaction()
    return this.getSnapshot()
  }

  private resultForEndedSession(row: Row, expeditionResolution: FocusResult['expeditionResolution'] = null): FocusResult {
    const seconds = row.ended_at
      ? effectiveSeconds(String(row.started_at), String(row.ended_at), Number(row.paused_seconds))
      : 0
    const rpg = this.db.prepare('SELECT focus_seconds FROM rpg_state WHERE id = 1').get() as Row
    const sessionRow = this.db.prepare(`
      SELECT sessions.*, tasks.title AS task_title, steps.text AS step_text
      FROM sessions JOIN tasks ON tasks.id = sessions.task_id JOIN steps ON steps.id = sessions.step_id
      WHERE sessions.id = ?
    `).get(row.id) as Row
    return {
      session: this.sessionFromRow(sessionRow),
      effectiveSeconds: seconds,
      totalFocusSeconds: Number(rpg.focus_seconds),
      worldStageAdvanced: false,
      earnedLight: Number(row.earned_light),
      earnedStarPage: false,
      earnedMaterial: false,
      loot: null,
      storyAdvanced: false,
      expeditionResolution
    }
  }

  endFocus(input: EndFocusInput): FocusResult {
    let row = this.db.prepare(`
      SELECT sessions.*, tasks.role AS task_role
      FROM sessions JOIN tasks ON tasks.id = sessions.task_id
      WHERE sessions.id = ?
    `).get(input.sessionId) as Row | undefined
    if (!row) throw new Error('找不到這次專注。')

    if (row.run_id && !row.ended_at) {
      this.beginSessionDebrief(input.sessionId)
      row = this.db.prepare(`
        SELECT sessions.*, tasks.role AS task_role
        FROM sessions JOIN tasks ON tasks.id = sessions.task_id WHERE sessions.id = ?
      `).get(input.sessionId) as Row
    }

    if (row.outcome) {
      const pending = this.db.prepare('SELECT resolution FROM pending_debriefs WHERE session_id = ?').get(input.sessionId) as Row | undefined
      return this.resultForEndedSession(row, pending ? pending.resolution as FocusResult['expeditionResolution'] : null)
    }

    if (row.run_id) {
      const pending = this.db.prepare('SELECT * FROM pending_debriefs WHERE session_id = ?').get(input.sessionId) as Row | undefined
      if (!pending) throw new Error('找不到這次遠征的結算資料。')
      const timestamp = nowIso()
      const transaction = this.db.transaction(() => {
        this.db.prepare('UPDATE sessions SET outcome = ? WHERE id = ? AND outcome IS NULL').run(input.outcome, input.sessionId)
        this.db.prepare('UPDATE pending_debriefs SET outcome = ?, complete_task = ? WHERE session_id = ?')
          .run(input.outcome, Number(input.completeTask), input.sessionId)
        if (input.completeTask) {
          this.db.prepare("UPDATE steps SET status = 'done' WHERE task_id = ?").run(row!.task_id)
          this.db.prepare("UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?").run(timestamp, row!.task_id)
        } else {
          this.taskList.promote(String(row!.task_id))
        }
        this.recordEvent('focus_ended', {
          effectiveSeconds: Number(pending.effective_seconds),
          completedOutcome: input.outcome === 'completed',
          completeTask: input.completeTask,
          blocked: input.outcome === 'blocked',
          expedition: true
        })
      })
      transaction()
      const updated = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(input.sessionId) as Row
      return this.resultForEndedSession(updated, pending.resolution as FocusResult['expeditionResolution'])
    }

    if (row.ended_at || Number(row.resolution_applied)) return this.resultForEndedSession(row)

    const endedAt = nowIso()
    const pausedSeconds = this.settledPausedSeconds(row, endedAt)
    const seconds = effectiveSeconds(String(row.started_at), endedAt, pausedSeconds)
    const daily = this.db.prepare(`SELECT COALESCE(SUM(earned_light), 0) AS total FROM sessions WHERE local_day = ?`).get(row.local_day) as Row
    const earnedLight = calculateLight(seconds, Number(row.minimum_minutes), Number(daily.total))
    let totalFocusSeconds = 0
    let worldStageAdvanced = false

    const transaction = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE sessions SET ended_at = ?, outcome = ?, earned_light = ?, paused_seconds = ?, suspended_at = NULL,
          manual_paused = 0, system_paused = 0, resolution_applied = 1
        WHERE id = ? AND ended_at IS NULL AND resolution_applied = 0
      `).run(endedAt, input.outcome, earnedLight, pausedSeconds, input.sessionId)
      if (input.completeTask) {
        this.db.prepare("UPDATE steps SET status = 'done' WHERE task_id = ?").run(row!.task_id)
        this.db.prepare("UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?").run(endedAt, row!.task_id)
      } else {
        this.taskList.promote(String(row!.task_id))
      }
      const current = this.db.prepare('SELECT * FROM rpg_state WHERE id = 1').get() as Row
      totalFocusSeconds = Number(current.focus_seconds) + seconds
      worldStageAdvanced = worldStageIndex(totalFocusSeconds) > worldStageIndex(Number(current.focus_seconds))
      // Work completion is independent of gameplay rewards, including ordinary Focus.
      this.db.prepare('UPDATE rpg_state SET focus_seconds = ?, light = light + ? WHERE id = 1')
        .run(totalFocusSeconds, earnedLight)
      this.recordEvent('focus_ended', {
        effectiveSeconds: seconds,
        minimumReached: seconds >= Number(row!.minimum_minutes) * 60,
        completedOutcome: input.outcome === 'completed',
        completeTask: input.completeTask,
        blocked: input.outcome === 'blocked',
        earnedLight,
        expedition: false
      })
    })
    transaction()

    const sessionRow = this.db.prepare(`
      SELECT sessions.*, tasks.title AS task_title, steps.text AS step_text
      FROM sessions JOIN tasks ON tasks.id = sessions.task_id JOIN steps ON steps.id = sessions.step_id
      WHERE sessions.id = ?
    `).get(input.sessionId) as Row
    return {
      session: this.sessionFromRow(sessionRow),
      effectiveSeconds: seconds,
      totalFocusSeconds,
      worldStageAdvanced,
      earnedLight,
      earnedStarPage: false,
      earnedMaterial: false,
      loot: null,
      storyAdvanced: false,
      expeditionResolution: null
    }
  }

  chooseRunRelic(runId: string, nodeId: string, relicKey: string): AppSnapshot {
    const transaction = this.db.transaction(() => {
      const node = this.db.prepare('SELECT * FROM expedition_nodes WHERE id = ? AND run_id = ?').get(nodeId, runId) as Row | undefined
      if (!node) throw new Error('這個節點不屬於目前的遠征。')
      if (node.selected_relic_key) {
        if (String(node.selected_relic_key) === relicKey) return
        throw new Error('這個節點已經選過帶走的物件。')
      }
      if (node.state !== 'awaiting_reward') throw new Error('現在還不能選擇物件。')
      const pending = this.db.prepare('SELECT * FROM pending_debriefs WHERE run_id = ? AND node_id = ?').get(runId, nodeId) as Row | undefined
      const answered = pending?.outcome || this.db.prepare('SELECT 1 FROM sessions WHERE run_id = ? AND node_id = ? AND ended_at IS NOT NULL AND outcome IS NOT NULL AND resolution_applied = 1 ORDER BY ended_at DESC LIMIT 1').get(runId, nodeId)
      if (!answered || (pending && !pending.outcome)) throw new Error('請先完成這段工作的回顧。')
      const options = jsonStrings(node.reward_options)
      if (!options.includes(relicKey)) throw new Error('這件物件不在本次可選項目中。')
      this.db.prepare('INSERT INTO run_relics (id, run_id, node_id, relic_key, acquired_at) VALUES (?, ?, ?, ?, ?)')
        .run(randomUUID(), runId, nodeId, relicKey, nowIso())
      this.db.prepare("UPDATE expedition_nodes SET selected_relic_key = ?, state = 'awaiting_route' WHERE id = ?")
        .run(relicKey, nodeId)
      this.recordEvent('run_relic_chosen', { depth: Number(node.depth) })
    })
    transaction()
    return this.getSnapshot()
  }

  chooseNextRoute(runId: string, fromNodeId: string, nextNodeId: string): AppSnapshot {
    const transaction = this.db.transaction(() => {
      const run = this.db.prepare("SELECT * FROM daily_runs WHERE id = ? AND status = 'active'").get(runId) as Row | undefined
      if (!run) throw new Error('找不到目前的遠征。')
      if (this.currentRun()?.id !== runId) throw new Error('這不是目前的旅程。')
      if (this.db.prepare('SELECT 1 FROM sessions WHERE ended_at IS NULL').get()) throw new Error('專注進行中時不能選擇下一條路。')
      const fromNode = this.db.prepare('SELECT * FROM expedition_nodes WHERE id = ? AND run_id = ?').get(fromNodeId, runId) as Row | undefined
      if (!fromNode) throw new Error('起點不屬於目前的遠征。')
      if (fromNode.state === 'cleared' && String(run.selected_node_id) === nextNodeId) return
      const review = this.db.prepare('SELECT outcome FROM pending_debriefs WHERE run_id = ? AND node_id = ?').get(runId, fromNodeId) as Row | undefined
      if (review && !review.outcome) throw new Error('請先完成這段工作的回顧。')
      if (fromNode.state !== 'awaiting_route' || !fromNode.selected_relic_key) throw new Error('必須先選一件物件，才能決定下一條路。')
      const nextNode = this.db.prepare(`
        SELECT * FROM expedition_nodes WHERE id = ? AND run_id = ? AND parent_node_id = ?
      `).get(nextNodeId, runId, fromNodeId) as Row | undefined
      if (!nextNode || nextNode.state !== 'available') throw new Error('這不是目前可以前往的下一條路。')
      this.db.prepare("UPDATE expedition_nodes SET state = 'cleared' WHERE id = ? AND state = 'awaiting_route'").run(fromNodeId)
      this.db.prepare("UPDATE expedition_nodes SET state = 'selected' WHERE id = ? AND state = 'available'").run(nextNodeId)
      this.db.prepare('UPDATE daily_runs SET selected_node_id = ?, depth = ? WHERE id = ?')
        .run(nextNodeId, Number(nextNode.depth), runId)
      this.db.prepare('DELETE FROM pending_debriefs WHERE run_id = ? AND node_id = ?').run(runId, fromNodeId)
      this.recordEvent('next_route_chosen', { depth: Number(nextNode.depth), plannedMinutes: Number(nextNode.planned_minutes) })
    })
    transaction()
    return this.getSnapshot()
  }

  dismissDebrief(sessionId: string): AppSnapshot {
    const transaction = this.db.transaction(() => {
      const pending = this.db.prepare('SELECT * FROM pending_debriefs WHERE session_id = ?').get(sessionId) as Row | undefined
      if (!pending) return
      if (!pending.outcome) throw new Error('請先完成這段工作的回顧。')
      // Full maps return to the lobby too. Their persistent node state keeps legacy
      // reward choices / next routes pending; dismissing never chooses or awards anything.
      this.db.prepare('DELETE FROM pending_debriefs WHERE session_id = ?').run(sessionId)
    })
    transaction()
    return this.getSnapshot()
  }

  saveBlockRules(apps: RunningApplication[]): AppSnapshot {
    const transaction = this.db.transaction(() => {
      this.db.prepare('UPDATE block_rules SET enabled = 0').run()
      const statement = this.db.prepare(`
        INSERT INTO block_rules (id, process_name, display_name, enabled, created_at)
        VALUES (@id, @processName, @displayName, 1, @createdAt)
        ON CONFLICT(process_name) DO UPDATE SET display_name = excluded.display_name, enabled = 1
      `)
      for (const app of apps) {
        statement.run({ id: randomUUID(), processName: app.processName.toLowerCase(), displayName: app.displayName, createdAt: nowIso() })
      }
    })
    transaction()
    return this.getSnapshot()
  }

  private enableOnlyBlockRules(processNames: string[]): void {
    const normalized = new Set(processNames.map((name) => name.toLowerCase()))
    const rows = this.db.prepare('SELECT process_name FROM block_rules').all() as Row[]
    const statement = this.db.prepare('UPDATE block_rules SET enabled = ? WHERE process_name = ?')
    const transaction = this.db.transaction(() => {
      for (const row of rows) statement.run(Number(normalized.has(String(row.process_name).toLowerCase())), row.process_name)
    })
    transaction()
  }

  updateSettings(patch: Partial<AppSettings>): AppSnapshot {
    const current = this.getSnapshot().settings
    const next = { ...current, ...patch }
    if (next.focusPresentation !== undefined && !['quiet', 'live'].includes(next.focusPresentation)) throw new Error('無效的專注演出模式。')
    for (const volume of [next.environmentVolume, next.musicVolume]) {
      if (!Number.isFinite(volume) || volume < 0 || volume > 100) throw new Error('音量請設定在 0 到 100 之間。')
    }
    this.db.prepare(`
      UPDATE settings SET reminder_policy = @reminderPolicy, evening_reminder = @eveningReminder,
      mini_timer = @miniTimer, phone_ritual = @phoneRitual, coat_color = @coatColor, lantern_color = @lanternColor,
      environment_volume = @environmentVolume, music_volume = @musicVolume, audio_muted = @audioMuted, focus_presentation = @focusPresentation
      WHERE id = 1
    `).run({ ...next, miniTimer: Number(next.miniTimer), phoneRitual: Number(next.phoneRitual), audioMuted: Number(next.audioMuted) })
    return this.getSnapshot()
  }

  makeRpgChoice(choice: RpgChoice): AppSnapshot {
    const row = this.db.prepare('SELECT light FROM rpg_state WHERE id = 1').get() as Row
    if (Number(row.light) < 1) throw new Error('至少需要一點燈火才能修復檔案館。')
    this.db.prepare('UPDATE rpg_state SET light = light - 1, ability = ? WHERE id = 1').run(choice)
    this.recordEvent('rpg_choice', { restore: choice === 'restore', illuminate: choice === 'illuminate', catalogue: choice === 'catalogue' })
    return this.getSnapshot()
  }

  completeRestoration(projectKey: string): AppSnapshot {
    if (projectKey !== 'restore_astrolabe') throw new Error('找不到這項修復計畫。')
    const archive = this.archiveState()
    if (archive.restoration.completedAt) return this.getSnapshot()
    if (!archive.restoration.canComplete) throw new Error('修復條件還沒有全部滿足。')
    this.db.prepare('INSERT INTO restoration_projects (project_key, completed_at) VALUES (?, ?)')
      .run(projectKey, nowIso())
    this.recordEvent('restoration_completed', { requirementCount: archive.restoration.requirements.length })
    return this.getSnapshot()
  }

  private recordEvent(name: string, numericPayload: Record<string, number | boolean>): void {
    this.db.prepare('INSERT INTO events (id, name, created_at, numeric_payload) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), name, nowIso(), JSON.stringify(numericPayload))
  }

  exportBackup(): BackupPayload {
    const tables = [
      'focus_event_records', 'tasks', 'steps', 'daily_runs', 'expedition_nodes', 'run_relics', 'sessions', 'special_find_rolls',
      'pending_debriefs', 'block_rules', 'rpg_state', 'settings', 'events', 'restoration_projects',
      'forest_explorations', 'forest_reward_rolls', 'map_cores', 'world_marks', 'task_routines', 'lobby_find_reads', 'area_scene_states', 'map_world_state',
      'collection_clues', 'collection_state', 'collection_core_presentations', 'collection_pages'
    ]
    const data: Record<string, unknown[]> = {}
    for (const table of tables) data[table] = this.db.prepare(`SELECT * FROM ${table}`).all()
    return { format: 'focusquest-backup', version: 14, exportedAt: nowIso(), data }
  }

  importBackup(payload: BackupPayload): void {
    if (payload.format !== 'focusquest-backup' || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].includes(payload.version) || !payload.data) {
      throw new Error('這不是有效的 Focus Quest 備份。')
    }
    // SQLite accepts arbitrary TEXT, including invalid scene JSON. Validate it
    // before the replacing transaction, so a bad import cannot brick the save.
    const jsonFields: Record<string, Record<string, 'object' | 'strings' | 'history'>> = {
      focus_event_records: { payload: 'object' }, sessions: { before_focus: 'object' },
      area_scene_states: { state_json: 'object' }, map_world_state: { state_json: 'object' },
      forest_explorations: { story_records: 'strings', ambient_history: 'history' },
      expedition_nodes: { reward_options: 'strings' }
    }
    for (const [table, fields] of Object.entries(jsonFields)) {
      const rows = payload.data[table]
      if (!Array.isArray(rows)) continue // Required tables are checked inside the transaction.
      for (const row of rows) for (const [field, kind] of Object.entries(fields)) {
        const raw = (row as Row)[field]
        if (raw === undefined || raw === null) continue // Legacy defaults and nullable options.
        try {
          const value = JSON.parse(String(raw)) as unknown
          const valid = kind === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
            : Array.isArray(value) && (kind === 'strings' ? value.every(v => typeof v === 'string')
              : value.every(v => v && typeof v === 'object' && typeof v.id === 'string' && typeof v.at === 'number' && Number.isFinite(v.at) && v.at >= 0))
          if (!valid) throw new Error('Invalid JSON shape')
        } catch { throw new Error(`備份中的 ${table}.${field} 無法讀取，原有存檔未變更。`) }
      }
    }
    for(const row of payload.data.focus_event_records??[]) {
      const r=row as Row,e=JSON.parse(String(r.payload))
      if(!validFocusEvent(e)||e.id!==r.id||e.sessionId!==r.session_id||e.nodeId!==r.node_id||e.eventId!==r.event_id||e.runId!==r.run_id)throw new Error('備份中的事件紀錄無效，原有存檔未變更。')
    }
    for(const row of payload.data.sessions??[]) {
      const r=row as Row
      if(r.focus_presentation!==undefined&&!['quiet','live'].includes(String(r.focus_presentation)))throw new Error('備份中的專注模式無效。')
      if(r.before_focus){const before=JSON.parse(String(r.before_focus)) as BeforeFocus
        if(!Number.isFinite(Date.parse(before.startedAt))||!Array.isArray(before.queue)||!before.queue.every(e=>validFocusEvent(e)&&e.sessionId===r.id&&e.phase==='before')||!Array.isArray(before.startedIds)||!before.startedIds.every(id=>before.queue.some(e=>e.id===id)))throw new Error('備份中的計時前故事無效。')}
    }
    for(const row of payload.data.settings??[])if((row as Row).focus_presentation!==undefined&&!['quiet','live'].includes(String((row as Row).focus_presentation)))throw new Error('備份中的專注模式無效。')
    const tableColumns: Record<string, string[]> = {
      focus_event_records: ['id', 'session_id', 'run_id', 'node_id', 'event_id', 'payload'],
      area_scene_states: ['node_id', 'state_json'],
      map_world_state: ['map_id', 'state_json'],
      lobby_find_reads: ['acquisition_id', 'seen_at'],
      task_routines: ['id', 'title', 'weekdays', 'enabled', 'position', 'created_at', 'updated_at'],
      forest_explorations: ['node_id', 'map_id', 'journey_item', 'journey_lamp', 'guaranteed_lamp', 'completed_at', 'created_at', 'requested_item', 'story_records', 'ambient_history'],
      forest_reward_rolls: ['id', 'run_id', 'node_id', 'session_id', 'location_title', 'lamp_index', 'item_key', 'rolled_at', 'reward_kind'],
      map_cores: ['map_id', 'item_key', 'acquired_at'],
      world_marks: ['map_id', 'mark', 'seen_at'],
      collection_clues: ['id', 'kind', 'source_id', 'place_id', 'source_label', 'text', 'acquired_at', 'pinned_at'],
      collection_state: ['id', 'tracking_place_id', 'linkage_played_at'],
      collection_core_presentations: ['map_id', 'presented_at'],
      collection_pages: ['place_id', 'acquired_at'],
      tasks: ['id', 'title', 'role', 'kind', 'progress_definition', 'starter_action', 'obstacle', 'deadline', 'cue_type', 'cue_value', 'scheduled_date', 'status', 'created_at', 'updated_at', 'list_position', 'routine_id', 'routine_day', 'deleted_at', 'parked_at'],
      steps: ['id', 'task_id', 'text', 'position', 'status'],
      daily_runs: ['id', 'local_day', 'main_task_id', 'seed', 'status', 'depth', 'selected_node_id', 'started_at', 'ended_at'],
      expedition_nodes: ['id', 'area_id', 'run_id', 'parent_node_id', 'departure_exit_id', 'depth', 'distance', 'type', 'title', 'description', 'environment_hint', 'planned_minutes', 'state', 'progress_seconds', 'event_key', 'reward_options', 'selected_relic_key', 'created_at'],
      run_relics: ['id', 'run_id', 'node_id', 'relic_key', 'acquired_at'],
      sessions: ['id', 'task_id', 'step_id', 'started_at', 'ended_at', 'minimum_minutes', 'paused_seconds', 'suspended_at', 'manual_paused', 'system_paused', 'outcome', 'blocked_attempts', 'earned_light', 'local_day', 'run_id', 'node_id', 'planned_minutes', 'resolution_applied', 'focus_presentation', 'before_focus', 'before_focus_completed'],
      special_find_rolls: ['id', 'run_id', 'node_id', 'session_id', 'location_title', 'lamp_index', 'item_key', 'rolled_at'],
      pending_debriefs: ['session_id', 'run_id', 'node_id', 'resolution', 'effective_seconds', 'progress_seconds', 'threshold_seconds', 'outcome', 'complete_task', 'created_at'],
      block_rules: ['id', 'process_name', 'display_name', 'enabled', 'created_at'],
      rpg_state: ['id', 'chapter', 'node', 'focus_seconds', 'light', 'star_pages', 'materials', 'ability', 'last_loot'],
      settings: ['id', 'reminder_policy', 'evening_reminder', 'mini_timer', 'phone_ritual', 'coat_color', 'lantern_color', 'environment_volume', 'music_volume', 'audio_muted', 'focus_presentation'],
      events: ['id', 'name', 'created_at', 'numeric_payload'],
      restoration_projects: ['project_key', 'completed_at']
    }
    const transaction = this.db.transaction(() => {
      for (const table of [
        'focus_event_records', 'collection_core_presentations', 'collection_pages', 'collection_clues', 'collection_state',
        'area_scene_states', 'map_world_state', 'lobby_find_reads',
        'forest_explorations', 'forest_reward_rolls', 'map_cores', 'world_marks', 'task_routines',
        'pending_debriefs', 'special_find_rolls', 'run_relics', 'expedition_nodes', 'daily_runs', 'events', 'restoration_projects',
        'sessions', 'steps', 'tasks', 'block_rules', 'rpg_state', 'settings'
      ]) this.db.prepare(`DELETE FROM ${table}`).run()
      for (const [table, columns] of Object.entries(tableColumns)) {
        const optionalCollectionTable = payload.version < 10 && ['collection_clues', 'collection_state', 'collection_core_presentations', 'collection_pages'].includes(table)
        const optionalMossTable = payload.version < 9 && ['area_scene_states', 'map_world_state'].includes(table)
        const optionalTaskListTable = (table === 'task_routines' && payload.version < 7) || (table === 'lobby_find_reads' && payload.version < 8)
        const optionalForestTable = payload.version < 6 && ['forest_explorations', 'forest_reward_rolls', 'map_cores', 'world_marks'].includes(table)
        const optionalLegacyTable = table === 'restoration_projects' && payload.version < 3
        const optionalSpecialFindTable = table === 'special_find_rolls' && payload.version < 4
        const optionalExpeditionTable = payload.version === 1 && ['daily_runs', 'expedition_nodes', 'run_relics', 'pending_debriefs'].includes(table)
        const rows = payload.data[table] ?? ((table === 'focus_event_records' && payload.version < 14) || optionalCollectionTable || optionalMossTable || optionalTaskListTable || optionalForestTable || optionalLegacyTable || optionalSpecialFindTable || optionalExpeditionTable ? [] : undefined)
        if (!Array.isArray(rows)) throw new Error(`備份缺少 ${table} 資料。`)
        const placeholders = columns.map((column) => `@${column}`).join(', ')
        const insert = this.db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`)
        for (const row of rows) {
          const values = table === 'tasks'
            ? { starter_action: null, list_position: null, routine_id: null, routine_day: null, deleted_at: null, parked_at: null, ...(row as Row) }
            : table === 'settings'
              ? { focus_presentation: 'quiet', environment_volume: 35, music_volume: 12, audio_muted: 0, ...(row as Row) }
            : table === 'rpg_state'
              ? { focus_seconds: 0, ...(row as Row) }
              : table === 'forest_explorations'
                ? { requested_item: null, story_records: '[]', ambient_history: '[]', ...(row as Row) }
              : table === 'expedition_nodes'
                ? { area_id: FOREST_MAP_ID, departure_exit_id: null, ...(row as Row) }
              : table === 'sessions'
                ? {
                    focus_presentation: 'quiet', before_focus: null, before_focus_completed: 0,
                    run_id: null,
                    node_id: null,
                    planned_minutes: null,
                    manual_paused: 0,
                    system_paused: (row as Row).suspended_at && !(row as Row).ended_at ? 1 : 0,
                    resolution_applied: (row as Row).ended_at ? 1 : 0,
                    ...(row as Row)
                  }
                : row as Row
          insert.run(values)
        }
      }
      if (payload.version < 12) this.migrateCloudStoryRecords()
      this.backfillDepartureExits()
      this.backfillForestCore()
      this.db.prepare('INSERT OR IGNORE INTO collection_state (id, tracking_place_id, linkage_played_at) VALUES (1, NULL, NULL)').run()
      this.taskList.backfillPositions()
      this.taskList.backfillParkedAt()
      this.taskList.validateStoredRoutines()
      this.recoverMossFindPresentation()
    })
    transaction()
  }

  analyticsCsv(): string {
    const rows = this.db.prepare('SELECT name, created_at, numeric_payload FROM events ORDER BY created_at').all() as Row[]
    const header = 'event,created_at,numeric_payload'
    const body = rows.map((row) => {
      const payload = String(row.numeric_payload).replaceAll('"', '""')
      return `"${String(row.name)}","${String(row.created_at)}","${payload}"`
    })
    return [header, ...body].join('\r\n')
  }
}

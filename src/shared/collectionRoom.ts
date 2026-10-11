import lakeScene from '../../docs/area03/area-03-reflection-lake.scene.json'
import nurseryScene from '../../docs/area07/area-07-glass-nursery.scene.json'
export type CollectionClueKind = 'way' | 'look' | 'note'

export interface CollectionClueDefinition {
  id: string
  kind: CollectionClueKind
  sourceId: string
  placeId: string | null
  sourceLabel: string
  text: string
  comparison?: string
}

export interface CollectionClueRecord extends CollectionClueDefinition {
  acquiredAt: string
  pinnedAt: string | null
}

export interface HiddenPlaceDefinition {
  id: string
  title: string
  requiredItems: readonly [string, string]
  bearingClueIds: readonly [string, string]
  lookClueId: string
}

export interface CollectionRoomState {
  clues: CollectionClueRecord[]
  trackingPlaceId: string | null
  presentedCoreMapIds: string[]
  linkagePlayed: boolean
  visitedMapIds: string[]
  completedJourneys: number
  hiddenPlaces: Array<{ id: string; located: boolean; revealed: boolean; pageFound: boolean }>
  explorationItemChoices: Array<{ nodeId: string; itemKey: string | null }>
}

export const COLLECTION_CLUES: readonly CollectionClueDefinition[] = [
  ...Object.entries(nurseryScene.clues).map(([id,text])=>({id,text,kind:'note' as const,sourceId:'m07',placeId:null,sourceLabel:'玻璃苗圃 · '+({m07_tray:'空苗盤',m07_chart:'生長記錄板',m07_glass:'玻璃手印',m07_planted:'種下幼苗',m07_transplant:'照料者支線結局'}[id]??'筆記')})),
  ...lakeScene.clues.map(c=>({id:c.id,kind:'note' as const,sourceId:'m03',placeId:null,sourceLabel:c.source,text:c.text})),
  { id: 'n_first', kind: 'note', sourceId: 'm01', placeId: null, sourceLabel: '第一次專注的紀錄', text: '筆記第一頁的大樹，就是雲上遺庭那一棵。' },
  { id: 'c01_first_tree', kind: 'note', sourceId: 'm01', placeId: null, sourceLabel: '雲上遺庭 · 石拱橋頭', text: '筆記第一頁畫的大樹，就是雲上遺庭中央這一棵。' },
  { id: 'c01_bark_date', kind: 'note', sourceId: 'm01', placeId: null, sourceLabel: '雲上遺庭 · 大樹', text: '樹皮上刻著一個日期，刻痕看起來比這棵樹還老。' },
  { id: 'c01_stele_scale', kind: 'note', sourceId: 'm01', placeId: null, sourceLabel: '雲上遺庭 · 索引石碑', text: '索引石碑的邊緣有一排很細的刻度，不像是量長度用的。' },
  { id: 'c01_rubbing', kind: 'note', sourceId: 'm01', placeId: null, sourceLabel: '雲上遺庭 · 索引石碑', text: '碑上被磨掉的那一行，拓出來是「燈點完再走」。' },
  { id: 'c01_tag', kind: 'note', sourceId: 'm01', placeId: null, sourceLabel: '雲上遺庭 · 大樹', text: '樹枝上綁著一塊栽培牌：「第一年，別讓它長太快。」' },
  { id: 'h1a', kind: 'way', sourceId: 'm01', placeId: 'h1', sourceLabel: '雲上遺庭 · 古井（第二次造訪）', text: '井底的倒影裡有一串燈。井邊明明沒有燈。' },
  { id: 'm02_open', kind: 'note', sourceId: 'm02', placeId: null, sourceLabel: '苔痕驛站 · 第一盞燈（第一次專注）', text: '筆記第一頁的「從這裡開始。」，也刻在苔痕驛站第一盞燈的燈柱上。' },
  { id: 'h1b', kind: 'way', sourceId: 'm02', placeId: 'h1', sourceLabel: '苔痕驛站 · 霧瀑小舟（首訪）', text: '溪尾漂來一盞熄掉的提燈，順著霧瀑落進霧裡。下游好像還有更多。' },
  { id: 'h1c', kind: 'look', sourceId: 'm02', placeId: 'h1', sourceLabel: '苔痕驛站 · 住宿簿（第二次造訪）', text: '住宿簿夾著一張畫：半沉在水裡的提燈，角落寫著「灣」。' },
  { id: 'n_tag', kind: 'note', sourceId: 'm02', placeId: null, sourceLabel: '苔痕驛站 · 行李推車（舊荷札）', text: '舊荷札上的編號，和風切斷橋橋頭寄物櫃的編號是同一種寫法。' },
  { id: 'n_rub', kind: 'note', sourceId: 'm02', placeId: null, sourceLabel: '苔痕驛站 · 舊道標（炭印紙）', text: '拓出來的不是字，是一排高低不同的刻痕，像在記錄聲音。' },
  { id: 'c02', kind: 'note', sourceId: 'm02', placeId: null, sourceLabel: '苔痕驛站 · 遺失物抽屜', text: '空抽屜裡又多了一張行李牌：「燈點完再走。」和羅盤背面刻的字一樣。' },
  { id: 'c08', kind: 'note', sourceId: 'm02', placeId: null, sourceLabel: '苔痕驛站 · 住宿簿', text: '住宿簿上，你住過的那一晚已經有人寫好了，日期和日記裡的一樣。' },
  { id: 'm02_wick', kind: 'note', sourceId: 'm02', placeId: null, sourceLabel: '苔痕驛站 · 溪尾棧橋（帶著舊燈芯）', text: '漂來的熄燈裡，燈芯的編法和舊燈芯一樣。' },
  { id: 'm02_lens', kind: 'note', sourceId: 'm02', placeId: null, sourceLabel: '苔痕驛站 · 柴堆後（帶著風化鏡片）', text: '透過風化鏡片，霧那一頭的山頂上有一座塔。' },
  { id: 'm02_sign', kind: 'note', sourceId: 'm02', placeId: null, sourceLabel: '苔痕驛站 · 站名牌（帶著炭印紙）', text: '站名牌上被磨掉的字，拓出來是「苔痕」兩個字，後面還有字，拓不出來。' },
  { id: 'm02_sapling', kind: 'note', sourceId: 'm02', placeId: null, sourceLabel: '苔痕驛站 · 石地藏（帶著護根布）', text: '地藏小杯裡長出一株幼苗，根先用布包好，它沒有枯。' },
  { id: 'h2a', kind: 'way', sourceId: 'm04', placeId: 'h2', sourceLabel: '風切斷橋 · 維修紀錄', text: '維修紀錄最後一頁：「往風吹來的那邊，有人的火熄了。」' },
  { id: 'h2b', kind: 'way', sourceId: 'm10', placeId: 'h2', sourceLabel: '折光觀測台 · 鏡架', text: '鏡架對準的方向，霧裡有一塊不反光的黑點。' },
  { id: 'h2c', kind: 'look', sourceId: 'm05', placeId: 'h2', sourceLabel: '回聲採石場 · 共鳴洞', text: '岩壁裡的聲音說：「……柴都濕了。」後面只剩風聲。' },
  { id: 'h3a', kind: 'way', sourceId: 'h1', placeId: 'h3', sourceLabel: '缺頁一的背面', text: '背面畫著一個箭頭，指向營火的左手邊。' },
  { id: 'h3b', kind: 'way', sourceId: 'h2', placeId: 'h3', sourceLabel: '缺頁二的角落', text: '角落寫著：「路線是在火邊寫的。」' },
  { id: 'h3c', kind: 'look', sourceId: 'm08', placeId: 'h3', sourceLabel: '無聲書庫 · 空白書脊', text: '一整排空白書脊中，只有一本寫著「路線」，裡面是空的。' }
]

export const HIDDEN_PLACES: readonly HiddenPlaceDefinition[] = [
  { id: 'h1', title: '沉燈灣', requiredItems: ['old_wick', 'old_luggage_tag'], bearingClueIds: ['h1a', 'h1b'], lookClueId: 'h1c' },
  { id: 'h2', title: '冷營地', requiredItems: ['copper_wind_whistle', 'incomplete_star_chart'], bearingClueIds: ['h2a', 'h2b'], lookClueId: 'h2c' },
  { id: 'h3', title: '留白書桌', requiredItems: ['overwrite_ink', 'unsealed_letter'], bearingClueIds: ['h3a', 'h3b'], lookClueId: 'h3c' }
]

export const MAP_JOURNEY_ITEMS: Record<string, readonly [string, string]> = {
  'area-01-cloud-ruins': ['old_wick', 'weathered_lens'],
  'area-02-moss-station': ['old_luggage_tag', 'charcoal_rubbing'],
  'area-03-reflection-lake': ['tide_gauge_plate', 'silvered_shard'],
  'area-07-glass-nursery': ['pressed_leaf','mulch_cloth']
}

export const JOURNEY_ITEM_LABELS: Record<string, string> = {
  pressed_leaf:'壓葉標本', mulch_cloth:'護根布',
  tide_gauge_plate: '水位刻片', silvered_shard: '背銀鏡片',
  old_wick: '舊燈芯', weathered_lens: '風化鏡片', old_luggage_tag: '舊荷札', charcoal_rubbing: '炭印紙',
  copper_wind_whistle: '銅製風哨', incomplete_star_chart: '殘缺星圖', overwrite_ink: '覆寫墨水', unsealed_letter: '未封口的信'
}

export const CORE_UNDERSTANDING_CLUES: Record<string, string> = {
  'area-01-cloud-ruins': 'h2b',
  'area-02-moss-station': 'c02',
  'area-03-reflection-lake': 'c03',
  'area-07-glass-nursery': 'c01_bark_date',
  'area-10-refraction-observatory': 'c01_stele_scale'
}

export const CLOUD_CLUE_COMPARISONS: Record<string, { mapId: string; text: string }> = {
  c01_bark_date: { mapId: 'area-07-glass-nursery', text: '和種莢的採集日期是同一天。' },
  c01_stele_scale: { mapId: 'area-10-refraction-observatory', text: '和歸途目鏡上的刻度是同一套。' },
  c01_rubbing: { mapId: 'area-02-moss-station', text: '和羅盤背面刻的字一樣。' }
}

export function hiddenPlaceProgress(pinnedIds: ReadonlySet<string>, pageIds: ReadonlySet<string> = new Set()): CollectionRoomState['hiddenPlaces'] {
  return HIDDEN_PLACES.map((place) => ({
    id: place.id,
    located: place.bearingClueIds.every((id) => pinnedIds.has(id)),
    revealed: place.bearingClueIds.every((id) => pinnedIds.has(id)) && pinnedIds.has(place.lookClueId),
    pageFound: pageIds.has(place.id)
  }))
}

"""Snapshot authored event data without changing any source or player state."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
FILES = {
    '01 雲上遺庭': 'docs/area-01-cloud-ruins.scene.json',
    '02 苔痕驛站': 'docs/area-02-moss-station.scene.json',
    '03 倒影湖畔': 'docs/area03/area-03-reflection-lake.scene.json',
    '07 玻璃苗圃': 'docs/area07/area-07-glass-nursery.scene.json',
    '05 藏聲秋谷（獨立試玩／草案）': 'docs/area05/area-05-echo-quarry.scene.json',
}
FIELDS = ['events', 'anywhereEvents', 'restActivities', 'storyEvents', 'ambient', 'specialFinds']
snapshot = {}
lines = ['# 場景事件完整目錄', '',
         '2026-10-11 由目前五份場景資料逐筆擷取。原始資料完整保留在 event-catalog.json；此表不是正式已播放清單。01 的新增故事不在 scene JSON，另依 cloudStory.ts 與故事設計列在 02-story-reveals.md。05 的 echoVisit／山風規則另由設計與試玩邏輯控制。', '',
         '每張表區分事件原欄位、條件與結果；純演出不因列入本表就變成永久線索。沒有欄位不表示無條件，仍需對照正式 eligibility／排程。', '']

def text(value):
    if value is None:
        return '—'
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    return str(value).replace('|', '\\|').replace('\n', '；')

for title, rel in FILES.items():
    data = json.loads((ROOT / rel).read_text(encoding='utf-8-sig'))
    extracted = {field: data[field] for field in FIELDS if field in data}
    # Non-event containers are retained separately for environment narrative auditing.
    extracted['extraRules'] = {key: data[key] for key in ['echoVisit','wind','weather','worldMarks','caretakerState','rest'] if key in data}
    if title.startswith('05'):
        extracted['interactionSpots'] = data.get('spots', {})
    snapshot[title] = {'source': rel, 'data': extracted}
    lines += [f'## {title}', '', f'來源：`{rel}`。', '']
    for field in FIELDS:
        if field not in data:
            continue
        entries = data[field]
        if isinstance(entries, dict):
            entries = [dict(value, id=key) if isinstance(value, dict) else {'id':key,'description':value} for key, value in entries.items()]
        lines += [f'### {field}（{len(entries)} 筆）', '',
                  '| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |',
                  '| --- | --- | --- | --- |']
        for e in entries:
            if not isinstance(e, dict):
                e = {'id':str(e),'description':'設定引用；不是獨立事件'}
            name = next((e[k] for k in ['name','label','description','status','visual','pose','anim'] if e.get(k) is not None), '見原資料')
            conditions = {k:e[k] for k in ['requires','when','rule','condition','weather','tide','carry','once','rare','tier','kind','type'] if k in e}
            outcomes = {k:e[k] for k in ['clue','clueOnce','clueText','note','card','item','itemKey','outcome','worldMark','worldMarkRule','tagGain','rewards'] if k in e}
            lines.append(f"| {text(e.get('id','無獨立 ID'))} | {text(name)} | {text(conditions) if conditions else '由正式調度判斷／見原資料'} | {text(outcomes) if outcomes else '未列永久結果；見原資料與正式程式'} |")
        lines.append('')
    lines += ['其他環境與世界記憶規則見 JSON 快照的 `extraRules`；敘事知識、伏筆與回收分析見故事揭露表。', '']
    if title.startswith('05'):
        spots = data.get('spots', {})
        if isinstance(spots,dict):
            spots = [dict(v,id=k) if isinstance(v,dict) else {'id':k,'description':v} for k,v in spots.items()]
        lines += ['### 一般互動點／動作（不是新增獎勵事件）','','| ID | 完整動作資料 |','| --- | --- |']
        for spot in spots:
            if isinstance(spot,dict):
                lines.append(f"| {text(spot.get('id',spot.get('index','見資料')))} | {text(spot)} |")
            else:
                lines.append(f'| 見資料 | {text(spot)} |')
        lines.append('')
HERE.joinpath('event-catalog.json').write_text(json.dumps(snapshot, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
HERE.joinpath('event-catalog.md').write_text('\n'.join(lines)+'\n', encoding='utf-8')
print(json.dumps({title:{k:len(v) for k,v in s['data'].items() if k in FIELDS} for title,s in snapshot.items()}, ensure_ascii=False))

"""Build the listening catalogue and portable clip-editing asset pack."""
from pathlib import Path
import json, html, zipfile
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'previews/area03-audio-qa'
r=json.loads((OUT/'report.json').read_text(encoding='utf-8'))
labels={'a-low-day':'退潮白天','b-rising':'漲潮中（30 秒濃縮）','c-high-mirror':'滿潮鏡面','d-falling':'退潮中','e-night':'夜裡','f-mirror-discovery':'取得湖鏡（不含旋律）','g-actions':'腳步與細節音示範','h-pitch-candidates':'單音與核心旋律候選（獨立放大試聽）'}
rows=[]
for name,info in r['assets'].items():
    rows.append(f'<article><h3>{html.escape(name)}</h3><p>原檔 → 停 1 秒 → 修正版。原檔只在這份對照調整音量；比較音色與接縫時請留意長度變化。</p><audio controls preload="none" src="comparisons/{name}-AB.wav"></audio><p><a href="../../../audio-incoming/{name}.wav">未處理原檔</a> · <a download href="assets/{name}.wav">修正版單檔</a></p></article>')
mixrows=[f'<article><h3>{label}</h3><audio controls preload="none" src="mixes/{name}.wav"></audio><p><a download href="mixes/{name}.wav">下載 WAV</a></p></article>' for name,label in labels.items()]
page='''<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>倒影湖畔音效試聽</title><style>body{background:#141b20;color:#e9eee8;font:16px/1.7 system-ui;margin:0 auto;max-width:960px;padding:32px}h1,h2{font-weight:550}a{color:#a6d6de}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}article{padding:18px;background:#202b31;border-radius:12px}h3{font-size:17px;margin:0 0 10px;overflow-wrap:anywhere}audio{width:100%}p{color:#bac5c6;font-size:14px}header p{font-size:16px}</style><header><h1>倒影湖畔音效試聽</h1><p>這次只處理素材，尚未接進遊戲。先聽環境與動作示範，再比較個別音檔。所有聲音都來自你提供的錄音，原始檔未改動。</p><p>環境示範使用 35% 音量；音準候選另行放大方便聽。候選旋律由原檔片段移調重排，音色改變較大，需聽過再決定。</p><p><a download href="area03-editing-assets.zip">下載剪輯用單檔包（28 個 WAV）</a> · <a href="README.md">說明</a></p></header><h2>情境試聽</h2><section>'''+''.join(mixrows)+'''</section><h2>原檔／修正版對照</h2><p>每份 A/B 前半是原檔（僅匹配音量），後半是修正版，中間停 1 秒。若要原始大小的音量，請選「未處理原檔」。循環素材約 20–23 秒，聽接縫也可用上方 30 秒混音。</p><section>'''+''.join(rows)+'''</section><script>document.addEventListener('play',e=>{if(e.target.tagName==='AUDIO')document.querySelectorAll('audio').forEach(a=>{if(a!==e.target)a.pause()})},true)</script></html>'''
(OUT/'index.html').write_text(page,encoding='utf-8')
readme='''# 倒影湖畔音效試聽（2026-10-03）

本輪只做素材與試聽，不接進遊戲。原始檔位於 repo 外 audio-incoming，28 個 SHA256 前後相符。所有修正均基於原錄音，沒有其他聲音來源或從零合成。

打開 index.html 可逐一試聽；一次播放一份。mixes/ 是情境混音；assets/ 是 48kHz／16-bit／立體聲剪輯用單檔；comparisons/ 每份先播原錄音（僅匹配響度）、停 1 秒、再播修正版。report.json 記錄增益、裁切、濾波、音準與來源雜湊。

## 情境

'''+ '\n'.join(f'- {name}.wav：{label}，{r["mixes"][name]["seconds"]:g} 秒' for name,label in labels.items())+'''

## 聽感重點

- 水拍起伏已用僅衰減的包絡壓平；漲潮裁掉原檔 24 秒附近的突兀事件。各循環以 2 秒接合淡化製成 20–23 秒的可重複單檔，混音中的層起點錯開。沒有新增聲音來填空隙。
- 風是主體；水拍與漲退潮次之。滿潮的風降至 60%、水拍 2.5%，示範保留較安靜的鏡面。夜間蟲聲提高增益，是否底噪仍可接受請聽過判断。
- 涉水、泥地等各版本分別匹配活動段響度，主要撞擊對齊至約 0.08 秒。部分前奏裁掉或補靜音，詳細操作在報告。拱橋 a 的雙擊／b 的單擊結構保留。
- 四個原檔削波只對飽和取樣做線性插值並降低增益；不能還原已失去的波形，不聲稱完全恢復原聲。
- 倒茶從三段原錄音移除安靜空隙，60ms 交叉淡化後約 1.58 秒，仍保留原來水流起伏。沒有把它硬拉成 3 秒連續水流；若聽起來仍斷續，建議重選來源。
- D4 單音候選抽取原檔主要玻璃共鳴並移調約 -12.84 半音；核心候選以原檔共鳴片段移調，排列 G4→C5→D5→G5（0／0.7／1.4／2.5 秒）。這兩個是改動較大的候選，音色可能與原檔不同，音準量測符合不等於聽感已接受。湖鏡情境示範不疊這段旋律。
- h-pitch-candidates 是方便辨識的放大獨立試聽，不代表遊戲內最終音樂音量。

## 驗證

28 個單檔、28 個 A/B、8 個情境輸出。原檔雜湊未變；輸出峰值低於 -3dBFS、無無效取樣；循環接縫跳變在一般相鄰取樣差的範圍；動作示範最多一個前景事件，未超出三個預算。音準候選的頻譜主峰接近指定音，但未聲稱所有非諧波共鳴已消失，也未聲稱使用者聽感驗收通過。沒有修改 App、存檔或安裝版，仍為 0.6.23。
'''
readme=readme.replace('判断','判斷')
(OUT/'README.md').write_text(readme,encoding='utf-8')
with zipfile.ZipFile(OUT/'area03-editing-assets.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted((OUT/'assets').glob('*.wav')): z.write(p,'assets/'+p.name)
    for name in ['README.md','report.json']: z.write(OUT/name,name)
print(json.dumps({'catalogue':str(OUT/'index.html'),'archiveBytes':(OUT/'area03-editing-assets.zip').stat().st_size,'mixes':len(labels),'assets':len(rows)}))

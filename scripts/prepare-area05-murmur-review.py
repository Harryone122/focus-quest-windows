"""Raise only the accepted murmur stem; keep the original auditions/recordings."""
from pathlib import Path
import sys,json,hashlib,wave,math,subprocess,re
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'previews/area03-audio-qa/.processing-deps'))
import numpy as np
PRE=ROOT/'previews/area05-audio-qa';OUT=PRE/'murmur-review';OUT.mkdir(exist_ok=True)
FF=ROOT.parent/'showcase-video/d7/tools/ffmpeg.exe';SR=48000
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):
    with wave.open(str(p),'rb') as f:
        assert (f.getframerate(),f.getnchannels(),f.getsampwidth())==(SR,2,2)
        return np.frombuffer(f.readframes(f.getnframes()),'<i2').reshape(-1,2)/32768.
def write(p,x):
    assert np.max(np.abs(x))<10**(-1/20)
    with wave.open(str(p),'wb') as f:f.setparams((2,2,SR,0,'NONE','not compressed'));f.writeframes(np.rint(x*32767).astype('<i2').tobytes())
def stats(p):
    log=subprocess.run([str(FF),'-hide_banner','-nostats','-i',str(p),'-af','ebur128=peak=true','-f','null','-'],capture_output=True,check=True).stderr.decode('utf8','replace').rsplit('Summary:',1)[-1]
    return {'integratedLufs':float(re.search(r'I:\s*([-\d.]+) LUFS',log).group(1)),'truePeakDbtp':float(re.search(r'Peak:\s*([-\d.]+) dBFS',log).group(1))}
stem=PRE/'assets/a05_wall_murmur.wav';before={str(p):sha(p) for p in [stem,PRE/'09-12.wav',PRE/'09-25.wav']}
x=read(stem);report={'status':'awaiting-user-listening','environmentSliderPercent':35,'murmurStartsAt':4,'baselineFilesUnchanged':False,'candidates':{},'sourceHashes':before}
approval=json.loads((ROOT/'docs/area05/AUDIO_ACCEPTANCE.json').read_text(encoding='utf8'))
selected=approval.get('murmurGainDb') if approval.get('approved') else None
if selected in [6,9]:report.update(status='user-approved',selectedGainDb=selected,approvalSource=approval['murmurApprovalSource'])
for extra in [6,9]:
    volume=10**(extra/20)
    processed=OUT/f'a05_wall_murmur-plus{extra}.wav';write(processed,x*volume)
    report['candidates'][str(extra)]={'gainDb':extra,'amplitudeMultiplier':volume,'processedAsset':processed.name,'assetSha256':sha(processed),**stats(processed),'mixes':{}}
    for percent in [12,25]:
        y=read(PRE/f'09-{percent}.wav');at=4*SR
        y[at:at+len(x)]+=x*(volume-1)*(.35**1.4)
        dest=OUT/f'09-{percent}-plus{extra}.wav';write(dest,y)
        info=stats(dest);assert info['truePeakDbtp']<=-1
        report['candidates'][str(extra)]['mixes'][str(percent)]={'file':dest.name,'sha256':sha(dest),**info}
assert all(sha(Path(p))==h for p,h in before.items());report['baselineFilesUnchanged']=True
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
index=PRE/'index.html';s=index.read_text(encoding='utf8')
start='<!-- murmur-review-start -->';end='<!-- murmur-review-end -->'
if start in s:s=s[:s.index(start)]+s[s.index(end)+len(end):]
# Reset the main item to baseline before selecting the approved revision, so reruns are stable.
s=re.sub(r'(src|href)="murmur-review/09-(12|25)-plus(?:6|9)\.wav"',r'\1="09-\2.wav"',s)
if selected in [6,9]:
    for percent in [12,25]:s=s.replace(f'="09-{percent}.wav"',f'="murmur-review/09-{percent}-plus{selected}.wav"')
cards=''.join(f'<label>{label}<audio controls preload="none" src="{src}"></audio></label>' for label,src in [('原版（保留對照）','09-25.wav'),('低喃 +6 dB','murmur-review/09-25-plus6.wav'),('低喃 +9 dB','murmur-review/09-25-plus9.wav')])
status=f'使用者已選定 +{selected} dB；場景與第 9 項採用這一版。' if selected in [6,9] else '新版尚待確認，場景暫用原版。'
block=start+'<section id="murmur-review"><h2>低喃音量調整｜新版比較</h2><p>背景音 25%、環境音 35% 都維持不變，只提高第 4 秒開始的低喃。原版／+6 dB／+9 dB 可直接比較；不會同時播放。'+status+'</p><div class="pair">'+cards+'</div></section>'+end
s=s.replace('<h1>削波重點：原音與處理後</h1>',block+'<h1>削波重點：原音與處理後</h1>')
index.write_text(s,encoding='utf8')
print('Murmur-only +6/+9 dB candidates prepared. All accepted baseline WAVs unchanged.')

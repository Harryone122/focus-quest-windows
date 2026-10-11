from pathlib import Path
import subprocess, json, re, hashlib, sys
ROOT=Path(__file__).resolve().parents[1]
D7=ROOT.parent/'showcase-video/d7';FF=D7/'tools/ffmpeg.exe'
def run(args):
 return subprocess.run([str(FF),'-hide_banner',*args],capture_output=True,text=True,encoding='utf8',errors='replace',check=True)
def check(path):
 log=run(['-i',str(path),'-map','0:v:0','-c','copy','-f','hash','-']).stdout.strip()
 meta=run(['-i',str(path),'-af','loudnorm=I=-24:TP=-2:LRA=11:print_format=json','-f','null','-']).stderr
 duration=re.search(r'Duration: ([\d:.]+)',meta).group(1)
 n=run(['-i',str(path),'-map','0:v:0','-c','copy','-f','framehash','-']).stdout
 frames=[line for line in n.splitlines() if not line.startswith('#') and line.strip()]
 audio=json.loads(re.search(r'\{\s*"input_i".*?\}',meta,re.S).group())
 return {'videoHash':log,'duration':duration,'frames':len(frames),'frameTimestampsHash':hashlib.sha256(n.encode()).hexdigest(),'audioTruePeakDb':float(audio['input_tp'])}
original=check(D7/'FocusQuest_D7_玻璃苗圃.mp4')
report={'original':original,'variants':{}}
reduced='--leaves60' in sys.argv
names=[f'FocusQuest_D7_玻璃苗圃_bgm_m{delta}'+('_leaves60' if reduced else '')+'.mp4' for delta in [6,10]]
if reduced:names.append('FocusQuest_D7_玻璃苗圃_leaves60.mp4')
for name in names:
 info=check(D7/name)
 assert info['duration']==original['duration']=='00:00:34.00'
 assert info['videoHash']==original['videoHash'] and info['frameTimestampsHash']==original['frameTimestampsHash']
 assert info['frames']==1020 and info['audioTruePeakDb']<0
 report['variants'][name]=info
(D7/('bgm-leaves60-video-verification.json' if reduced else 'bgm-video-verification.json')).write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf8')
print(json.dumps(report,ensure_ascii=False))

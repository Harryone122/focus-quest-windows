"""Reproducible cuts and D7 mixes, using only the supplied recordings and ffmpeg."""
from pathlib import Path
import subprocess, json, re, hashlib, wave, math, sys
ROOT = Path(__file__).resolve().parents[1]
D7 = ROOT.parent / 'showcase-video/d7'
FF = D7 / 'tools/ffmpeg.exe'
SRC = ROOT.parent / 'audio-incoming/nursery_bgm.wav'
OUT = ROOT / 'src/renderer/src/glassNursery/audio'
PRE = ROOT / 'previews/nursery-audio-qa'
def run(args):
    return subprocess.run([str(FF), '-hide_banner', *args], capture_output=True, text=True, encoding='utf8', errors='replace', check=True).stderr
def loudness(path, filters='anull'):
    log = run(['-i', str(path), '-af', filters+',loudnorm=I=-24:TP=-2:LRA=11:print_format=json', '-f', 'null', '-'])
    return json.loads(re.search(r'\{\s*"input_i".*?\}', log, re.S).group())
def stats(path):
    with wave.open(str(path), 'rb') as f:
        import array
        x=array.array('h', f.readframes(f.getnframes()))
        return {'seconds':f.getnframes()/f.getframerate(), 'peakDb':20*math.log10(max(abs(v) for v in x)/32768), 'clippedSamples':sum(abs(v)>=32767 for v in x)}
report={'sourceSha256':hashlib.sha256(SRC.read_bytes()).hexdigest(), 'targetLufs':-24, 'cuts':{}, 'mixes':{}}
for name,start,end,fi,fo in [('a',0,59.2,2,3),('b',58.9,92,.3,1.5),('ab',0,92,2,1.5),('c',91.5,130,2,0)]:
    length=end-start
    filters=f'atrim=start={start}:end={end},asetpts=PTS-STARTPTS,afade=t=in:d={fi}'
    if fo: filters+=f',afade=t=out:st={length-fo}:d={fo}'
    measure=loudness(SRC,filters)
    gain=-24-float(measure['input_i'])
    assert float(measure['input_tp'])+gain < -2
    dest=OUT/f'bgm_{name}.wav'
    run(['-y','-i',str(SRC),'-af',filters+f',volume={gain}dB','-ar','48000','-c:a','pcm_s16le',str(dest)])
    report['cuts'][name]={'start':start,'end':end,'gainDb':gain,'lufs':float(loudness(dest)['input_i']),**stats(dest)}
# Produce two actual daytime soundscape auditions at the existing volume curve.
for percent in [12,25]:
    music=(percent/100)**1.4
    env=.35**1.4
    graph=f'[0:a]volume={music}[m];[1:a]volume={env*.4*.6}[l];[2:a]volume={env}[s];[m][l][s]amix=inputs=3:normalize=0,afade=t=out:st=32:d=2[a]'
    run(['-y','-i',str(OUT/'bgm_a.wav'),'-stream_loop','-1','-i',str(OUT/'nursery_leaves_loop.wav'),'-stream_loop','-1','-i',str(OUT/'nursery_spray_loop.wav'),'-filter_complex',graph,'-map','[a]','-t','34','-c:a','pcm_s16le',str(PRE/f'bgm-day-{percent}.wav')])
reduced='--leaves60' in sys.argv
suffix='_leaves60' if reduced else ''
hero=D7/('hero_audio_leaves60.wav' if reduced else 'hero_audio.wav')
bed=PRE/'d7-bgm-bed.wav'
run(['-y','-i',str(OUT/'bgm_a.wav'),'-af','atrim=end=34,asetpts=PTS-STARTPTS,afade=t=in:d=1,afade=t=out:st=32:d=2','-c:a','pcm_s16le',str(bed)])
hero_i=float(loudness(D7/'hero_audio.wav')['input_i']); bed_i=float(loudness(bed)['input_i'])
report['leafLayerGain']=.6
report['heroInput']=str(hero)
report['backgroundGainReference']='original hero; music gain unchanged when reducing leaves'
report['originalVideoSha256']=hashlib.sha256((D7/'FocusQuest_D7_玻璃苗圃.mp4').read_bytes()).hexdigest()
report['originalHeroSha256']=hashlib.sha256((D7/'hero_audio.wav').read_bytes()).hexdigest()
report['heroInputSha256']=hashlib.sha256(hero.read_bytes()).hexdigest()
for delta in [6,10]:
    gain=hero_i-delta-bed_i
    audio=D7/f'hero_audio_bgm_m{delta}{suffix}.wav'
    run(['-y','-i',str(hero),'-i',str(bed),'-filter_complex',f'[1:a]volume={gain}dB[b];[0:a][b]amix=inputs=2:normalize=0[a]','-map','[a]','-t','34','-c:a','pcm_s16le',str(audio)])
    info=stats(audio);assert info['clippedSamples']==0 and info['seconds']==34
    video=D7/f'FocusQuest_D7_玻璃苗圃_bgm_m{delta}{suffix}.mp4'
    # Preserve every original encoded picture and timestamp. Only the audio changes.
    run(['-y','-i',str(D7/'FocusQuest_D7_玻璃苗圃.mp4'),'-i',str(audio),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-t','34','-movflags','+faststart',str(video)])
    report['mixes'][str(delta)]={'heroLufs':hero_i,'bedLufs':bed_i+gain,'bedGainDb':gain,**info,'video':str(video)}
    print('Finished',video.name,flush=True)
if reduced:
    video=D7/'FocusQuest_D7_玻璃苗圃_leaves60.mp4'
    run(['-y','-i',str(D7/'FocusQuest_D7_玻璃苗圃.mp4'),'-i',str(hero),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-t','34','-movflags','+faststart',str(video)])
(PRE/('bgm-leaves60-processing-report.json' if reduced else 'bgm-processing-report.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')

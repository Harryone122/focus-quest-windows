"""Recover the supplied leaf recording's existing phase/filter and reduce only that stem.
The original flattened hero WAV is retained; no new sound source is introduced.
"""
from pathlib import Path
import sys,json,wave
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'previews/area03-audio-qa/.processing-deps'))
import numpy as np
from scipy import signal,optimize
D7=ROOT.parent/'showcase-video/d7';SR=48000
def read(p):
 with wave.open(str(p),'rb') as w:
  assert (w.getframerate(),w.getnchannels(),w.getsampwidth())==(SR,2,2)
  return np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,2)/32768
def write(p,x):
 assert np.max(np.abs(x))<1
 with wave.open(str(p),'wb') as w:
  w.setparams((2,2,SR,0,'NONE','not compressed'));w.writeframes(np.rint(x*32767).astype('<i2').tobytes())
hero=read(D7/'hero_audio.wav')
names=['leaves','turn','spray','drip']
sources=[read(ROOT.parent/f'audio-incoming/nursery_{n}_loop.wav') for n in names]
offsets=[0,2.7,5.4,8.1]
measure=[]
# Fit only intervals where the original supplied ambient recordings explain the mix.
# Unrelated foreground cues remain in the original WAV and are never attenuated.
for t in np.arange(.15,33.91,.25):
 begin=max(0,round((t-.2)*SR));start=round(t*SR);end=min(len(hero),round((t+.12)*SR));idx=np.arange(begin,end);skip=start-begin
 raw=[x[(idx+round(offset*SR))%len(x)] for x,offset in zip(sources,offsets)]
 target=hero[start:end].ravel();norm=np.linalg.norm(target)
 def fit(cutoff):
  columns=[]
  for x in raw:
   z=signal.sosfilt(signal.butter(2,cutoff,fs=SR,output='sos'),x,axis=0);z[4080:]+=z[:-4080]*.12
   columns.append(z[skip:].ravel())
  design=np.stack(columns,axis=1);g=np.linalg.lstsq(design,target,rcond=None)[0]
  return np.linalg.norm(target-design@g)/max(norm,1e-12),g
 result=optimize.minimize_scalar(lambda f:fit(f)[0],bounds=(6500,16500),method='bounded',options={'xatol':.2})
 error,g=fit(result.x)
 measure.append({'t':float(t+.06),'cutoff':float(result.x),'relativeResidual':float(error),'leafGain':float(g[0])})
valid=[m for m in measure if m['relativeResidual']<.025 and m['leafGain']>0]
assert len(valid)>45
times=np.array([m['t'] for m in valid]);cuts=np.array([m['cutoff'] for m in valid]);gains=np.array([m['leafGain'] for m in valid])
# Extend edge measurements to zero and the natural clip-end fade.
gains=np.minimum(gains,float(np.median(gains[(times>1)&(times<4)])))
stable=float(np.median(gains[(times>1)&(times<4)]))
# The flattened recording already has short clip-edge fades. Measure those
# directly rather than replacing them with a different fade shape.
edgeTimes=[];edgeGains=[]
for lo,hi,fc in [(0,.8,7600),(32.65,34,13840)]:
 begin=max(0,round((lo-.2)*SR));end=round(hi*SR);idx=np.arange(begin,end);cols=[]
 for x,offset in zip(sources,offsets):
  z=signal.sosfilt(signal.butter(2,fc,fs=SR,output='sos'),x[(idx+round(offset*SR))%len(x)],axis=0)
  z[4080:]+=z[:-4080]*.12;cols.append(z)
 for t in np.arange(lo,hi,.025):
  a=round(t*SR)-begin;b=min(len(idx),a+1200)
  d=np.stack([c[a:b].ravel() for c in cols],axis=1)
  g=np.linalg.lstsq(d,hero[begin+a:begin+b].ravel(),rcond=None)[0][0]
  edgeTimes.append(t+(b-a)/SR/2);edgeGains.append(float(np.clip(g,0,stable)))
edgeGains=signal.medfilt(edgeGains,5)
keep=(times>=.8)&(times<=32.65)
times=np.r_[times[keep],edgeTimes];gains=np.r_[gains[keep],edgeGains]
order=np.argsort(times);times=times[order];gains=gains[order]
full=np.arange(len(hero))/SR
gain=np.interp(full,np.r_[0,times,34],np.r_[0,gains,0])
cutoff=np.interp(full,[m['t'] for m in valid],cuts)
leaf=sources[0][np.arange(len(hero))%len(sources[0])]
filtered=np.empty_like(leaf);zi=np.zeros((1,2,2));block=240
for i in range(0,len(hero),block):
 sos=signal.butter(2,float(cutoff[i]),fs=SR,output='sos')
 filtered[i:i+block],zi=signal.sosfilt(sos,leaf[i:i+block],axis=0,zi=zi)
stem=filtered*gain[:,None]
stem[4080:]+=stem[:-4080]*.12
reduced=hero-.4*stem
write(D7/'hero_leaves_stem.wav',stem)
write(D7/'hero_audio_leaves60.wav',reduced)
report={'leafLayerGain':.6,'sourcePhaseSeconds':0,'delaySeconds':.085,'delayGain':.12,'fitWindows':len(measure),'acceptedWindows':len(valid),'stableSourceGain':stable,'medianAcceptedRelativeResidual':float(np.median([m['relativeResidual'] for m in valid])),'measurements':measure,'peakDb':float(20*np.log10(np.max(np.abs(reduced)))),'clippedSamples':int(np.sum(np.abs(reduced)>=1))}
(D7/'leaves60-processing-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='measurements'}),flush=True)

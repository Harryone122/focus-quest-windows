"""Process supplied WAVs only; preserve originals and keep the motif preview out of production."""
from pathlib import Path
import sys, wave, json, hashlib
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'previews/area03-audio-qa/.processing-deps'))
import numpy as np
from scipy import signal
import librosa
SR=48000
SRC=ROOT.parent/'audio-incoming'
OUT=ROOT/'src/renderer/src/glassNursery/audio'
PRE=ROOT/'previews/nursery-audio-qa'
OUT.mkdir(parents=True,exist_ok=True); PRE.mkdir(parents=True,exist_ok=True)
def read(p):
 with wave.open(str(p),'rb') as f:
  assert (f.getframerate(),f.getsampwidth(),f.getnchannels())==(SR,2,2)
  return np.frombuffer(f.readframes(f.getnframes()),'<i2').reshape(-1,2)/32768.
def write(p,x):
 assert np.isfinite(x).all() and np.max(np.abs(x))<.71
 with wave.open(str(p),'wb') as f:
  f.setparams((2,2,SR,0,'NONE','not compressed'));f.writeframes(np.rint(x*32767).astype('<i2').tobytes())
report={}
names=[p.stem for p in SRC.glob('nursery_*.wav') if 'night' not in p.stem and p.stem!='nursery_bgm']
names+=['stone_step_dry_'+v for v in 'abc']+['dep_cloth_kneel','dep_cloth_rise','dep_notebook_close']
for name in names:
 x=read(SRC/(name+'.wav'));original=x.copy();clipped=0
 for ch in range(2):
  bad=np.abs(x[:,ch])>=32767/32768;clipped+=int(bad.sum())
  if bad.any():
   good=np.flatnonzero(~bad);x[bad,ch]=np.interp(np.flatnonzero(bad),good,x[good,ch])
 loop=name.endswith('_loop')
 # Dry foreground is centered; environment retains its stereo field.
 if not loop and name!='nursery_birds_day':x=np.repeat(x.mean(axis=1)[:,None],2,axis=1)
 if not loop:
  env=np.sqrt(np.mean(x*x,axis=1));on=np.flatnonzero(env>max(env.max()*.035,.0001))
  trim=max(0,int(on[0])-240) if len(on) else 0;x=x[trim:]
  n=min(240,len(x)//2);x[:n]*=np.linspace(0,1,n)[:,None]
  n=min(2400,len(x)//2);x[-n:]*=np.linspace(1,0,n)[:,None]
 else:trim=0
 env=np.sqrt(np.mean(x*x,axis=1));active=env>env.max()*.06
 rms=np.sqrt(np.mean(x[active]**2)) if active.any() else 1
 target=.028 if loop else .06
 gain=min(target/max(rms,1e-9),.68/max(np.abs(x).max(),1e-9));x*=gain
 write(OUT/(name+'.wav'),x)
 report[name]={'sourceSha256':hashlib.sha256((SRC/(name+'.wav')).read_bytes()).hexdigest(),'clippedInterpolated':clipped,'trimSeconds':trim/SR,'gain':gain,'duration':len(x)/SR}
# Reuse the already accepted item recording from the lake mix.
import shutil
shutil.copyfile(ROOT/'src/renderer/src/reflectionLake/audio/tone_item_d4.wav',OUT/'tone_item_d4.wav')
# Isolate the G4 component, measure it, and pitch shift that original strike.
x=read(SRC/'core_motif_07.wav').mean(axis=1)
x=signal.sosfiltfilt(signal.butter(4,[350,470],btype='bandpass',fs=SR,output='sos'),x)
seg=x[int(.05*SR):int(1.5*SR)];n=2**20
spec=np.abs(np.fft.rfft(seg*np.hanning(len(seg)),n));freq=np.fft.rfftfreq(n,1/SR)
ii=np.flatnonzero((freq>370)&(freq<415));idx=ii[np.argmax(spec[ii])];base=freq[idx]
y=np.zeros(6*SR);pitches=[]
for at,hz in zip([0,.7,1.4,2.5],[391.995436,523.251131,587.329536,783.990872]):
 note=librosa.effects.pitch_shift(x,sr=SR,n_steps=12*np.log2(hz/base))
 length=min(len(note),len(y)-int(at*SR));note=note[:length].copy()
 note[:240]*=np.linspace(0,1,240);note[-2400:]*=np.linspace(1,0,2400)
 y[int(at*SR):int(at*SR)+length]+=note
 s=note[int(.1*SR):int(.7*SR)];a=np.abs(np.fft.rfft(s*np.hanning(len(s)),n));ids=np.flatnonzero((freq>hz*.97)&(freq<hz*1.03));measured=freq[ids[np.argmax(a[ids])]]
 cents=1200*np.log2(measured/hz);assert abs(cents)<10,(hz,cents)
 pitches.append({'at':at,'targetHz':hz,'measuredHz':measured,'cents':cents})
y*=.25/max(np.abs(y).max(),1e-9);write(PRE/'core_motif_07-preview.wav',np.repeat(y[:,None],2,axis=1))
report['motifPreview']={'baseHz':base,'notes':pitches,'production':False}
(PRE/'processing-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('Prepared',len(names)+1,'production assets; motif preview measured within 10 cents.')

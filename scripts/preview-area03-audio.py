"""Preview-only processing of the user's recordings. No app wiring or synthesis."""
from pathlib import Path
import sys, json, hashlib, wave, math
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'previews/area03-audio-qa'
sys.path.insert(0, str(OUT / '.processing-deps'))
import numpy as np
from scipy import signal
import librosa

SRC = ROOT.parent / 'audio-incoming'
SR = 48000
for folder in ['assets', 'comparisons', 'mixes']:
    (OUT / folder).mkdir(parents=True, exist_ok=True)
names = sorted(p.stem for p in SRC.glob('*.wav') if p.stem.startswith('lake_') or p.stem in ['tone_item_d4', 'core_motif_03'])
assert len(names) == 28

def read(p):
    with wave.open(str(p), 'rb') as f:
        assert f.getframerate() == SR and f.getnchannels() == 2 and f.getsampwidth() == 2
        return np.frombuffer(f.readframes(f.getnframes()), '<i2').reshape(-1, 2).astype(float) / 32768

def db(v): return float(20*np.log10(max(float(v), 1e-12)))
def stats(x):
    return dict(seconds=len(x)/SR, rmsDb=db(np.sqrt(np.mean(x*x))), peakDb=db(np.max(np.abs(x))),
                clippedSamples=int(np.sum(np.abs(x)>=32767/32768)), invalid=int(np.sum(~np.isfinite(x))))

def write(p, x):
    assert np.all(np.isfinite(x)) and np.max(np.abs(x)) < .708
    with wave.open(str(p), 'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes(np.rint(x*32767).astype('<i2').tobytes())

def fade(x, attack=.015, release=.05):
    x=x.copy(); a=min(int(attack*SR), len(x)//2); b=min(int(release*SR), len(x)//2)
    if a: x[:a] *= np.linspace(0,1,a)[:,None]
    if b: x[-b:] *= np.linspace(1,0,b)[:,None]
    return x

def filt(x, lo=45, hi=8000):
    return signal.sosfiltfilt(signal.butter(3, [lo,hi], btype='bandpass', fs=SR, output='sos'),x,axis=0)

def declip(x):
    # Interpolate only saturated sample runs. Does not pretend to recover the lost waveform.
    x=x.copy()
    for c in range(2):
        bad=np.abs(x[:,c])>=32767/32768
        if np.any(bad):
            good=np.flatnonzero(~bad); idx=np.flatnonzero(bad)
            x[idx,c]=np.interp(idx,good,x[good,c])
    return x

def calibrate(x, target, active=False):
    if active:
        e=np.sqrt(np.mean(x*x,axis=1)); mask=e>np.max(e)*.06
        rms=np.sqrt(np.mean(x[mask]**2)) if mask.any() else 1e-9
    else: rms=np.sqrt(np.mean(x*x))
    gain=min(target/max(rms,1e-9), .68/max(np.max(np.abs(x)),1e-9))
    return x*gain, float(gain)

def tame(x):
    # Attenuation only: 250ms envelope suppresses big isolated splashes without filling silence.
    block=12000; rms=np.array([np.sqrt(np.mean(x[i:i+block]**2)) for i in range(0,len(x),block)])
    cap=np.percentile(rms,60)*1.45
    g=np.minimum(1,cap/np.maximum(rms,1e-10))
    env=np.interp(np.arange(len(x)),np.arange(len(g))*block+block/2,g)
    env=signal.sosfiltfilt(signal.butter(2, 3, fs=SR, output='sos'),env)
    return x*np.clip(env,0,1)[:,None], float(np.min(env))

def seam(x):
    # Two-second linear crossfade. Output is a circular cycle; no outer fades on loop assets.
    n=2*SR; y=x[n:].copy(); g=np.linspace(0,1,n)[:,None]
    y[-n:]=x[-n:]*(1-g)+x[:n]*g
    return y

def onset(x, original, desired=.08):
    shift=int(round((original-desired)*SR))
    return x[shift:] if shift>=0 else np.pad(x, ((-shift,0),(0,0)))

def dominant(x, low, high):
    y=x.mean(axis=1); n=2**int(np.ceil(np.log2(len(y)*4)))
    a=np.abs(np.fft.rfft(y*np.hanning(len(y)),n)); freq=np.fft.rfftfreq(n,1/SR)
    indices=np.flatnonzero((freq>=low)&(freq<=high)); i=indices[np.argmax(a[indices])]
    # Refine log-spectrum maximum for accurate measured pitch.
    l,m,r=np.log(np.maximum(a[i-1:i+2],1e-20)); delta=.5*(l-r)/(l-2*m+r)
    return float((i+delta)*SR/n)

raw={n:read(SRC/(n+'.wav')) for n in names}
hashes={n:hashlib.sha256((SRC/(n+'.wav')).read_bytes()).hexdigest() for n in names}
assets={}; report={'sampleRate':SR,'source':'user ElevenLabs WAVs; original files untouched', 'assets':{},'mixes':{},'pitch':{}}
main={'lake_wade_step_a':.24,'lake_wade_step_b':.03,'lake_wade_step_c':.07,'lake_wade_step_d':.02,
      'lake_mud_step_a':.03,'lake_mud_step_b':.01,'lake_mud_step_c':.01,'lake_fish_plip_a':.01,'lake_fish_plip_b':.25,
      'lake_egret_takeoff_a':.4,'lake_egret_takeoff_b':.08,'lake_arch_hop_a':.03,'lake_arch_hop_b':.12,
      'lake_cup_flip':.42,'lake_cup_set':.02,'lake_gauge_pry':.96,'lake_mirror_shard':1.0}
loopTargets={'lake_wind_reeds_loop':.022,'lake_lap_loop':.012,'lake_tide_rise_loop':.010,'lake_tide_fall_loop':.010,'lake_night_insects_loop':.004}
for name in names:
    if name in ['tone_item_d4','core_motif_03']: continue
    x=raw[name].copy(); ops=[]
    clipped=stats(x)['clippedSamples']
    if clipped: x=declip(x); ops.append(f'Linear interpolation of {clipped} saturated samples; lost waveform not recoverable')
    hi=5500 if name=='lake_wind_reeds_loop' else 6500 if 'mud_step' in name else 9000
    x=filt(x,45,hi); ops.append(f'45Hz highpass / {hi}Hz lowpass, zero-phase third order')
    if name=='lake_tide_rise_loop':
        x=x[int(.5*SR):int(22.25*SR)]; ops.append('Use 0.5–22.25s, excluding the loud event near 24s')
    if name=='lake_lap_loop':
        x,g=tame(x); ops.append(f'Attenuation-only splash envelope, maximum attenuation {db(g):.2f}dB')
    if name=='lake_tea_pour':
        # Use only actual pour sections, close gaps with 60ms overlaps; shorter asset is intentional.
        pieces=[x[:int(.45*SR)],x[int(1.0*SR):int(1.8*SR)],x[int(2.55*SR):]]
        y=pieces[0]
        for p in pieces[1:]:
            f=int(.06*SR); g=np.linspace(0,1,f)[:,None]
            y=np.concatenate([y[:-f],y[-f:]*(1-g)+p[:f]*g,p[f:]])
        x=y; ops.append('Retain 0–0.45, 1.0–1.8, 2.55–3.0s; close gaps with 60ms crossfades; shortened, not extended')
    if name in main:
        x=onset(x,main[name]); ops.append(f'Align supplied main sound {main[name]:.2f}s to 0.08s; trim/pad prelude')
    if name in loopTargets:
        x=seam(x); ops.append('2s circular linear crossfade, cycle shortened by 2s')
        target=loopTargets[name]
    else:
        x=fade(x,.012,.08)
        target=.02 if 'wade_step' in name else .008 if 'mud_step' in name else .012 if 'fish' in name else .018 if 'egret' in name else .020 if 'arch' in name else .010 if 'cup' in name or 'tea' in name or 'cuff' in name else .028
        if name=='lake_birds_day': target=.010
    x,gain=calibrate(x,target,active=name not in loopTargets)
    assets[name]=x; report['assets'][name]=dict(original=stats(raw[name]),processed=stats(x),gain=gain,targetRms=target,operations=ops,sourceSha256=hashes[name])
    print('processed',name,flush=True)

# Pitch repairs use only filtered fragments of the corresponding original recording.
name='tone_item_d4'; x=filt(raw[name],520,720); measured=dominant(x[int(.15*SR):int(1.8*SR)],560,670)
steps=12*np.log2(293.664768/measured)
x=librosa.effects.pitch_shift(x.T,sr=SR,n_steps=float(steps),res_type='soxr_hq').T
x=fade(x,.025,.20); x,gain=calibrate(x,.016,True); assets[name]=x
hz=dominant(x[int(.15*SR):int(1.8*SR)],270,320)
report['pitch'][name]=dict(sourceDominantHz=measured,semitoneShift=float(steps),processedDominantHz=hz,centsFromTarget=float(1200*np.log2(hz/293.664768)),status='Candidate only: substantial timbre change, other original resonances removed; listening required')
report['assets'][name]=dict(original=stats(raw[name]),processed=stats(x),gain=gain,sourceSha256=hashes[name],operations=['Extract original 520–720Hz dominant glass resonance',f'Pitch shift {steps:.3f} semitones preserving duration','25ms attack / 200ms release; no oscillator or extra source'])
print('processed tone pitch candidate',flush=True)

name='core_motif_03'; src=filt(raw[name],620,1050); hz=dominant(src[int(.3*SR):int(3.5*SR)],730,830)
targets=[391.995436,523.251131,587.329536,783.990872]; starts=[0,.7,1.4,2.5]; durations=[.82,.82,1.22,3.0]
x=np.zeros((int(5.6*SR),2)); notes=[]
for target,start,duration in zip(targets,starts,durations):
    fragment=src[int(.3*SR):int((.3+duration)*SR)]
    shift=float(12*np.log2(target/hz))
    p=librosa.effects.pitch_shift(fragment.T,sr=SR,n_steps=shift,res_type='soxr_hq').T
    p=fade(p,.04,.18 if start<2.5 else .35)
    pos=int(start*SR); x[pos:pos+len(p)]+=p
    check=dominant(p[int(.1*SR):int((duration-.2)*SR)],target*.92,target*1.08)
    notes.append(dict(start=start,duration=duration,targetHz=target,measuredHz=check,cents=float(1200*np.log2(check/target))))
x,gain=calibrate(x,.016,True); assets[name]=x
report['pitch'][name]=dict(sourceDominantHz=hz,notes=notes,status='Candidate only: four shifted fragments from original sustained glass tone, substantial rearrangement; not the original performed phrase')
report['assets'][name]=dict(original=stats(raw[name]),processed=stats(x),gain=gain,sourceSha256=hashes[name],operations=['Extract original 620–1050Hz glass resonance; remove 200Hz low component','Pitch shifted source fragments arranged G4 / C5 / D5 / G5 at 0 / 0.7 / 1.4 / 2.5s','Overlapping natural tails, total 5.6s; no new synthesis'])

# Every processed asset gets both unaltered original and a volume-matched A/B comparison.
for name,x in assets.items():
    write(OUT/'assets'/(name+'.wav'),x)
    a=raw[name]; gain=min(.65/max(np.max(np.abs(a)),1e-9),np.sqrt(np.mean(x*x))/max(np.sqrt(np.mean(a*a)),1e-9))
    ab=np.concatenate([fade(a*gain,.025,.05),np.zeros((SR,2)),fade(x,.025,.05)])
    write(OUT/'comparisons'/(name+'-AB.wav'),ab)
    report['assets'][name]['comparisonOriginalGain']=float(gain)

def loop(name,seconds,offset=0):
    a=assets[name]; idx=(np.arange(int(seconds*SR))+int(offset*SR))%len(a); return a[idx]

def add(y,name,at,gain=.35,offset=0,length=None):
    p=assets[name][int(offset*SR):]; p=p[:int(length*SR)] if length else p
    pos=int(at*SR); n=min(len(p),len(y)-pos)
    if n>0: y[pos:pos+n]+=fade(p[:n],.015,.08)*gain

for mode in ['a-low-day','b-rising','c-high-mirror','d-falling','e-night','f-mirror-discovery','g-actions','h-pitch-candidates']:
    seconds=5 if mode.startswith('f-') else 14 if mode.startswith('h-') else 30
    t=np.arange(int(seconds*SR))/SR; y=np.zeros((len(t),2)); events=[]
    if mode.startswith('h-'):
        add(y,'tone_item_d4',.5,.35); add(y,'core_motif_03',5,.35)
        events=[dict(name='tone_item_d4',at=.5,gain=.35),dict(name='core_motif_03',at=5,gain=.35)]
    else:
        windGain=np.ones(len(t)); lapGain=np.ones(len(t)); bird=True
        if mode.startswith('c-'): windGain*=.6;lapGain*=.025;bird=False
        if mode.startswith('b-'):
            level=np.clip(t/28,0,1);windGain=1-.4*level;lapGain=1-level
            y+=loop('lake_tide_rise_loop',seconds,3)*(.35*np.sin(np.pi*level))[:,None]
        if mode.startswith('d-'):
            level=1-np.clip(t/28,0,1);windGain=1-.4*level;lapGain=1-level
            y+=loop('lake_tide_fall_loop',seconds,7)*(.35*np.sin(np.pi*level))[:,None]
        if mode.startswith('e-'): bird=False;y+=loop('lake_night_insects_loop',seconds,5)*.35
        if mode.startswith('f-'): windGain*=.30;lapGain*=.30;bird=False
        y+=loop('lake_wind_reeds_loop',seconds,1)*(.35*windGain)[:,None]
        y+=loop('lake_lap_loop',seconds,6)*(.35*lapGain)[:,None]
        if bird and not mode.startswith('g-'):
            add(y,'lake_birds_day',3,.35*.7,1,5)
            if seconds>25: add(y,'lake_birds_day',24,.35*.7,16,5)
        if mode.startswith('f-'): add(y,'lake_mirror_rise',0,.35);events=[dict(name='lake_mirror_rise',at=0)]
        if mode.startswith('g-'):
            # Seeded version order without adjacent duplicates; events stay sparse, no more than 3 foreground voices.
            rng=np.random.default_rng(20261003); seq=list(rng.permutation(['a','b','c','d']))
            plan=[('lake_wade_step_'+v,1+i*.85) for i,v in enumerate(seq)]
            plan += [('lake_mud_step_'+v,6+i*.85) for i,v in enumerate(rng.permutation(['a','b','c']))]
            plan += [('lake_cuff_roll',9),('lake_fish_plip_a',11),('lake_fish_plip_b',12.5),('lake_egret_takeoff_a',14),('lake_egret_takeoff_b',16.5),('lake_arch_hop_a',19),('lake_arch_hop_b',20.5),('lake_cup_flip',22),('lake_tea_pour',23),('lake_cup_set',25),('lake_gauge_pry',26),('lake_mirror_shard',28)]
            for n,at in plan: add(y,n,at);events.append(dict(name=n,at=at,end=min(seconds,at+len(assets[n])/SR)))
    y=fade(y,.15,.6);write(OUT/'mixes'/(mode+'.wav'),y)
    report['mixes'][mode]=dict(**stats(y),events=events)

# Same-level dry comparisons avoid mistaking simply louder processing for better processing.
assert all(hashlib.sha256((SRC/(n+'.wav')).read_bytes()).hexdigest()==hashes[n] for n in names)
for name,x in assets.items():
    assert stats(x)['invalid']==0 and stats(x)['peakDb']<=-3
    if name in loopTargets:
        jump=float(np.max(np.abs(x[0]-x[-1])))
        report['assets'][name]['loopBoundaryJumpDb']=db(jump)
        # Wind/insects are noise-like: compare the boundary to normal adjacent samples,
        # not an absolute threshold that would reject ordinary high-frequency energy.
        adjacent99=float(np.percentile(np.abs(np.diff(x,axis=0)),99))
        report['assets'][name]['adjacentDifference99Db']=db(adjacent99)
        assert jump<=max(.002,adjacent99*1.5), (name,jump,adjacent99)
for n,p in report['pitch'].items():
    if 'notes' in p: assert all(abs(a['cents'])<20 for a in p['notes'])
    else: assert abs(p['centsFromTarget'])<20
events=report['mixes']['g-actions']['events']
report['maxForegroundVoices']=int(max(sum(e['at']<=t<e['end'] for e in events) for t in np.arange(0,30,.01)))
assert report['maxForegroundVoices']<=3
report['originalHashesUnchanged']=True
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'assets':len(assets),'mixes':len(report['mixes']),'originalHashesUnchanged':True,'maxForegroundVoices':report['maxForegroundVoices'],'pitch':report['pitch']},ensure_ascii=False),flush=True)

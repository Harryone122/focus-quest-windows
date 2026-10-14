"""Area 05 audition only. No scene imports; all sound comes from supplied recordings.

Python 3.12 + numpy/scipy (the existing lake processing dependencies work).
Run: python scripts/prepare-area05-audio.py [--ffmpeg PATH] [--deps PATH]
Outputs are confined to previews/area05-audio-qa; originals are hash checked.
"""
from pathlib import Path
import argparse, hashlib, html, json, math, os, re, shutil, subprocess, sys, wave

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--ffmpeg', default=str(ROOT.parent/'showcase-video/d7/tools/ffmpeg.exe'))
p.add_argument('--deps', default=str(ROOT/'previews/area03-audio-qa/.processing-deps'))
p.add_argument('--source', default=str(ROOT.parent/'audio-incoming'))
args = p.parse_args()
sys.path.insert(0, args.deps)
import numpy as np
from scipy import signal

SR = 48000
SRC = Path(args.source).resolve()
PRE = ROOT/'previews/area05-audio-qa'
ASSETS = PRE/'assets'
AB = PRE/'comparison'
for d in (PRE, ASSETS, AB): d.mkdir(parents=True, exist_ok=True)
if PRE.resolve().is_relative_to(SRC): raise ValueError('Output must not be inside source')
FF = args.ffmpeg
if not Path(FF).is_file(): FF = shutil.which(FF) or FF
report = {'status':'audition-awaiting-user-approval', 'productionConnected':False,
          'environmentSliderPercent':35, 'musicSliderPercents':[12,25], 'volumeExponent':1.4,
          'sources':{}, 'assets':{}, 'auditions':{}, 'comparisons':{},
          'excluded':['a05_amb_wind','a05_stone_chime_low', 'two unselected whisper recordings'],
          'sourceAttribution':{'generator':'ElevenLabs','generationDate':'user-supplied; exact date unconfirmed',
                               'plan':'unconfirmed; no publication performed'},
          'notes':['No synthesized oscillators, noise, impulse responses or sample-library sounds.',
                   'Reverberation consists only of filtered, delayed copies of each original recording.',
                   'Waterfall calibrated to -36 LUFS then capped below leaves in each mix.',
                   '60s day/night excerpts start music at 25s; excerpt ends before runtime 60-120s segment ends.',
                   'Core preview uses existing scene timeline: swell peak 3.6s, stone packed 7.6s.',
                   'Campfire silhouette preview is the isolated distant bell, without changing or remixing other maps.',
                   'No technical measurement constitutes listening approval.']}

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
source_paths = list(SRC.glob('a05_*.wav')) + list(SRC.glob('[[]whispers[]]*.mp3')) + [SRC/'lake_birds_day.wav']
before = {str(f):sha(f) for f in source_paths}
def ff(args):
    return subprocess.run([str(FF),'-hide_banner','-nostats',*args],capture_output=True,check=True)
def read(path):
    raw = ff(['-i',str(path),'-ar',str(SR),'-ac','2','-f','f32le','-']).stdout
    return np.frombuffer(raw,dtype='<f4').reshape(-1,2).astype(np.float64)
def write(path,x):
    assert np.isfinite(x).all() and np.max(np.abs(x)) < 1, str(path)
    with wave.open(str(path),'wb') as f:
        f.setparams((2,2,SR,0,'NONE','not compressed'))
        f.writeframes(np.rint(x*32767).astype('<i2').tobytes())
def measure(x):
    proc = subprocess.run([str(FF),'-hide_banner','-nostats','-f','f32le','-ar',str(SR),'-ac','2',
                           '-i','-','-af','ebur128=peak=true','-f','null','-'],
                          input=x.astype('<f4').tobytes(),capture_output=True,check=True)
    log = proc.stderr.decode('utf8','replace')
    tail = log.rsplit('Summary:',1)[-1]
    m = re.search(r'I:\s*([-\w.]+) LUFS',tail)
    tp = re.search(r'Peak:\s*([-\w.]+) dBFS',tail)
    moments = [float(v) for v in re.findall(r'\bM:\s*([-\d.]+)', log)]
    return {'integratedLufs':float(m.group(1)), 'maxMomentaryLufs':max(moments),
            'truePeakDbtp':float(tp.group(1)), 'peakDbfs':20*math.log10(max(np.max(np.abs(x)),1e-12)),
            'seconds':len(x)/SR, 'clippedSamples':int(np.sum(np.abs(x)>=32767/32768))}
def db(v): return 10**(v/20)
def filt(x,kind,hz):
    return signal.sosfilt(signal.butter(2,hz,btype=kind,fs=SR,output='sos'),x,axis=0)
def fade(x,fi=.005,fo=.05):
    x=x.copy(); a=min(int(fi*SR),len(x)); b=min(int(fo*SR),len(x))
    if a: x[:a]*=np.linspace(0,1,a)[:,None]
    if b: x[-b:]*=np.linspace(1,0,b)[:,None]
    return x
def speed(x,r):
    # Playback-rate change; pitch and duration change together, as specified.
    factor=int(round(r*100000))
    return signal.resample_poly(x,100000,factor,axis=0)
def pitch(x,lo,hi,start,end):
    y=x[int(start*SR):int(end*SR)].mean(axis=1)
    n=2**20
    spec=np.abs(np.fft.rfft(y*np.hanning(len(y)),n)); hz=np.fft.rfftfreq(n,1/SR)
    ix=np.flatnonzero((hz>=lo)&(hz<=hi)); i=ix[np.argmax(spec[ix])]
    a,b,c=np.log(np.maximum(spec[i-1:i+2],1e-20))
    delta=.5*(a-c)/(a-2*b+c)
    return float((i+delta)*SR/n)
def room(x,tail=2.5):
    wet=filt(x,'lowpass',4000)
    y=np.pad(x,((0,int(tail*SR)),(0,0)))
    # Source-derived dense reflection taps; never creates a new sound source.
    for k,t in enumerate(np.linspace(.073,tail,38)):
        i=int(t*SR); tap=wet[:,::-1] if k%2 else wet
        y[i:i+len(x)]+=tap*(.035*math.exp(-3*t/tail))
    return fade(y,0,.08)
def seam(x,seconds=2):
    n=min(int(seconds*SR),len(x)//3)
    # One crossfade per cycle; the new boundary is an untouched adjacent pair.
    t=np.linspace(0,1,n)[:,None]
    return np.concatenate([x[n:-n],x[-n:]*(1-t)+x[:n]*t])
def pan(x,v):
    # Preserve stereo at center and attenuate the opposite side for lateral placement.
    y=x.copy(); y[:,0]*=math.sqrt(1-max(0,v)); y[:,1]*=math.sqrt(1+min(0,v)); return y

cache={}
def source(name):
    path=SRC/(name+'.wav') if name.endswith('mp3') is False else SRC/name
    if name not in cache:
        cache[name]=read(path)
        report['sources'][name]={'path':str(path),'sha256':sha(path),**measure(cache[name])}
    return cache[name].copy()
assets={}
def asset(id,source_name,target,loop=False,rate=None,low=None,high=None,trim=None,reverb=None,notch=False,shelf=False):
    x=source(source_name); ops=[]; original=x.copy()
    # Interpolate only isolated clipped runs <= 16 samples. Sustained flattened
    # hum/swell/flush cannot be recovered this way; leave and explicitly flag them.
    bad=np.abs(x)>=32767/32768; repaired=0; retained=0
    for ch in range(2):
        ids=np.flatnonzero(bad[:,ch]); runs=np.split(ids,np.flatnonzero(np.diff(ids)>1)+1)
        for run in runs:
            if not len(run): continue
            a,b=int(run[0]),int(run[-1])
            if len(run)<=16 and a>0 and b<len(x)-1 and source_name not in ['a05_core_stone_hum','a05_core_swell','a05_birds_flush']:
                x[a:b+1,ch]=np.linspace(x[a-1,ch],x[b+1,ch],len(run)+2)[1:-1]; repaired+=len(run)
            else: retained+=len(run)
    if repaired:ops.append({'isolatedClippedSamplesInterpolated':repaired})
    if retained:ops.append({'unrecoveredClippedSamples':retained,'requiresUserListening':True})
    if trim: x=x[:int(trim*SR)]; ops.append({'trimEndSeconds':trim})
    if rate:
        lo,hi,st,en,target_hz=rate
        measured=pitch(x,lo,hi,st,en); r=target_hz/measured; x=speed(x,r)
        check=pitch(x, target_hz*.94,target_hz*1.06,st/r,en/r)
        assert abs(1200*math.log2(check/target_hz))<12
        ops.append({'measuredHz':measured,'targetHz':target_hz,'playbackRate':r,'outputMeasuredHz':check})
    if low:x=filt(x,'lowpass',low);ops.append({'lowpassHz':low})
    if high:x=filt(x,'highpass',high);ops.append({'highpassHz':high})
    if notch:
        b,a=signal.iirnotch(200,8,fs=SR);x=signal.lfilter(b,a,x,axis=0);ops.append({'notchHz':200,'Q':8})
    if shelf:
        # First-order complementary shelf: -4 dB high band around 9 kHz.
        lo=filt(x,'lowpass',9000);x=lo+db(-4)*(x-lo);ops.append({'highShelfHz':9000,'highBandDb':-4})
    if reverb:x=room(x,reverb);ops.append({'sourceReflectionTailSeconds':reverb})
    if loop:x=seam(x);ops.append({'loopCrossfadeSeconds':2})
    else:x=fade(x,fo=.25 if trim else .05)
    pre=measure(x); metric='integratedLufs' if loop or id=='a05_bgm_day' else 'maxMomentaryLufs'
    desired=target-pre[metric]; gain=min(desired,-1.2-pre['truePeakDbtp']);x*=db(gain)
    dest=ASSETS/(id+'.wav');write(dest,x);out=measure(read(dest))
    assert out['clippedSamples']==0 and out['truePeakDbtp']<=-1.0
    report['assets'][id]={'source':source_name,'targetLufs':target,'metric':metric,'gainDb':gain,
                         'headroomLimited':gain<desired-.01,'operations':ops,'path':str(dest.relative_to(ROOT)),**out}
    assets[id]=read(dest); print('Prepared',id,flush=True)

spec=[('a05_bell_strike',-13),('a05_bell_log_pull',-26),('a05_wind_bell_gust',-22),
      ('a05_boulder_call',-20),('a05_wind_rock',-20),('a05_wall_knock',-21),('a05_mica_peel',-24),
      ('a05_crane',-25),('a05_handcart',-25),('a05_winch',-25),('a05_leaf_on_water',-32),
      ('a05_wall_hum',-30),('a05_grit_fall',-30),('a05_gust',-22),('a05_gust_leaves',-27),
      ('a05_birds_flush',-24),('a05_core_swell',-14)]
for name,target in spec:asset(name,name,target,low=8000 if name=='a05_wind_bell_gust' else None)
asset('a05_wind_bell_soft','a05_wind_bell_soft',-28,trim=5)
for id,target,opts in [('a05_stone_saw',-30,{}),('a05_water_wheel',-40,{}),('a05_ropeway',-27,{}),
                       ('a05_amb_waterfall_far',-36,{'low':3000,'notch':True}),('a05_amb_leaves',-40,{'low':8000}),
                       ('a05_amb_night_crickets',-42,{'shelf':True}),('a05_cave_room',-36,{})]:
    asset(id,id,target,loop=True,**opts)
asset('a05_stone_chime_g6','a05_stone_chime_high',-17,rate=(1500,1750,.1,1.2,1567.981744))
asset('a05_stone_chime_d6','a05_stone_chime_high',-21,rate=(1500,1750,.1,1.2,1174.659072),reverb=1.5)
asset('a05_tuning_fork','a05_tuning_fork',-22,rate=(370,410,1.7,3.5,391.995436))
asset('hum_stone_g2','a05_core_stone_hum',-27,rate=(90,105,.7,2.1,97.998859),reverb=2.5)
asset('core_motif_05','a05_core_melody',-18)
report['assets']['core_motif_05']['measuredChordHz']=[pitch(source('a05_core_melody'),h*.96,h*1.04,1,3) for h in [261.626,329.628,391.995]]
asset('a05_wall_murmur','[whispers] ...Ove talu... [exhales] mernai..mp3',-25,low=1200,reverb=2.5)
asset('a05_bgm_day','a05_bgm_day',-25.75,high=120)
# Locate the strongest energy phase in a 68 BPM bar grid; expose candidates,
# rather than claiming automatic beat analysis is a musical listening verdict.
bgm=assets['a05_bgm_day']; bar=60/68*4
mono=bgm.mean(axis=1); hop=480; rms=np.sqrt(np.mean(mono[:len(mono)//hop*hop].reshape(-1,hop)**2,axis=1))
energy=np.maximum(0,np.diff(rms,prepend=rms[0])); phase_grid=np.arange(0,bar,.01)
scores=[sum(energy[min(len(energy)-1,int(t*100))] for t in np.arange(ph,140,bar)) for ph in phase_grid]
phase=float(phase_grid[np.argmax(scores)])
report['musicBarAnalysis']={'bpmReference':68,'barSeconds':bar,'energyPhaseSeconds':phase,
                           'candidateStartsBefore147':[round(float(t),4) for t in np.arange(phase,147,bar)],
                           'method':'positive 10ms RMS differences folded over 68 BPM four-beat bars; candidate downbeats'}

def repeat(x,n,offset=0):
    indices=(np.arange(n)+int(offset*SR))%len(x);return x[indices].copy()
def add(y,x,at,gain=1):
    i=int(round(at*SR));skip=max(0,-i);i=max(0,i);n=min(len(x)-skip,len(y)-i)
    if n>0:y[i:i+n]+=x[skip:skip+n]*gain
def envelope(n,points):return np.interp(np.arange(n)/SR,*zip(*points))[:,None]
ENV=.35**1.4
def outdoor(seconds,night=False):
    n=int(seconds*SR); leaves=.5 if night else 1;water=.9 if night else 1
    leaf=repeat(assets['a05_amb_leaves'],n,3.3)*leaves
    # Honor the explicit 'never louder than leaves' rule after slider/period gains.
    water_cap=min(water,db(-4)*leaves)
    y=leaf+pan(repeat(assets['a05_amb_waterfall_far'],n,7.1),-.35)*water_cap
    y+=pan(repeat(assets['a05_water_wheel'],n,2.2),-.45)
    if night:y+=repeat(assets['a05_amb_night_crickets'],n,4.7)
    return y
def cave(seconds):
    y=filt(outdoor(seconds),'lowpass',500)*.2
    y+=repeat(assets['a05_cave_room'],len(y),2.6);return y
def music(seconds,start=0,night=False,cave_gain=1,offset=None):
    y=np.zeros((int(seconds*SR),2)); offset=phase+8*bar if offset is None else offset
    x=bgm[int(offset*SR):min(len(bgm),int((offset+120)*SR))].copy()
    if night:x=filt(x,'lowpass',2500)*db(-2)
    # Preview may end before the full segment does; fade its final 4s for listening.
    x=x[:max(0,int((seconds-start)*SR))]; x=fade(x,4,4)
    add(y,x,start,cave_gain);return y
def duck(n,at,target,attack,hold,recovery):
    return envelope(n,[(0,1),(max(0,at-attack),1),(at,target),(at+hold,target),(at+hold+recovery,1),(n/SR+1,1)])

class Shots:
    def __init__(self):self.events=[];self.actions=[]
    def put(self,id,at,gain=1,rate=1,position=0,reflect=0,low=None,priority=1,target=None):
        x=assets[id].copy()
        if rate!=1:x=speed(x,rate)
        if low:x=filt(x,'lowpass',low)
        if reflect:x=room(x,reflect)
        if target is not None:x*=db(target-measure(x)['maxMomentaryLufs'])
        x=pan(x,position)*gain
        self.events.append({'id':id,'at':at,'end':at+len(x)/SR,'gain':gain,'rate':rate,
                            'position':position,'reflection':reflect,'lowpass':low,'target':target,'priority':priority,'x':x})
    def render(self,y):
        accepted=[]
        for e in sorted(self.events,key=lambda e:(e['at'],-e['priority'])):
            active=[old for old in accepted if old['at']<=e['at']<old['end']]
            if len(active)>=3:
                old=min(active,key=lambda old:(old['priority'],old['at']))
                if old['priority']>e['priority']:
                    self.actions.append({'dropped':e['id'],'at':e['at'],'reason':'three higher priority voices'});continue
                count=max(0,int((e['at']-old['at'])*SR));old['x']=fade(old['x'][:count],0,.06);old['end']=e['at']
                self.actions.append({'released':old['id'],'at':e['at'],'reason':'foreground cap'})
            accepted.append(e)
        self.events=accepted
        for e in self.events:add(y,e['x'],e['at'])
        maximum=max([sum(e['at']<=t<e['end'] for e in self.events) for t in [e['at'] for e in self.events]] or [0])
        assert maximum<=3
        return {'foregroundMax':maximum,'events':[{k:v for k,v in e.items() if k!='x'} for e in self.events], 'voiceActions':self.actions}

bird=source('lake_birds_day')
for i,at in enumerate([3.5,12,18.25,28.5]):
    x=fade(bird[int(max(0,at-2)*SR):int(min(30,at+3)*SR)],.15,.4)
    x*=db(-36-measure(x)['maxMomentaryLufs']);assets[f'bird_{i}']=x
    write(ASSETS/f'bird_{i}.wav',x)
    report['assets'][f'bird_{i}']={'source':'lake_birds_day','cutStart':max(0,at-2),'cutEnd':min(30,at+3),**measure(x)}

titles=['白天 60 秒','夜晚 60 秒','梵鐘一次與壓低配樂','首訪石磬雙音','回音巨石：拍手與回音',
        '風孔岩：原速／1.5 倍','山風 60 秒與十三下梵鐘','洞內探索：聽回音','第二次造訪：低喃',
        '營火剪影遠鐘','取得藏聲石完整演出']
rows=[]
for number,title in enumerate(titles,1):
    seconds={1:60,2:60,3:30,4:12,5:10,6:16,7:60,8:65,9:16,10:14,11:50}[number]
    night=number==2; indoor=number in [8,9,11]
    y=cave(seconds) if indoor else outdoor(seconds,night)
    m=music(seconds,25 if number in [1,2] else 0,night,.6 if indoor else 1)
    s=Shots(); n=len(y)
    if number in [1,2]:
        s.put('a05_wind_bell_soft',8 if night else 34,rate=1.02,position=.2)
        if not night:
            s.put('bird_0',10,gain=.6,position=-.2);s.put('bird_2',46,gain=.6,position=.2)
    elif number==3:
        s.put('a05_bell_log_pull',1);s.put('a05_bell_strike',4,priority=3)
        m*=duck(n,4,.35,.3,8,3);y*=duck(n,4,.5,.3,6,1)
    elif number==4:
        s.put('a05_stone_chime_g6',2.15,priority=3);s.put('a05_stone_chime_d6',3.25,priority=3)
        m*=duck(n,2.15,.5,.15,0,1.5)
    elif number==5:
        s.put('a05_boulder_call',2.3);s.put('a05_boulder_call',2.9,db(-9),low=2500)
        s.put('a05_boulder_call',3.5,db(-15),low=2500);m*=duck(n,2.3,.5,.15,0,1.5)
    elif number==6:
        s.put('a05_wind_rock',2);s.put('a05_wind_rock',9,rate=1.5)
        m*=np.minimum(duck(n,2,.5,.15,0,1.5),duck(n,9,.5,.15,0,1.5))
    elif number==7:
        # Wind layers are continuous environmental beds with 3s overlap.
        wind=np.zeros_like(y)
        for at,r in [(0,1),(17,.98),(34,1.03),(51,1)]:
            add(wind,fade(speed(assets['a05_gust'],r),3,3),at)
            add(wind,fade(speed(assets['a05_gust_leaves'],r),3,3),at+1)
        y+=wind;s.put('a05_birds_flush',0)
        # Full thirteen strikes, not only the required opening 15s.
        for i in range(13):s.put('a05_bell_strike',i*4.5,db(-2-(i%3-1)),rate=1+(.01*((i%5)-2)),priority=3)
        # Insert in chronological order to enforce the actual voice cap correctly.
        # Bells already occupy all three channels: gust chimes yield to them.
        for i,at in enumerate(np.arange(2,60,3.5)):
            s.put('a05_wind_bell_gust',float(at),position=[-.25,.25,.15,-.15][i%4])
        m*=duck(n,0,.35,.3,60,3);y*=duck(n,0,.5,.3,60,1)
    elif number==8:
        for id,at,gain in [('a05_stone_chime_g6',4,db(-8)),('a05_stone_chime_d6',5.1,db(-8)),
                           ('a05_boulder_call',15,db(-8)),('a05_boulder_call',15.6,db(-17)),
                           ('a05_boulder_call',16.2,db(-23)),('a05_bell_strike',24,db(-10)),
                           ('a05_wind_rock',48,db(-8)),('a05_wall_knock',58,db(-8))]:
            s.put(id,at,gain,reflect=2.5,low=2500 if 15.5<at<17 else None,priority=3)
        # Stone hum yields to foreground echoes; leaf-water at quiet gaps.
        for at in range(0,seconds,8):s.put('hum_stone_g2',at,priority=2)
        s.put('a05_leaf_on_water',1,reflect=2.5)
    elif number==9:
        x=room(assets['a05_wall_hum'][:int(1.2*SR)],2.5);assets['wall_hum_short']=x
        s.put('wall_hum_short',2);s.put('a05_wall_murmur',4)
    elif number==10:
        y[:]=0;m[:]=0
        x=room(filt(assets['a05_bell_strike'],'lowpass',1800),2.5)*db(-12)
        x=fade(x[:8*SR],0,2);assets['distant_bell']=x;s.put('distant_bell',1.35,priority=3)
        # Isolated far bell; no valley ambience or BGM incorrectly added to the campfire.
    elif number==11:
        # core 0.6/1.5/2.2 relative to the existing stone-approach timeline.
        # Reserve priority channels; shorten prior hum at the next hum so swell fits.
        for at,target,rate in [(.6,-24,1),(1.5,-22,1.03),(2.2,-20,1.06)]:
            s.put('hum_stone_g2',at,rate=rate,target=target,priority=3)
        s.put('a05_core_swell',1.0,priority=3) # source peak 2.6 => scene blue pulse 3.6
        s.put('core_motif_05',7.6,priority=3)
        # Core motif belongs to background slider, not environment slider.
        motif=[e for e in s.events if e['id']=='core_motif_05'][0];s.events.remove(motif)
        m*=envelope(n,[(0,1),(4,0),(seconds,0)])
        add(m,motif['x'],7.6);y*=.3
        report['coreTiming']={'humSeconds':[.6,1.5,2.2],'swellStart':1,'swellPeak':3.6,
                             'motifStart':7.6,'nextMusicNotBefore':7.6+len(motif['x'])/SR+30}
    # Each audition has two versions with identical environmental sound and cues.
    voice=s.render(y)
    if number==11:
        voice['backgroundEvents']=[{k:v for k,v in motif.items() if k!='x'}]
    for percent in [12,25]:
        x=y*ENV+m*(percent/100)**1.4;x=fade(x,.04,.4)
        path=PRE/f'{number:02d}-{percent}.wav';write(path,x);stats=measure(read(path))
        assert stats['clippedSamples']==0 and stats['truePeakDbtp']<=-1
        report['auditions'][path.name]={'title':title,'musicPercent':percent,**stats,**voice}
    rows.append((number,title))
    print('Audition',number,title,flush=True)

# Equal-gain original/processed comparison preserves distortion evidence and
# avoids a louder source winning the comparison by loudness alone.
for name,id in [('a05_core_stone_hum','hum_stone_g2'),('a05_core_swell','a05_core_swell'),
                ('a05_birds_flush','a05_birds_flush'),('a05_winch','a05_winch')]:
    original=source(name); processed=assets[id]
    g=report['assets'][id]['gainDb']; original*=db(g)
    if np.max(np.abs(original))>=.89:original*=.89/np.max(np.abs(original))
    for label,x in [('original-level-matched',original),('processed',processed)]:
        write(AB/f'{name}-{label}.wav',x)
    report['comparisons'][name]={'originalGainDb':g,'retainsSourceDistortion':True,'processedId':id}

for r in [1,1.5]:
    write(PRE/f'wind-rock-rate-{r}.wav',speed(assets['a05_wind_rock'],r))

assert all(sha(Path(f))==digest for f,digest in before.items())
report['sourceHashesUnchanged']=True;report['checkedOriginalCount']=len(before)
report['sourceInventorySha256']=before
report['tools']={'python':sys.version.split()[0],'numpy':np.__version__,
                 'ffmpeg':ff(['-version']).stdout.decode().splitlines()[0]}
(PRE/'processing-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf8')
cards=''.join(f'<section><h2>{i}. {html.escape(title)}</h2><div class="pair">'+''.join(
    f'<label>背景音 {v}%<audio controls preload="none" src="{i:02d}-{v}.wav"></audio><a href="{i:02d}-{v}.wav" download>下載 WAV</a></label>' for v in [12,25])+'</div></section>' for i,title in rows)
comparisons=''.join(f'<section><h2>{html.escape(name)}</h2>'+''.join(f'<label>{label}<audio controls preload="none" src="comparison/{name}-{key}.wav"></audio></label>' for label,key in [('原音（音量降低供公平比較）','original-level-matched'),('處理後','processed')])+'</section>' for name in report['comparisons'])
(PRE/'index.html').write_text('''<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>藏聲秋谷音效試聽</title>
<style>body{background:#171c1b;color:#e5e0d5;max-width:980px;margin:40px auto;padding:0 24px;font:17px/1.7 system-ui}h1{font-size:30px}h2{font-size:20px}section{padding:20px 0;border-top:1px solid #47514a}.pair{display:flex;gap:32px;flex-wrap:wrap}label{display:block}audio{display:block;margin:12px 0;width:360px;max-width:100%}a{color:#e0b980}.note{padding:20px;background:#263029;border-radius:8px}</style>
<h1>藏聲秋谷｜音效與配樂試聽</h1><p>11 項試聽，環境音固定 35%，背景音各有 12%／25%。一次播放一個；原檔保留，尚未接入遊戲。</p>
<div class="note">請用筆電喇叭聽第 3 項梵鐘、第 6 項風孔岩（2 秒原速，9 秒 1.5 倍），並確認藏聲石低鳴原音 0.7–2.1 秒沒有沙沙破音。第 11 項及下方對照可檢查低鳴、swell 最高點；第 7 項開頭也請留意鳥群是否刺耳。<br>白天／夜晚前 25 秒只有環境；短試聽的配樂在結尾淡出。第 11 項從走到石壇後開始，三聲低鳴、3.6 秒大藍波、7.6 秒收石接旋律，之後保持留白。第 8 項為五種回音依序示範。第 7 項播完整十三下鐘，低優先風鐸讓位。</div>
'''+cards+'<p>第 10 項為獨立遠鐘，沒有配樂，兩種百分比相同。風孔岩亦可單獨下載：<a href="wind-rock-rate-1.wav">原速</a>／<a href="wind-rock-rate-1.5.wav">1.5 倍</a>。</p><h1>削波重點：原音與處理後</h1><p>原音僅降低音量。降低音量無法消除錄音本身的失真；有破音請回報需重生。</p>'+comparisons+
'<p><a href="processing-report.json">量測與處理報告</a> · <a href="README.md">交付說明</a></p><script>document.addEventListener("play",e=>{if(e.target.tagName==="AUDIO")document.querySelectorAll("audio").forEach(a=>{if(a!==e.target)a.pause()})},true)</script></html>',encoding='utf8')
print('Complete: 11 auditions x 2 music levels; original hashes unchanged.',flush=True)

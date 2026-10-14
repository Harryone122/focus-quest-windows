"""Install the user-approved Area 05 audition assets, without rerendering them."""
from pathlib import Path
import hashlib,json,shutil,wave
ROOT=Path(__file__).resolve().parents[1]
PRE=ROOT/'previews/area05-audio-qa'
OUT=ROOT/'src/renderer/src/echoQuarry/audio'
approval=json.loads((ROOT/'docs/area05/AUDIO_ACCEPTANCE.json').read_text(encoding='utf8'))
assert approval['approved'] and approval['musicPercent']==25 and approval['windRockRate']==1.5
verified=json.loads((PRE/'verification-report.json').read_text(encoding='utf8'))
verified['wavSha256']={k.replace('\\','/'):v for k,v in verified['wavSha256'].items()}
report=json.loads((PRE/'processing-report.json').read_text(encoding='utf8'))
OUT.mkdir(parents=True,exist_ok=True)
installed={}
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for src,h in report['sourceInventorySha256'].items():assert digest(Path(src))==h,src
for name in report['assets']:
    src=PRE/'assets'/f'{name}.wav'
    assert digest(src)==verified['wavSha256'][str(src.relative_to(PRE)).replace('\\','/')]
    if name=='a05_wall_murmur' and approval.get('murmurGainDb',0):
        review=json.loads((PRE/'murmur-review/report.json').read_text(encoding='utf8'))
        extra=approval['murmurGainDb'];candidate=review['candidates'][str(extra)]
        assert review['sourceHashes'][str(src)]==digest(src)
        src=PRE/'murmur-review'/candidate['processedAsset'];assert digest(src)==candidate['assetSha256']
    dest=OUT/f'{name}.wav';shutil.copyfile(src,dest);installed[dest.name]={'sha256':digest(dest),'source':str(src.relative_to(ROOT))}
# The accepted distant bell starts at 1.35s in its audition. Remove only that
# lead-in; the scene callback fires at the actual 1.35s visual impact.
with wave.open(str(PRE/'10-25.wav'),'rb') as f:
    f.setpos(round(1.35*f.getframerate()));raw=f.readframes(8*f.getframerate());params=f.getparams()
with wave.open(str(OUT/'a05_distant_bell.wav'),'wb') as f:
    f.setparams(params);f.writeframes(raw)
# The audition was heard at env 35%. Store at slider 100% like all other assets.
import array
x=array.array('h',raw)
gain=.35**1.4
x=array.array('h',(round(v/gain) for v in x))
with wave.open(str(OUT/'a05_distant_bell.wav'),'wb') as f:f.setparams(params);f.writeframes(x.tobytes())
installed['a05_distant_bell.wav']={'source':'10-25.wav, lead-in removed; env slider gain undone','sha256':digest(OUT/'a05_distant_bell.wav')}
for base,folder in [('stone_step_dry','glassNursery/audio'),('bridge_plank_step','lobby/audio/actions')]:
    for v in 'abc':
        src=ROOT/f'src/renderer/src/{folder}/{base}_{v}.wav'
        assert src.is_file(),str(src)
        dest=OUT/src.name;shutil.copyfile(src,dest);installed[dest.name]={'sha256':digest(dest),'source':str(src.relative_to(ROOT))}
(OUT/'manifest.json').write_text(json.dumps({'approval':approval,'musicBarAnalysis':report['musicBarAnalysis'],'files':installed},ensure_ascii=False,indent=2),encoding='utf8')
print('Installed',len(installed),'Area 05 recordings; existing maps and incoming sources unchanged.')

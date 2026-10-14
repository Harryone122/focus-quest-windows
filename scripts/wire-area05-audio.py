"""Keep the reproducible v10 scene port wired to approved Area 05 audio."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def wire(path):
    s=path.read_text(encoding='utf8')
    if "import { createQuarryAudio }" in s:return
    def replace(old,new):
        nonlocal s
        assert old in s,old[:100]
        s=s.replace(old,new,1)
    replace("import { advanceBellPendulum }", "import { createQuarryAudio } from './quarryAudio';\nimport { advanceBellPendulum }")
    replace('const THREE=ThreeLib;',"const THREE=ThreeLib;\nconst audio=createQuarryAudio();\nfunction sound(kind,payload){audio.cue(kind,payload);}\nlet audioStep=-1;")
    replace('function actFx(id) {',"function actFx(id) {\n  const cue={1:'chime',3:'clap',6:'windRock',13:'wall',14:'cart',15:'crane',17:'winch'}[id];if(cue)sound(cue);")
    replace("function strike(k) { st.rung++;", "function strike(k) { sound('bell',{strength:k});st.rung++;")
    replace('pull() { st.queue =',"pull() { sound('pull');st.queue =")
    replace("caveCalling = true; const E = CAVE.ECHO[caveLure.kind];", "caveCalling = true;sound('mouthEcho',{echo:caveLure.kind});const E = CAVE.ECHO[caveLure.kind];")
    replace('function startWind(first) { windSim = 60;',"function startWind(first) { if(windSim<=0)sound('windStart');windSim = 60;")
    replace('function hum(k = 1) { if (!stoneHere) return;',"function hum(k = 1) { if (!stoneHere) return;sound(busy==='core'?'coreHum':'hum',{k});")
    replace("timeline([[1.2, () => cavePulse(","timeline([[1.2, () => {sound('wallWarm');cavePulse(")
    replace("amp: 0.22, col: '#e9dccb', push: 0.4 })],", "amp: 0.22, col: '#e9dccb', push: 0.4 });}],")
    replace("timeline([[1.4, () => { cavePulse", "timeline([[1.4, () => { sound('murmur');cavePulse")
    replace("timeline([[0.9, () => { for (let k = 0; k < 4;", "timeline([[0.9, () => { sound('whistle');for (let k = 0; k < 4;")
    replace("timeline([[0.6, () => { hum(1.0);", "sound('coreStart',{timelineRate:rate()});\n      timeline([[0.6, () => { hum(1.0);")
    replace("[3.6, () => { cavePulse", "[3.6, () => { sound('coreWave');cavePulse")
    replace("[7.6, () => { stoneHere=false;", "[7.6, () => { sound('coreMotif');stoneHere=false;")
    replace("const E = ECHO[kind] || ECHO.chime;", "const E = ECHO[kind] || ECHO.chime;")
    replace("E.play();", "sound('caveEcho',{echo:kind});E.play();")
    replace("faller.next = 10 + Math.random() * 8; ripple(faller.x, faller.z, 0.35);", "faller.next = 10 + Math.random() * 8;sound('leaf');ripple(faller.x, faller.z, 0.35);")
    replace("function resetAll(){", "function resetAll(){audio.reset();audioStep=-1;")
    replace('  camera_update(dt);', """  const walking=playing&&TR.mode==='walk',step=Math.floor(TR.phase/Math.PI);
  if(walking&&audioStep>=0&&step!==audioStep)sound((inCave?Math.abs(TR.y-.32)<.12:TR.y>H(TR.x,TR.z)+.12)?'woodStep':'stoneStep');
  audioStep=walking?step:-1;
  audio.update({playing,inactive:opts.inactive?.()??globalThis.document.hidden,inCave,period:timeMode==='auto'?(ph<.09||ph>=.95?'dawn':ph<.4?'day':ph<.6?'dusk':'night'):timeMode,saw:!inCave&&TR.mode==='act'&&TR.spot===7,ropeway:gondolaBoost,winch:cageBoost,wind:windSim});
  camera_update(dt);""")
    replace('return {sim,lamps:', 'return {audio:audio.debug(),sim,lamps:')
    replace('return {state,reset,event,echoScenario,', "return {discoverySound(kind){if(kind==='fork'||kind==='mica')sound(kind);},audioSettings(value){audio.settings(value);},audioReady:audio.ready,state,reset,event,echoScenario,")
    replace("advance(sec){for(let i=0;i<Math.ceil(sec*30);i++)update(1/30);draw();},setTime(sec){sim=sec;TR.lit=lampsDue();},", "advance(sec){audio.seek(true);try{for(let i=0;i<Math.ceil(sec*30);i++)update(1/30);draw();}finally{audio.seek(false);}},setTime(sec){audio.seek(true);sim=sec;TR.lit=lampsDue();audio.seek(false);},")
    replace('destroy(){dead=true;', 'destroy(){audio.dispose();dead=true;')
    replace('speed(v){if([1,6,20,60].includes(v))speed=v;}', 'speed(v){if([1,6,20,60].includes(v)&&v!==speed){audio.seek(true);speed=v;audio.seek(false);}}')
    # Explicit handoff change: the wind-hole sound is one long moan, not three.
    replace("for (let k = 0; k < 3; k++) cavePulse(CX, STONE_Y, CZ, { R: 3.6 + k * 0.5, r0: 0.4, dur: 2.6, amp: 0.36, delay: k * 0.7, col: '#e2ddd2', push: 0.5 });", "cavePulse(CX, STONE_Y, CZ, { R: 4.2, r0: 0.4, dur: 3.3, amp: 0.36, col: '#e2ddd2', push: 0.5 });")
    s=s.replace('剛才喊的那一聲','剛才拍手的那一聲').replace('風穿過孔洞的嗚嗚聲','風穿過孔洞的一聲長嗚')
    path.write_text(s,encoding='utf8')
if __name__=='__main__':wire(ROOT/'src/renderer/src/echoQuarry/echoQuarryScene.js')

from pathlib import Path
import re
r=Path(__file__).resolve().parents[1]
s=(r/'docs/prototypes/glass-nursery-interior.html').read_text(encoding='utf-8').split('<script>')[-1].split('</script>')[0]
s=s.replace('const T = THREE;','')
s=re.sub(r'function frame\(\) \{.*?\n\}', '',s,flags=re.S)
s=s.replace('requestAnimationFrame(frame);','')
s=s.replace('renderer.setSize(w, h, false);','renderer.setSize(w, h, false); glass.setSize(w,h);')
s=s.replace("function say(msg) { statusEl.textContent = msg; }", "function say(msg) { statusEl.textContent = msg; opts.reportActivity?.(msg); }")
s=re.sub(r"  if \(window.__follow\).*",'',s)
s=re.sub(r'window\.__g7 = .*?;\n', '',s)
s=s.replace('FW = innerWidth; FH = innerHeight;', 'FW = host.clientWidth; FH = host.clientHeight;')
s=s.replace('const FOG_ROLL = [true, false, true, false, true];', 'const FOG_ROLL = Array.from({length:100},(_,i)=>nurseryFog(opts.nursery?.seed || opts.seed || 1,i*600));')
# The prototype clock controls are detached. Canvas dragging is omitted during Focus.
s=re.sub(r"canvas.addEventListener\('pointerdown'.*?addEventListener\('resize', resize\);", '',s,flags=re.S)
# Remove obsolete upper walkway activity, already excluded by production rules.
header="""import * as T from '../cloudRuins/vendor/three.module.js';
import { createEdgeGlass } from '../cloudRuins/edgeGlass.js';
import { nurseryFog, nurseryStoryKeys } from '../../../shared/area07';
export function createGlassNurseryScene(host, options) {
let opts={...options}, paused=!!opts.paused,lobby=opts.mode==='lobby',dead=false,raf=0;
let nursery=opts.nursery||null,progress=opts.progressSeconds||0,progressAt=performance.now(),lastReal=performance.now();
const realDocument=globalThis.document,canvasHost=realDocument.createElement('canvas'),lens=realDocument.createElement('canvas');
canvasHost.style.cssText='width:100%;height:100%;display:block';lens.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';host.append(canvasHost,lens);
const ui=new Map(), listeners=[];
const document={createElement:realDocument.createElement.bind(realDocument),querySelectorAll:()=>[],querySelector:()=>realDocument.createElement('div'),getElementById(id){if(id==='c')return canvasHost;if(id==='fg')return lens;if(!ui.has(id))ui.set(id,realDocument.createElement('div'));return ui.get(id);}};
const addEventListener=(type,fn)=>{globalThis.addEventListener(type,fn);listeners.push([type,fn]);};
"""
s=s.replace('const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });','const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });\nconst glass=createEdgeGlass(renderer);host.dataset.glass="scene";')
out=r/'src/renderer/src/glassNursery';out.mkdir(exist_ok=True)
(out/'glassNurseryScene.js').write_text(header+s+'\n'+(r/'scripts/nursery-scene-driver.txt').read_text(encoding='utf-8')+'\n}',encoding='utf-8')

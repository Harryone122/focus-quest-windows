import { QUIET_FOCUS } from '../../shared/focusPresentation'
export function quietCanvas(canvas, quiet) { canvas.style.filter = quiet ? `brightness(${QUIET_FOCUS.brightness}) saturate(${QUIET_FOCUS.saturation})` : ''; }
export function quietRare(rare, traveller, elapsed, reduced) {
  const hidden = [rare.item,rare.aura,rare.beam,rare.ring,rare.ring2,rare.light,rare.motes?.pts,rare.stars?.pts,...(rare.rings??[])];
  hidden.forEach(o => { if(o)o.visible=false });
  if(!rare.glint)return;
  const duration=rare.core?QUIET_FOCUS.coreFadeSeconds:QUIET_FOCUS.itemFadeSeconds;
  rare.glint.visible=!reduced&&elapsed>=0&&elapsed<duration;
  rare.glint.position.copy(traveller.position);rare.glint.position.y+=.7;
  rare.glint.scale.setScalar(.1);rare.glint.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){m.color?.setHex(rare.core?0x9cc8e8:0xffbf70);m.opacity=.18*Math.max(0,1-elapsed/duration);}});
}
export function quietLampLevel(seconds, index, step) { return Math.max(0,Math.min(1,(seconds-(index+1)*step)/QUIET_FOCUS.lampSeconds)); }

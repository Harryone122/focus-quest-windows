import './travelLoading.css'

// One drawing shared by the React shell and independent map trials.
export const travelLoadingDrawing = `<svg viewBox="0 0 100 76" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path class="travel-loading-trail" d="M5 68H95" opacity=".3"/>
  <g class="travel-loading-body">
    <path class="travel-loading-leg-back" d="M45 55Q51 60 60 66Q63 68 67 67" opacity=".55"/>
    <path class="travel-loading-leg-front" d="M45 55Q51 60 60 66Q63 68 67 67"/>
    <!-- A loose, continuous contour: rolled pack, blank face, low wide hat,
         cone cloak and hanging lantern retain the in-game traveller's silhouette. -->
    <path d="M33 48C20 50 20 35 28 35C35 34 39 38 40 41
      Q43 37 44 36Q39 32 43 27
      Q34 29 27 27Q39 23 50 15Q54 21 66 25
      Q74 26 72 28Q56 30 43 27
      Q57 27 59 28Q60 37 52 38
      Q58 43 63 54Q47 58 34 54Q37 45 43 39
      Q39 46 36 48"/>
    <path class="travel-loading-arm" d="M56 44Q64 49 73 44"/>
    <path d="M73 65Q75 43 72 28Q77 30 82 29L81 34
      Q76 33 77 40Q82 42 85 39L83 34L81 34"/>
  </g>
</svg>`

export function createTravelLoading(label = '旅人正在準備下一段路'): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'travel-loading'
  el.setAttribute('role', 'status')
  el.setAttribute('aria-label', label)
  el.innerHTML = travelLoadingDrawing
  return el
}

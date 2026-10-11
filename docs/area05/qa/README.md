# area05 QA 腳本（Claude 對網頁原型使用）

需要 `npm i three@0.128.0 playwright-core` 和一個 Chromium。`run.js` 會把原型裡的 cdnjs three.js 換成同資料夾的 `three.min.js`（從 `node_modules/three/build/` 複製），載入 `?qa&nohud`，執行指定腳本後截圖：

```
node run.js <原型.html> <輸出.png> "$(cat occlusion-all.js)" 1280 720
```

- `occlusion-all.js`：固定鏡頭下，地點物件、站位、燈被什麼擋住（frac = 被擋比例）。
- `cave-mouth-tunnel.js`：回傳 `{bad:[], terrainInTunnel:0}` 才算通過。
- `cave-route-clearance.js`：回傳 `hits` 為空才算通過；`float` 列出腳下高度差 > 0.07 的點。

原型的 `window.__quarry` 介面只為測試存在，正式版不需要。

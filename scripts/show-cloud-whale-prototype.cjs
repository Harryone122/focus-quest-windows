// Interactive story and whale design preview. Opens on the first non-primary monitor.
const { app, BrowserWindow, screen } = require('electron')
const path = require('node:path')
app.whenReady().then(() => {
  const secondary = screen.getAllDisplays().find((display) => display.id !== screen.getPrimaryDisplay().id) ?? screen.getPrimaryDisplay()
  const area = secondary.workArea
  const window = new BrowserWindow({
    x: area.x + 16, y: area.y + 16,
    width: Math.min(1200, area.width - 32), height: Math.min(670, area.height - 32),
    title: 'Focus Quest · 雲上遺庭測試',
    webPreferences: { backgroundThrottling: false }
  })
  window.loadFile(path.join(__dirname, '../docs/prototypes/cloud-ruins.html'))
  window.on('closed', () => app.quit())
})

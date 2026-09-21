const { app, BrowserWindow } = require('electron')
const { readFile, writeFile } = require('node:fs/promises')
const { join } = require('node:path')

app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  const source = await readFile(join(__dirname, '..', 'build', 'icon.svg'), 'utf8')
  const window = new BrowserWindow({
    width: 512,
    height: 512,
    x: -10000,
    y: -10000,
    frame: false,
    show: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: { backgroundThrottling: false }
  })
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<style>*{margin:0}body{overflow:hidden}</style>${source}`)}`)
  await new Promise((resolve) => setTimeout(resolve, 250))
  const image = await window.webContents.capturePage()
  await writeFile(join(__dirname, '..', 'build', 'icon.png'), image.toPNG())
  window.destroy()
  app.quit()
}).catch((error) => {
  console.error(error)
  app.exit(1)
})

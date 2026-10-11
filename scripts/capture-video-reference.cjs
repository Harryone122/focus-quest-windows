const { app, BrowserWindow } = require('electron')
const { mkdir, writeFile } = require('node:fs/promises')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

async function seekVideo(window, seconds) {
  await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const video = document.querySelector('video');
    const done = () => { video.removeEventListener('seeked', done); resolve(true); };
    video.addEventListener('seeked', done, { once: true });
    video.currentTime = ${seconds};
    setTimeout(() => reject(new Error('video seek timed out')), 5000);
  })`)
}

app.whenReady().then(async () => {
  const source = process.argv[2]
  const output = process.argv[3]
  if (!source || !output) throw new Error('Usage: electron capture-video-reference.cjs <video> <output-directory>')
  await mkdir(output, { recursive: true })
  const window = new BrowserWindow({ show: false, width: 1280, height: 720, useContentSize: true })
  const sourceUrl = pathToFileURL(source).toString()
  await window.loadFile(join(__dirname, 'video-reference.html'))
  await window.webContents.executeJavaScript(`(() => {
    const video = document.querySelector('video');
    video.src = ${JSON.stringify(sourceUrl)};
    video.load();
  })()`)
  const metadata = await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const video = document.querySelector('video');
    const report = () => resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
    const timeout = setTimeout(() => reject(new Error('video metadata timed out')), 8000);
    const done = () => { clearTimeout(timeout); report(); };
    if (video.readyState >= 1) done();
    else video.addEventListener('loadedmetadata', done, { once: true });
    video.addEventListener('error', () => reject(video.error?.message || 'video load failed'), { once: true });
  })`)
  const width = Math.min(1920, Math.max(320, metadata.width))
  const height = Math.min(1080, Math.max(180, metadata.height))
  window.setContentSize(width, height)
  const times = [0.05, metadata.duration * 0.25, metadata.duration * 0.5, metadata.duration * 0.75, Math.max(0.05, metadata.duration - 0.08)]
  for (let index = 0; index < times.length; index += 1) {
    await seekVideo(window, times[index])
    const frame = await window.webContents.capturePage()
    await writeFile(join(output, `reference-${String(index).padStart(2, '0')}.png`), frame.toPNG())
  }
  await writeFile(join(output, 'metadata.json'), JSON.stringify({ ...metadata, sampleTimes: times }, null, 2))
  app.quit()
}).catch((error) => {
  console.error(error)
  app.exit(1)
})

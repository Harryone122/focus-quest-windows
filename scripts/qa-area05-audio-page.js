// Read by agent-browser eval --stdin after opening the audition index.html.
(async () => {
  const audio = [...document.querySelectorAll('audio')];
  if (audio.length !== 30) throw new Error(`Expected 30 audio controls, got ${audio.length}`);
  const decoded = await Promise.all(audio.map(a => new Promise((resolve, reject) => {
    a.muted = true;
    const timer = setTimeout(() => reject(new Error(`Decode timeout: ${a.src}`)), 20000);
    a.onloadeddata = () => { clearTimeout(timer); resolve({file: a.getAttribute('src'), seconds: a.duration, readyState: a.readyState}); };
    a.onerror = () => { clearTimeout(timer); reject(new Error(`Decode failure: ${a.src}`)); };
    a.preload = 'auto'; a.load();
  })));
  for (const i of [0, 1, 12, 13, 20, 21, 22, 23]) {
    const a = audio[i];
    a.currentTime = Math.min(1, a.duration / 2);
    await a.play();
    await new Promise(r => setTimeout(r, 100));
    if (a.paused || a.currentTime <= 0) throw new Error(`Playback did not advance: ${a.src}`);
  }
  if (audio.filter(a => !a.paused).length !== 1) throw new Error('Exclusive playback failed');
  audio.forEach(a => a.pause());
  return {auditionControls: 22, comparisonControls: 8, decoded, seekAndPlayback: true, exclusivePlayback: true,
          browserWidth: innerWidth, horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
          listeningApproval: false};
})()

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { roomDocument } from '../src/renderer/src/CollectionRoom'

describe('offline collection document bridge', () => {
  const html = readFileSync('docs/prototypes/collection-room.html', 'utf8').replace(/\r\n?/g, '\n')
  for (const newline of ['\n', '\r\n']) it(`connects readiness and state with ${JSON.stringify(newline)} lines`, () => {
    const result = roomDocument(html.replace(/\n/g, newline), 'file:///local/three.js')
    expect(result).toContain('import * as THREE from "file:///local/three.js"')
    expect(result).not.toContain('https://cdnjs.cloudflare.com')
    expect(result).toContain("type: 'ready'")
    expect(result).toContain('panelPlace, applyExternalState, async prepare()')
    expect(result).toContain('if (window.__roomPrepared && !window.__hold)')
  })
})

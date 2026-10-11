import type { ForestWindPrototypeDefinition } from './ForestEnvironmentAssets'

export interface WindMeshGeometry {
  baseVertices: number[]
  vertices: number[]
  indices: number[]
}

export interface PrototypeWindInput {
  phase: number
  strength: number
  gust: number
  directionX: number
  directionY: number
  motionScale: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function buildWindMeshGeometry(definition: ForestWindPrototypeDefinition): WindMeshGeometry {
  const vertices: number[] = []
  const indices: number[] = []
  for (let row = 0; row < definition.rows; row += 1) {
    const v = row / Math.max(1, definition.rows - 1)
    for (let column = 0; column < definition.columns; column += 1) {
      const u = column / Math.max(1, definition.columns - 1)
      vertices.push(u * definition.width, v * definition.height, u, v)
    }
  }
  for (let row = 0; row < definition.rows - 1; row += 1) {
    for (let column = 0; column < definition.columns - 1; column += 1) {
      const topLeft = row * definition.columns + column
      const topRight = topLeft + 1
      const bottomLeft = topLeft + definition.columns
      const bottomRight = bottomLeft + 1
      indices.push(
        topLeft, bottomLeft, topRight, 0,
        topRight, bottomLeft, bottomRight, 0
      )
    }
  }
  return { baseVertices: [...vertices], vertices: [...vertices], indices }
}

export function windMeshWeight(definition: ForestWindPrototypeDefinition, u: number, v: number): number {
  if (definition.kind === 'grass') return Math.pow(clamp(1 - v, 0, 1), 1.65)
  if (definition.kind === 'vine') return Math.pow(clamp(v, 0, 1), 1.35)
  const dx = u - definition.anchorX
  const dy = v - definition.anchorY
  const distance = Math.sqrt(dx * dx + dy * dy)
  return Math.pow(clamp((distance - 0.12) / 0.9, 0, 1), 1.35)
}

export function deformWindMesh(
  geometry: WindMeshGeometry,
  definition: ForestWindPrototypeDefinition,
  wind: PrototypeWindInput
): number[] {
  const result = geometry.vertices
  const waveDirection = wind.directionX >= 0 ? 1 : -1
  for (let index = 0; index < geometry.baseVertices.length; index += 4) {
    const baseX = geometry.baseVertices[index]
    const baseY = geometry.baseVertices[index + 1]
    const u = geometry.baseVertices[index + 2]
    const v = geometry.baseVertices[index + 3]
    const weight = windMeshWeight(definition, u, v)
    const propagation = definition.kind === 'vine' ? v * 0.82 : definition.kind === 'grass' ? (1 - v) * 0.34 : (u + 1 - v) * 0.2
    const primary = Math.sin(wind.phase + definition.phaseOffset - propagation)
    const secondary = Math.sin((wind.phase + definition.phaseOffset) * 0.47 + u * 1.7 + v * 0.83)
    const gustScale = 0.86 + wind.gust * 0.2
    const displacement = definition.tipDisplacement * wind.strength * wind.motionScale * gustScale * weight * (primary * 0.84 + secondary * 0.16)
    result[index] = baseX + displacement * waveDirection
    result[index + 1] = baseY + displacement * wind.directionY * 0.12 * (definition.kind === 'vine' ? weight : 0.45 * weight)
    result[index + 2] = u
    result[index + 3] = v
  }
  return result
}

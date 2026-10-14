/**
 * Relationship fields come back either as an id (depth 0) or as a populated
 * document (depth > 0). Hooks must handle both.
 */
export const toId = (value: unknown): number | string | undefined => {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    if (typeof id === 'number' || typeof id === 'string') return id
  }
  return undefined
}

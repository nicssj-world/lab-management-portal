export interface RequestHandle {
  id: number
  signal: AbortSignal
}

export interface RequestGuard {
  begin(): RequestHandle
  isCurrent(id: number): boolean
  cancel(): void
}

export function createRequestGuard(): RequestGuard {
  let currentId = 0
  let controller: AbortController | null = null

  return {
    begin() {
      controller?.abort()
      controller = new AbortController()
      currentId += 1
      return { id: currentId, signal: controller.signal }
    },
    isCurrent(id) {
      return id === currentId
    },
    cancel() {
      controller?.abort()
    },
  }
}

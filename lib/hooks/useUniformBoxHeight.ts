'use client'

import { useLayoutEffect, useState, type RefObject, type DependencyList } from 'react'

// Measures the natural (unconstrained) content height of every element matching
// `selector` inside `containerRef`, and returns the tallest one — undefined until
// measured. Re-measures when `deps` changes; the matched elements must never have
// their own height/min-height set, or a later measurement would read back a
// stale, already-enlarged size instead of the true content height.
export function useUniformBoxHeight(
  containerRef: RefObject<HTMLElement | null>,
  selector: string,
  deps: DependencyList,
): number | undefined {
  const [height, setHeight] = useState<number>()

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    function measure() {
      const els = container!.querySelectorAll<HTMLElement>(selector)
      if (els.length === 0) return
      let max = 0
      els.forEach((el) => { max = Math.max(max, el.scrollHeight) })
      if (max > 0) setHeight((prev) => (prev !== max ? max : prev))
    }
    measure()
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts
    fonts?.ready?.then(measure).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return height
}

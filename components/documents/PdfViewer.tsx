'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { buildPdfPageMetasFromFirstViewport, isPdfLike, shouldUsePdfJsViewer, type PdfPageMeta } from '@/lib/pdf-viewer-utils'

interface PdfViewport {
  width: number
  height: number
}

interface PdfRenderTask {
  promise: Promise<void>
  cancel: () => void
}

interface PdfPage {
  getViewport: (input: { scale: number }) => PdfViewport
  render: (input: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => PdfRenderTask
}

interface PdfDocument {
  numPages: number
  getPage: (pageNumber: number) => Promise<PdfPage>
}

interface PdfLoadingTask {
  promise: Promise<PdfDocument>
  destroy: () => Promise<void>
}

interface PdfViewerProps {
  url: string
  fileName?: string | null
  mimeType?: string | null
}

function openInNewTab(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function Spinner({ label }: { label: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,.72)' }}>{label}</span>
    </div>
  )
}

function FallbackCard({ url, title, message }: { url: string; title: string; message: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, padding: 34, textAlign: 'center', maxWidth: 390, boxShadow: '0 20px 60px rgba(15,23,42,.2)' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(30,95,173,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Icon name="doc" size={28} style={{ color: 'var(--primary)' }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.55 }}>{message}</div>
        <Button variant="primary" icon="eye" onClick={() => openInNewTab(url)}>เปิด PDF ในแท็บใหม่</Button>
      </div>
    </div>
  )
}

function NativePdfFrame({ url, title }: { url: string; title: string }) {
  return (
    <iframe
      src={url}
      title={title}
      style={{ width: '100%', height: '100%', border: 0, background: '#525659' }}
    />
  )
}

function PdfPageCanvas({
  pdf,
  meta,
  containerWidth,
  onVisible,
}: {
  pdf: PdfDocument
  meta: PdfPageMeta
  containerWidth: number
  onVisible: (pageNumber: number) => void
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)
  const [visible, setVisible] = useState(false)

  const pageWidth = Math.max(1, Math.min(containerWidth - 24, 980))
  const scale = pageWidth / meta.width
  const pageHeight = Math.max(1, Math.round(meta.height * scale))

  useEffect(() => {
    const node = wrapperRef.current
    const root = node?.parentElement
    if (!node || !root) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const nextVisible = Boolean(entry?.isIntersecting)
        setVisible(nextVisible)
        if (nextVisible) onVisible(meta.pageNumber)
      },
      { root, rootMargin: '1200px 0px', threshold: 0.01 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [meta.pageNumber, onVisible])

  useEffect(() => {
    let disposed = false
    const currentCanvas = canvasRef.current
    if (!currentCanvas || !visible) {
      if (currentCanvas) {
        currentCanvas.width = 0
        currentCanvas.height = 0
      }
      renderTaskRef.current?.cancel()
      renderTaskRef.current = null
      return
    }

    async function renderPage() {
      try {
        renderTaskRef.current?.cancel()
        const page = await pdf.getPage(meta.pageNumber)
        if (disposed) return

        const canvas = canvasRef.current
        if (!canvas) return
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = page.getViewport({ scale })
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        const context = canvas.getContext('2d')
        if (!context) return
        context.setTransform(dpr, 0, 0, dpr, 0, 0)

        const task = page.render({ canvasContext: context, viewport })
        renderTaskRef.current = task
        await task.promise.catch((error: unknown) => {
          if ((error as { name?: string })?.name !== 'RenderingCancelledException') throw error
        })
      } catch (error) {
        if ((error as { name?: string })?.name !== 'RenderingCancelledException') {
          console.error('[PdfViewer] render failed', error)
        }
      }
    }

    renderPage()
    return () => {
      disposed = true
      renderTaskRef.current?.cancel()
      renderTaskRef.current = null
    }
  }, [meta.pageNumber, pdf, scale, visible])

  return (
    <div ref={wrapperRef} data-page={meta.pageNumber} style={{ minHeight: pageHeight, display: 'flex', justifyContent: 'center', padding: '10px 12px' }}>
      <div style={{ width: pageWidth, height: pageHeight, background: '#fff', boxShadow: '0 8px 26px rgba(0,0,0,.28)', display: 'grid', placeItems: 'center' }}>
        <canvas ref={canvasRef} aria-label={`หน้า ${meta.pageNumber}`} />
      </div>
    </div>
  )
}

export function PdfViewer({ url, fileName, mimeType }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<PdfDocument | null>(null)
  const [pages, setPages] = useState<PdfPageMeta[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading')
  const [error, setError] = useState('')
  const [containerWidth, setContainerWidth] = useState(900)
  const [currentPage, setCurrentPage] = useState(1)
  const [usePdfJs, setUsePdfJs] = useState(false)

  const title = fileName || 'PDF'
  const canAttemptPdf = useMemo(() => isPdfLike({ fileName, mimeType }), [fileName, mimeType])

  useEffect(() => {
    setUsePdfJs(shouldUsePdfJsViewer({
      userAgent: window.navigator.userAgent,
      platform: window.navigator.platform,
      maxTouchPoints: window.navigator.maxTouchPoints,
    }))
  }, [])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const updateWidth = () => setContainerWidth(Math.max(320, node.clientWidth || 900))
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let disposed = false
    let loadingTask: PdfLoadingTask | null = null

    setPdf(null)
    setPages([])
    setCurrentPage(1)

    if (!canAttemptPdf) {
      setStatus('fallback')
      setError('ไฟล์นี้ไม่ใช่ PDF จึงไม่สามารถพรีวิวด้วย PDF viewer ได้')
      return
    }

    if (!usePdfJs) {
      setStatus('ready')
      return
    }

    setStatus('loading')
    setError('')

    async function loadPdf() {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
        loadingTask = pdfjs.getDocument({ url, disableAutoFetch: false, disableStream: false }) as unknown as PdfLoadingTask
        const document = await loadingTask.promise
        if (disposed) return

        const firstPage = await document.getPage(1)
        const firstViewport = firstPage.getViewport({ scale: 1 })
        if (disposed) return
        setPdf(document)
        setPages(buildPdfPageMetasFromFirstViewport(document.numPages, firstViewport))
        setStatus('ready')
      } catch (err) {
        if (disposed) return
        console.error('[PdfViewer] load failed', err)
        setStatus('fallback')
        setError('ไม่สามารถโหลด PDF ในแอปได้ อาจเกิดจาก CORS, ลิงก์หมดอายุ หรือไฟล์เสีย')
      }
    }

    loadPdf()
    return () => {
      disposed = true
      loadingTask?.destroy().catch(() => {})
    }
  }, [canAttemptPdf, url, usePdfJs])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, background: '#525659', overflow: 'hidden' }}>
      {status === 'loading' && <Spinner label="กำลังโหลด PDF..." />}
      {status === 'fallback' && <FallbackCard url={url} title={title} message={error || 'ไม่สามารถเปิด PDF ในแอปได้'} />}
      {status === 'ready' && canAttemptPdf && !usePdfJs && <NativePdfFrame url={url} title={title} />}
      {status === 'ready' && pdf && (
        <>
          <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '10px 0 58px' }}>
            {pages.map((meta) => (
              <PdfPageCanvas
                key={`${meta.pageNumber}-${containerWidth}`}
                pdf={pdf}
                meta={meta}
                containerWidth={containerWidth}
                onVisible={setCurrentPage}
              />
            ))}
          </div>
          <div style={{ position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', padding: '6px 12px', borderRadius: 999, background: 'rgba(15,23,42,.78)', color: '#fff', fontSize: 12, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,.25)', pointerEvents: 'none' }}>
            หน้า {currentPage} / {pages.length}
          </div>
        </>
      )}
    </div>
  )
}

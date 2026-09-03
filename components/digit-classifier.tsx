'use client'

import { useEffect, useRef, useState } from 'react'
import { Eraser, LoaderCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

const CANVAS_SIZE = 560

type PredictionResponse = {
  prediction?: number | string
  confidence?: number
}

export function DigitClassifier() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const [hasDrawing, setHasDrawing] = useState(false)
  const [isPredicting, setIsPredicting] = useState(false)
  const [result, setResult] = useState<PredictionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.fillStyle = '#11151b'
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    context.strokeStyle = '#f5f7fa'
    context.lineWidth = 26
    context.lineCap = 'round'
    context.lineJoin = 'round'
  }, [])

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const bounds = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * CANVAS_SIZE,
      y: ((event.clientY - bounds.top) / bounds.height) * CANVAS_SIZE,
    }
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    canvas.setPointerCapture(event.pointerId)
    const point = getPoint(event)
    context.beginPath()
    context.moveTo(point.x, point.y)
    context.lineTo(point.x + 0.1, point.y + 0.1)
    context.stroke()
    drawingRef.current = true
    setHasDrawing(true)
    setResult(null)
    setError(null)
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    const point = getPoint(event)
    context.lineTo(point.x, point.y)
    context.stroke()
  }

  function stopDrawing() {
    drawingRef.current = false
    canvasRef.current?.getContext('2d')?.closePath()
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.fillStyle = '#11151b'
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    context.strokeStyle = '#f5f7fa'
    setHasDrawing(false)
    setResult(null)
    setError(null)
  }

  async function predict() {
    const canvas = canvasRef.current
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!canvas || !hasDrawing) {
      setError('Draw a digit before asking the model to predict.')
      return
    }
    if (!apiUrl) {
      setError('The prediction service is not configured. Add NEXT_PUBLIC_API_URL to the environment.')
      return
    }

    setIsPredicting(true)
    setError(null)
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Could not prepare the drawing.')
      const formData = new FormData()
      formData.append('file', blob, 'digit.png')
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/predict`, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) throw new Error('The model could not process this drawing.')
      const data = (await response.json()) as PredictionResponse
      setResult(data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Something went wrong while contacting the model.')
    } finally {
      setIsPredicting(false)
    }
  }

  const confidence = typeof result?.confidence === 'number'
    ? `${(result.confidence > 1 ? result.confidence : result.confidence * 100).toFixed(1)}%`
    : null

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.22em] text-primary">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              Inference studio
            </div>
            <h1 className="text-balance font-sans text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">Digit Classifier</h1>
            <p className="max-w-md text-pretty text-base leading-6 text-muted-foreground">Draw a digit and let the model identify it.</p>
          </div>
          <p className="max-w-xs font-mono text-xs leading-5 text-muted-foreground sm:text-right">A simple interface for exploring handwritten digit recognition.</p>
        </header>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <span>Canvas / 01</span>
              <span>Draw one digit</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-foreground p-2 shadow-[0_18px_50px_-28px_hsl(var(--foreground))] sm:p-3">
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                aria-label="Drawing canvas for a handwritten digit"
                className="block aspect-square w-full touch-none cursor-crosshair rounded-lg bg-foreground"
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
                onPointerLeave={stopDrawing}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="outline" onClick={clearCanvas} className="h-12 flex-1 gap-2 bg-transparent font-medium">
                <Eraser data-icon="inline-start" />
                Clear canvas
              </Button>
              <Button type="button" onClick={predict} disabled={isPredicting} className="h-12 flex-1 gap-2 font-medium">
                {isPredicting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
                {isPredicting ? 'Reading digit…' : 'Predict digit'}
              </Button>
            </div>
            <p className="text-center text-xs leading-5 text-muted-foreground">Use your mouse or finger. Keep the digit centered and bold.</p>
          </div>

          <aside className="flex flex-col gap-5 lg:pt-8">
            <div className="flex min-h-64 flex-col justify-between rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <span>Model output</span>
                <span className="size-2 rounded-full bg-primary" aria-label="Model ready" />
              </div>
              <div className="flex flex-col gap-2 py-8">
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Prediction</span>
                <strong className="font-sans text-8xl font-semibold leading-none tracking-[-0.08em] text-primary" aria-live="polite">{result?.prediction ?? '—'}</strong>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted-foreground">Confidence</span>
                <span className="font-mono font-medium">{confidence ?? '—'}</span>
              </div>
            </div>
            {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm leading-5 text-destructive">{error}</p>}
            <div className="flex flex-col gap-2 border-l-2 border-primary pl-4">
              <p className="text-sm font-medium">About the model</p>
              <p className="text-sm leading-6 text-muted-foreground">Trained on thousands of handwritten digit images, this model learns the shapes that make each number unique.</p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}

export default DigitClassifier


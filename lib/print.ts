export function printHTML(html: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  let cleanedUp = false
  const cleanup = () => {
    if (cleanedUp) return
    cleanedUp = true
    setTimeout(() => {
      try { document.body.removeChild(iframe) } catch {}
    }, 1000)
  }

  const fire = () => {
    try {
      const win = iframe.contentWindow
      if (!win) { cleanup(); return }
      win.focus()
      win.print()
    } catch (e) {
      console.error('print failed', e)
    } finally {
      cleanup()
    }
  }

  const win = iframe.contentWindow
  if (win) {
    win.onafterprint = cleanup
  }

  const imgs = doc.images
  if (!imgs || imgs.length === 0) {
    setTimeout(fire, 150)
  } else {
    let loaded = 0
    const onDone = () => {
      loaded++
      if (loaded >= imgs.length) setTimeout(fire, 100)
    }
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i] as HTMLImageElement
      if (img.complete) onDone()
      else {
        img.addEventListener('load', onDone)
        img.addEventListener('error', onDone)
      }
    }
    setTimeout(() => { if (!cleanedUp) fire() }, 5000)
  }
}

export function buildPrintDocument(opts: {
  title?: string
  dir?: 'rtl' | 'ltr'
  lang?: string
  styles?: string
  body: string
}): string {
  const { title = 'Print', dir = 'rtl', lang = 'ar', styles = '', body } = opts
  return `<!DOCTYPE html><html dir="${dir}" lang="${lang}"><head><meta charset="UTF-8"><title>${title}</title><style>${styles}</style></head><body>${body}</body></html>`
}

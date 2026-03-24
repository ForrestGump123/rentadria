import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

/** Margin from A4 edges (mm) — white “frame” around the capture */
const PAGE_MARGIN_MM = 14

export async function downloadElementAsPdf(el: HTMLElement, fileName: string) {
  const canvas = await html2canvas(el, {
    scale: Math.min(2, window.devicePixelRatio || 1.5),
    useCORS: true,
    logging: false,
  })
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()

  const maxW = pageW - 2 * PAGE_MARGIN_MM
  const maxH = pageH - 2 * PAGE_MARGIN_MM
  const imgRatio = canvas.width / canvas.height

  let drawW = maxW
  let drawH = drawW / imgRatio
  if (drawH > maxH) {
    drawH = maxH
    drawW = drawH * imgRatio
  }

  const x = (pageW - drawW) / 2
  const y = (pageH - drawH) / 2

  pdf.addImage(imgData, 'PNG', x, y, drawW, drawH)
  pdf.save(fileName)
}

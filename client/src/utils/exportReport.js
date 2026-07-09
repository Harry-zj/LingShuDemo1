/**
 * 报告导出工具 — 支持 PDF / PNG / JPEG
 */
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

/**
 * 将 DOM 元素转为 Canvas
 */
async function toCanvas(el) {
  return html2canvas(el, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#F5F3FF",
    logging: false,
  })
}

/**
 * 导出为 PDF
 */
export async function exportPDF(el, filename = "评定报告.pdf") {
  const canvas = await toCanvas(el)
  const imgWidth = canvas.width
  const imgHeight = canvas.height
  const pdf = new jsPDF({
    orientation: imgWidth > imgHeight ? "landscape" : "portrait",
    unit: "px",
    format: [imgWidth + 20, imgHeight + 20],
  })
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 10, 10, imgWidth, imgHeight)
  pdf.save(filename)
}

/**
 * 导出为图片
 */
export async function exportImage(el, filename = "评定报告.png", format = "png", quality = 0.95) {
  const canvas = await toCanvas(el)
  const mime = format === "jpeg" ? "image/jpeg" : "image/png"
  const dataUrl = canvas.toDataURL(mime, quality)
  const link = document.createElement("a")
  link.download = filename
  link.href = dataUrl
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const maxPdfPages = 10;
const renderScale = 2;

export async function convertPdfToPngPages(pdfBuffer) {
  const pdf = await getDocument({
    data: pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;

  const pages = [];
  const pageCount = Math.min(pdf.numPages, maxPdfPages);

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: renderScale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, viewport.width, viewport.height);

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    pages.push({
      pngBuffer: canvas.toBuffer('image/png'),
      width: viewport.width,
      height: viewport.height,
    });
  }

  return pages;
}

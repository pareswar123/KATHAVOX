import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import PDFDocument from 'pdfkit';
import { parseDocument } from 'htmlparser2';

/** Minimal shape of the parsed HTML tree (htmlparser2 nodes). */
export interface HtmlNode {
  type: string;
  name?: string;
  data?: string;
  attribs?: Record<string, string>;
  children?: HtmlNode[];
}

export interface Run {
  text: string;
  underline: boolean;
}

export type Block =
  | { kind: 'heading'; level: 2 | 3; runs: Run[] }
  | { kind: 'paragraph'; runs: Run[] }
  | { kind: 'item'; ordered: boolean; index: number; runs: Run[] }
  | { kind: 'image'; src: string };

export interface BookPage {
  pageNumber: number;
  title: string;
  content: string;
}

export interface BookInput {
  title: string;
  description: string;
  coverImageUrl: string | null;
  authorName: string;
  categoryName: string;
  languageName: string;
  pages: BookPage[];
}

export interface BookOptions {
  /** Absolute path of the font file (must contain the story's script). */
  fontPath: string;
  /** PDFKit page size name, e.g. A4. */
  pageSize: string;
  marginMm: number;
  /** Folder that stores uploaded files; /uploads/<name> maps to <uploadDirectory>/<name>. */
  uploadDirectory: string;
}

const FONT_NAME = 'book';
const BLOCK_TAGS = new Set(['p', 'h2', 'h3', 'ul', 'ol', 'li', 'img', 'div', 'blockquote']);
const FRONT_MATTER_PAGES = 2; // cover and title/details page are not numbered

/**
 * Builds a book-style PDF: cover, title and details page, then one book page per story page.
 * Story text is the sanitized HTML from the approved snapshot, so only the allowed tags appear.
 */
export async function buildBookPdf(book: BookInput, opts: BookOptions): Promise<Buffer> {
  if (!existsSync(opts.fontPath)) {
    throw new Error(`PDF font not found: ${opts.fontPath}`);
  }
  const margin = (opts.marginMm * 72) / 25.4;

  const doc = new PDFDocument({
    size: opts.pageSize,
    margin,
    bufferPages: true,
    info: { Title: book.title, Author: book.authorName },
  });
  doc.registerFont(FONT_NAME, opts.fontPath);
  doc.font(FONT_NAME);

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const contentWidth = () => doc.page.width - margin * 2;
  const bottomLimit = () => doc.page.height - margin;
  const imagePath = (url: string | null) => (url ? join(opts.uploadDirectory, basename(url)) : null);

  // ---- 1. Cover ----
  const coverFile = imagePath(book.coverImageUrl);
  if (coverFile && existsSync(coverFile)) {
    const boxHeight = doc.page.height * 0.6;
    doc.image(coverFile, margin, margin, { fit: [contentWidth(), boxHeight], align: 'center', valign: 'center' });
    doc.y = margin + boxHeight + 24;
  } else {
    doc.y = doc.page.height * 0.3;
  }
  doc.fontSize(30).text(book.title, margin, doc.y, { width: contentWidth(), align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).text(book.authorName, { width: contentWidth(), align: 'center' });

  // ---- 2. Title and details page ----
  doc.addPage();
  doc.fontSize(26).text(book.title, { width: contentWidth(), align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).text(`By ${book.authorName}`, { width: contentWidth(), align: 'center' });
  doc.moveDown(1.5);
  doc.fontSize(12);
  doc.text(`Category: ${book.categoryName}`, { width: contentWidth() });
  doc.text(`Language: ${book.languageName}`, { width: contentWidth() });
  doc.text(`Pages: ${book.pages.length}`, { width: contentWidth() });
  doc.moveDown(1);
  if (book.description.trim()) {
    doc.fontSize(11).text(book.description.trim(), { width: contentWidth(), align: 'justify' });
  }

  // ---- 3. Story pages, one book page each ----
  const ordered = [...book.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  for (const page of ordered) {
    doc.addPage();
    doc.y = margin + 16;
    if (page.title.trim()) {
      doc.fontSize(18).text(page.title.trim(), { width: contentWidth(), align: 'center' });
      doc.moveDown(1);
    }
    doc.fontSize(12);
    const root = parseDocument(page.content) as unknown as HtmlNode;
    for (const block of blocksFrom(root.children ?? [])) {
      renderBlock(doc, block, margin, contentWidth, bottomLimit, imagePath);
    }
  }

  // ---- 4. Running header and page numbers on story pages ----
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    if (i < FRONT_MATTER_PAGES) continue;
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.fontSize(9).fillColor('#666666');
    doc.text(book.title, margin, margin / 2, { width: contentWidth(), align: 'center', lineBreak: false });
    // Thin rule under the running title.
    drawRule(doc, margin, margin - 8, contentWidth());
    // Thin rule above the page number, which stays centred in the footer.
    drawRule(doc, margin, doc.page.height - margin + 8, contentWidth());
    doc.text(String(i - FRONT_MATTER_PAGES + 1), margin, doc.page.height - margin / 2 - 6, {
      width: contentWidth(),
      align: 'center',
      lineBreak: false,
    });
    doc.page.margins.bottom = savedBottom;
    doc.fillColor('#000000');
  }
  doc.flushPages();
  doc.end();
  return done;
}

// ---------- HTML to blocks ----------

export function blocksFrom(nodes: HtmlNode[]): Block[] {
  const out: Block[] = [];
  let loose: Run[] = [];
  const flush = () => {
    if (loose.some((r) => r.text.trim())) out.push({ kind: 'paragraph', runs: loose });
    loose = [];
  };

  for (const node of nodes) {
    const name = node.name ?? '';
    if (node.type === 'text' || !BLOCK_TAGS.has(name)) {
      loose.push(...inlineRuns([node], false));
      continue;
    }
    flush();
    if (name === 'h2' || name === 'h3') {
      out.push({ kind: 'heading', level: name === 'h2' ? 2 : 3, runs: inlineRuns(node.children ?? [], false) });
    } else if (name === 'p') {
      out.push(...paragraphBlocks(node));
    } else if (name === 'ul' || name === 'ol') {
      let index = 1;
      for (const li of node.children ?? []) {
        if (li.name !== 'li') continue;
        out.push({ kind: 'item', ordered: name === 'ol', index: index++, runs: inlineRuns(li.children ?? [], false) });
      }
    } else if (name === 'img') {
      out.push({ kind: 'image', src: node.attribs?.src ?? '' });
    } else {
      // div, li, blockquote: render children as their own blocks
      out.push(...blocksFrom(node.children ?? []));
    }
  }
  flush();
  return out;
}

/** A paragraph with inline images split out so they render as their own blocks. */
function paragraphBlocks(node: HtmlNode): Block[] {
  const out: Block[] = [];
  let runs: Run[] = [];
  for (const child of node.children ?? []) {
    if (child.name === 'img') {
      if (runs.some((r) => r.text.trim())) out.push({ kind: 'paragraph', runs });
      runs = [];
      out.push({ kind: 'image', src: child.attribs?.src ?? '' });
    } else {
      runs.push(...inlineRuns([child], false));
    }
  }
  if (runs.some((r) => r.text.trim()) || out.length === 0) out.push({ kind: 'paragraph', runs });
  return out;
}

/** Text runs for inline content. Bold and italic have no separate font here, so only underline is kept. */
function inlineRuns(nodes: HtmlNode[], underline: boolean): Run[] {
  const runs: Run[] = [];
  for (const node of nodes) {
    if (node.type === 'text') {
      const text = (node.data ?? '').replace(/\s+/g, ' ');
      if (text) runs.push({ text, underline });
    } else if (node.name === 'br') {
      runs.push({ text: '\n', underline });
    } else if (node.name === 'img') {
      continue; // images are handled by the block level
    } else {
      runs.push(...inlineRuns(node.children ?? [], underline || node.name === 'u'));
    }
  }
  return runs;
}

// ---------- drawing ----------

export function renderBlock(
  doc: PDFKit.PDFDocument,
  block: Block,
  margin: number,
  contentWidth: () => number,
  bottomLimit: () => number,
  imagePath: (url: string | null) => string | null,
): void {
  const width = contentWidth();
  switch (block.kind) {
    case 'heading':
      doc.moveDown(0.6);
      doc.fontSize(block.level === 2 ? 15 : 13);
      writeRuns(doc, block.runs, { width, paragraphGap: 4 });
      doc.fontSize(12);
      return;
    case 'paragraph':
      writeRuns(doc, block.runs, { width, align: 'justify', paragraphGap: 6 });
      return;
    case 'item': {
      const marker = block.ordered ? `${block.index}. ` : '• ';
      writeRuns(doc, [{ text: marker, underline: false }, ...block.runs], { width, indent: 14, paragraphGap: 3 });
      return;
    }
    case 'image': {
      const file = imagePath(block.src);
      if (!file || !existsSync(file)) return;
      // openImage is PDFKit's internal reader; the public typings omit it, but it returns the pixel size.
      const img = (doc as unknown as { openImage(src: string): { width: number; height: number } }).openImage(file);
      const maxHeight = doc.page.height * 0.35;
      const scale = Math.min(width / img.width, maxHeight / img.height, 1);
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      if (doc.y + drawHeight > bottomLimit()) doc.addPage();
      doc.image(file, margin + (width - drawWidth) / 2, doc.y, { width: drawWidth, height: drawHeight });
      doc.y += drawHeight + 8;
      return;
    }
  }
}

/** Thin horizontal rule across the content width. */
export function drawRule(doc: PDFKit.PDFDocument, x: number, y: number, width: number): void {
  doc.save();
  doc.lineWidth(0.5).strokeColor('#999999').moveTo(x, y).lineTo(x + width, y).stroke();
  doc.restore();
}

export function writeRuns(doc: PDFKit.PDFDocument, runs: Run[], options: PDFKit.Mixins.TextOptions): void {
  const clean = runs.filter((r) => r.text.length > 0);
  if (clean.length === 0) return;
  clean.forEach((run, i) => {
    const last = i === clean.length - 1;
    doc.text(run.text, { ...options, continued: !last, underline: run.underline });
  });
}

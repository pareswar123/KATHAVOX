import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import PDFDocument from 'pdfkit';
import { parseDocument } from 'htmlparser2';
import { BookOptions, HtmlNode, blocksFrom, drawRule, renderBlock } from './book-pdf.builder';

export interface EditionPage {
  pageNumber: number;
  title: string;
  content: string;
}

export interface EditionStory {
  title: string;
  description: string;
  coverImageUrl: string | null;
  authorName: string;
  categoryName: string;
  languageName: string;
  pages: EditionPage[];
}

export interface EditionInput {
  title: string;
  description: string;
  coverImageUrl: string | null;
  stories: EditionStory[];
}

/** First and last PDF page of a story, counted from the book cover as page 1. */
export interface StoryRange {
  pageStart: number;
  pageEnd: number;
}

/** Contents rows per index page. More stories add index pages, and every page number moves with them. */
const INDEX_ROWS_PER_PAGE = 20;
const FONT = 'book';

/**
 * Book edition: cover, contents, then for each story its cover, details page and story pages.
 * Page numbers printed in the footer and in the contents are the same PDF page numbers.
 * The contents pages are reserved first and filled after the stories are laid out, so every
 * story's real page range is known before the contents are drawn.
 */
export async function buildBookEdition(book: EditionInput, opts: BookOptions): Promise<{ buffer: Buffer; ranges: StoryRange[] }> {
  if (!existsSync(opts.fontPath)) {
    throw new Error(`PDF font not found: ${opts.fontPath}`);
  }
  const margin = (opts.marginMm * 72) / 25.4;
  const doc = new PDFDocument({ size: opts.pageSize, margin, bufferPages: true, info: { Title: book.title } });
  doc.registerFont(FONT, opts.fontPath);
  doc.font(FONT);

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const contentWidth = () => doc.page.width - margin * 2;
  const bottomLimit = () => doc.page.height - margin;
  const imageFile = (url: string | null) => (url ? join(opts.uploadDirectory, basename(url)) : null);

  // ---- Page 1: book cover (the first page PDFKit creates) ----
  drawCover(doc, imageFile(book.coverImageUrl), book.title, '', margin, contentWidth, 30);

  // ---- Reserve the contents pages; they are filled in at the end ----
  const indexPages = Math.max(1, Math.ceil(book.stories.length / INDEX_ROWS_PER_PAGE));
  for (let i = 0; i < indexPages; i++) doc.addPage();

  // ---- Stories ----
  const ranges: StoryRange[] = [];
  for (const story of book.stories) {
    const startIndex = doc.bufferedPageRange().count;

    doc.addPage();
    drawCover(doc, imageFile(story.coverImageUrl), story.title, story.authorName, margin, contentWidth, 26);

    doc.addPage();
    doc.fontSize(26).text(story.title, { width: contentWidth(), align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).text(`By ${story.authorName}`, { width: contentWidth(), align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(12);
    doc.text(`Category: ${story.categoryName}`, { width: contentWidth() });
    doc.text(`Language: ${story.languageName}`, { width: contentWidth() });
    doc.text(`Pages: ${story.pages.length}`, { width: contentWidth() });
    doc.moveDown(1);
    if (story.description.trim()) {
      doc.fontSize(11).text(story.description.trim(), { width: contentWidth(), align: 'justify' });
    }

    for (const page of [...story.pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
      doc.addPage();
      doc.y = margin + 16;
      if (page.title.trim()) {
        doc.fontSize(18).text(page.title.trim(), { width: contentWidth(), align: 'center' });
        doc.moveDown(1);
      }
      doc.fontSize(12);
      const root = parseDocument(page.content) as unknown as HtmlNode;
      for (const block of blocksFrom(root.children ?? [])) {
        renderBlock(doc, block, margin, contentWidth, bottomLimit, imageFile);
      }
    }

    const endIndex = doc.bufferedPageRange().count - 1;
    ranges.push({ pageStart: startIndex + 1, pageEnd: endIndex + 1 });
  }

  // ---- Contents pages ----
  book.stories.forEach((story, i) => {
    const pageSlot = Math.floor(i / INDEX_ROWS_PER_PAGE);
    doc.switchToPage(1 + pageSlot);
    const row = i % INDEX_ROWS_PER_PAGE;
    const top = pageSlot === 0 ? margin + 90 : margin + 20;
    const y = top + row * 28;
    const rangeWidth = 110;
    doc.fontSize(12).fillColor('#000000');
    doc.text(`${i + 1}. ${story.title}`, margin, y, { width: contentWidth() - rangeWidth - 10, lineBreak: false, ellipsis: true });
    doc.text(`pages ${ranges[i].pageStart}–${ranges[i].pageEnd}`, margin + contentWidth() - rangeWidth, y, {
      width: rangeWidth,
      align: 'right',
      lineBreak: false,
    });
  });
  doc.switchToPage(1);
  doc.fontSize(22).text('Contents', margin, margin + 40, { width: contentWidth(), align: 'center', lineBreak: false });

  // ---- Running title and page numbers (not on the book cover) ----
  const range = doc.bufferedPageRange();
  for (let i = range.start + 1; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.fontSize(9).fillColor('#666666');
    drawRule(doc, margin, margin - 8, contentWidth());
    doc.text(book.title, margin, margin / 2, { width: contentWidth(), align: 'center', lineBreak: false });
    drawRule(doc, margin, doc.page.height - margin + 8, contentWidth());
    doc.text(String(i + 1), margin, doc.page.height - margin / 2 - 6, { width: contentWidth(), align: 'center', lineBreak: false });
    doc.page.margins.bottom = savedBottom;
    doc.fillColor('#000000');
  }
  doc.flushPages();
  doc.end();
  return { buffer: await done, ranges };
}

/** Cover-style page: image fitted to the top area, then title and an optional line below it. */
function drawCover(
  doc: PDFKit.PDFDocument,
  imageFile: string | null,
  title: string,
  line: string,
  margin: number,
  contentWidth: () => number,
  titleSize: number,
): void {
  let y = doc.page.height * 0.3;
  if (imageFile && existsSync(imageFile)) {
    const boxHeight = doc.page.height * 0.6;
    doc.image(imageFile, margin, margin, { fit: [contentWidth(), boxHeight], align: 'center', valign: 'center' });
    y = margin + boxHeight + 24;
  }
  doc.fontSize(titleSize).text(title, margin, y, { width: contentWidth(), align: 'center' });
  if (line) {
    doc.moveDown(0.5);
    doc.fontSize(14).text(line, { width: contentWidth(), align: 'center' });
  }
}

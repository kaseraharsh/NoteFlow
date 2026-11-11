const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const kalamRegular = path.join(__dirname, '..', 'assets', 'fonts', 'Kalam-Regular.ttf');
const kalamBold = path.join(__dirname, '..', 'assets', 'fonts', 'Kalam-Bold.ttf');

/**
 * Strips basic markdown markers for clean PDF printing
 */
function cleanMarkdownText(str) {
  if (!str) return '';
  return str
    .replace(/\*\*(.*?)\*\*/g, '$1') // remove ** bold
    .replace(/\*(.*?)\*/g, '$1')     // remove * italic
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1 ($2)');
}

/**
 * Replaces emojis with clean arrows and text symbols for PDF export ONLY.
 * Web UI keeps all original emojis intact!
 */
function replaceEmojisForPdf(str) {
  if (!str) return '';
  return str
    // Specific section markers
    .replace(/📓\s*/g, '')
    .replace(/📌\s*/g, '-> ')
    .replace(/🔄\s*/g, '-> ')
    .replace(/📸\s*/g, '-> ')
    .replace(/🖼️\s*/g, '-> ')
    .replace(/⏱️\s*/g, '-> ')
    .replace(/📝\s*/g, '-> ')
    .replace(/💡\s*/g, '-> ')
    .replace(/❓\s*/g, '? ')
    .replace(/🚀\s*/g, '-> ')
    .replace(/⚡\s*/g, '-> ')
    .replace(/🧠\s*/g, '-> ')
    .replace(/✨\s*/g, '* ')
    .replace(/🏆\s*/g, '-> ')
    .replace(/🌟\s*/g, '-> ')
    .replace(/📋\s*/g, '-> ')
    .replace(/🎯\s*/g, '-> ')
    .replace(/[✔️✅]\s*/g, '[v] ')
    // Convert common arrows to ASCII
    .replace(/↓/g, 'v')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    // Strip multi-byte unicode emojis/pictographs that cause font corruption
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\u2600-\u27BF]/g, '')
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Draws the authentic handwritten notebook paper template on every page:
 * - Warm ivory paper (#fdfbf7)
 * - Faint horizontal ruled guidelines
 * - Double red notebook left margin rule
 * - Top metallic spiral binder holes
 */
function drawNotebookBackground(doc) {
  const width = doc.page.width;
  const height = doc.page.height;

  doc.save();

  // 1. Warm Ivory Paper Fill
  doc.rect(0, 0, width, height).fill('#fdfbf7');

  // 2. Ruled horizontal guidelines
  doc.lineWidth(0.35).strokeColor('#e5e7eb');
  for (let y = 62; y < height - 38; y += 22) {
    doc.moveTo(35, y).lineTo(width - 35, y).stroke();
  }

  // 3. Double Red Left Notebook Margin Rule
  doc.lineWidth(0.8).strokeColor('#fca5a5');
  doc.moveTo(76, 0).lineTo(76, height).stroke();
  doc.lineWidth(0.4).strokeColor('#fecaca');
  doc.moveTo(79, 0).lineTo(79, height).stroke();

  // 4. Spiral Binder Spine along the top
  doc.rect(0, 0, width, 26).fill('#141722');
  doc.lineWidth(1).strokeColor('#232a3b');
  doc.moveTo(0, 26).lineTo(width, 26).stroke();

  for (let x = 45; x < width - 35; x += 32) {
    doc.circle(x, 13, 4.5).fillAndStroke('#0f172a', '#64748b');
    doc.lineWidth(1.2).strokeColor('#94a3b8');
    doc.moveTo(x - 2, 4).lineTo(x - 2, 18).stroke();
  }

  doc.restore();
}

/**
 * Generates an authentic Handwritten Study Notebook PDF from notes markdown
 */
function createNotesPDF({ title, author, videoUrl, notesMarkdown }, resStream) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 46, bottom: 45, left: 88, right: 38 },
    bufferPages: true,
    info: {
      Title: `${title || 'Video'} - NoteFlow Study Notebook`,
      Author: author || 'NoteFlow Studio',
      Subject: 'Systematic Handwritten Study Notes',
      Keywords: 'study notes, handwritten, pdf, flowcharts'
    }
  });

  doc.pipe(resStream);

  // Register Kalam TrueType fonts for genuine handwriting look
  let fontRegular = 'Helvetica';
  let fontBold = 'Helvetica-Bold';

  if (fs.existsSync(kalamRegular) && fs.existsSync(kalamBold)) {
    doc.registerFont('Handwritten', kalamRegular);
    doc.registerFont('Handwritten-Bold', kalamBold);
    fontRegular = 'Handwritten';
    fontBold = 'Handwritten-Bold';
  }

  // Automatically draw notebook styling when a new page is spawned
  doc.on('pageAdded', () => {
    drawNotebookBackground(doc);
    doc.x = 88;
  });

  // Draw notebook styling on Page 1
  drawNotebookBackground(doc);

  // Reset cursor to content area inside left margin
  doc.x = 88;
  doc.y = 44;

  const contentWidth = doc.page.width - 126;
  const cleanTitle = replaceEmojisForPdf(cleanMarkdownText(title || 'Video Study Notes'));
  const cleanAuthor = replaceEmojisForPdf(cleanMarkdownText(author || 'Instructor'));

  // Document Title Header
  doc.font(fontBold)
     .fontSize(19)
     .fillColor('#1e3a8a')
     .text('Video Study Notes', 88, doc.y, { width: contentWidth });

  doc.moveDown(0.2);

  // Video Title
  doc.font(fontBold)
     .fontSize(13)
     .fillColor('#0f172a')
     .text(cleanTitle, 88, doc.y, { width: contentWidth, lineGap: 2 });

  doc.moveDown(0.2);

  // Metadata Bar
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  doc.font(fontRegular)
     .fontSize(9)
     .fillColor('#64748b')
     .text(`Instructor: ${cleanAuthor}  |  Date: ${dateStr}  |  Handwritten Notebook Edition`, 88, doc.y, { width: contentWidth });

  doc.moveDown(0.5);
  doc.moveTo(88, doc.y).lineTo(doc.page.width - 38, doc.y).lineWidth(0.6).strokeColor('#cbd5e1').stroke();
  doc.moveDown(0.6);

  // Parse Markdown lines
  const lines = notesMarkdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check if we need space for next element
    if (doc.y > doc.page.height - 65) {
      doc.addPage();
      doc.y = 46;
    }

    if (!trimmed) {
      doc.moveDown(0.3);
      continue;
    }

    // 1. Mermaid Flowchart Code Block Handler
    if (trimmed.startsWith('```mermaid') || trimmed.startsWith('```')) {
      const chartLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        chartLines.push(lines[i].trim());
        i++;
      }

      // Extract step labels from flowchart lines
      const stepItems = [];
      chartLines.forEach(cl => {
        // Skip transition lines like Step0 --> Step1 without brackets
        if (cl.includes('-->') && !cl.includes('[')) return;

        const firstBracket = cl.indexOf('[');
        const lastBracket = cl.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket > firstBracket) {
          let inner = cl.slice(firstBracket + 1, lastBracket).trim();
          if (inner.startsWith('"') && inner.endsWith('"')) {
            inner = inner.slice(1, -1);
          }
          const stepTxt = replaceEmojisForPdf(cleanMarkdownText(inner));
          if (stepTxt && !stepItems.includes(stepTxt)) {
            stepItems.push(stepTxt);
          }
        }
      });

      if (stepItems.length > 0) {
        if (doc.y > doc.page.height - 180) {
          doc.addPage();
          doc.y = 46;
        }

        doc.moveDown(0.3);
        const cardWidth = doc.page.width - 126;

        // Flowchart Header
        doc.font(fontBold)
           .fontSize(11)
           .fillColor('#0284c7')
           .text('-> VISUAL PROCESS FLOWCHART & ARCHITECTURE', 88, doc.y);

        doc.moveDown(0.5);

        stepItems.forEach((step, sIdx) => {
          const isOutcome = sIdx === stepItems.length - 1 && stepItems.length > 1;

          doc.font(fontRegular).fontSize(10);
          const textWidth = cardWidth - 28;
          const textHeight = doc.heightOfString(step, { width: textWidth, lineGap: 2 });
          const boxHeight = Math.max(32, textHeight + 14);

          if (doc.y + boxHeight + 25 > doc.page.height - 45) {
            doc.addPage();
            doc.y = 46;
          }

          const stepY = doc.y;

          doc.save();
          if (isOutcome) {
            // Final outcome card (warm subtle gold)
            doc.roundedRect(88, stepY, cardWidth, boxHeight, 4)
               .fillAndStroke('#fef9c3', '#eab308');
            doc.font(fontBold).fontSize(10).fillColor('#854d0e')
               .text(step, 88 + 14, stepY + (boxHeight - textHeight) / 2, {
                 width: textWidth,
                 align: 'center',
                 lineGap: 2
               });
          } else {
            // Flowchart Step Box (identical to website preview: light gray #f3f4f6, slate border #94a3b8, centered text)
            doc.roundedRect(88, stepY, cardWidth, boxHeight, 4)
               .fillAndStroke('#f3f4f6', '#94a3b8');
            doc.font(fontRegular).fontSize(10).fillColor('#0f172a')
               .text(step, 88 + 14, stepY + (boxHeight - textHeight) / 2, {
                 width: textWidth,
                 align: 'center',
                 lineGap: 2
               });
          }
          doc.restore();

          doc.y = stepY + boxHeight;

          // Draw downward vector arrow connecting steps (charcoal slate #475569 matching website preview)
          if (sIdx < stepItems.length - 1) {
            const arrowX = 88 + cardWidth / 2;
            const arrowY = doc.y + 2;
            doc.save();
            doc.lineWidth(1.2).strokeColor('#475569');
            doc.moveTo(arrowX, arrowY).lineTo(arrowX, arrowY + 16).stroke();
            doc.polygon([arrowX - 4, arrowY + 11], [arrowX + 4, arrowY + 11], [arrowX, arrowY + 17])
               .fill('#475569');
            doc.restore();
            doc.y = arrowY + 22;
          }
        });

        doc.moveDown(0.4);
      }
      continue;
    }

    // 2. Post-it Sticky Note Callout Handler (> 📌 or > 💡 or >)
    if (trimmed.startsWith('>')) {
      const cleanNote = replaceEmojisForPdf(cleanMarkdownText(trimmed.replace(/^>\s*/, '')));
      if (doc.y > doc.page.height - 65) {
        doc.addPage();
        doc.y = 46;
      }

      const stickyY = doc.y;
      const stickyWidth = doc.page.width - 126;

      doc.save();
      // Post-it Yellow Card
      doc.roundedRect(88, stickyY, stickyWidth, 38, 4)
         .fillAndStroke('#fef08a', '#eab308');

      // Top Translucent Adhesive Tape Strip
      doc.roundedRect(88 + stickyWidth / 2 - 25, stickyY - 4, 50, 9, 2)
         .fillAndStroke('#fef9c3', '#cbd5e1');

      doc.font(fontBold)
         .fontSize(9)
         .fillColor('#854d0e')
         .text('-> STICKY NOTE: ', 98, stickyY + 8, { continued: true });

      doc.font(fontRegular)
         .fontSize(9)
         .fillColor('#713f12')
         .text(cleanNote.length > 95 ? cleanNote.slice(0, 95) + '...' : cleanNote, { width: stickyWidth - 20 });

      doc.restore();
      doc.y = stickyY + 44;
      continue;
    }

    // 3. Horizontal Rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      doc.moveDown(0.2);
      doc.moveTo(88, doc.y).lineTo(doc.page.width - 38, doc.y).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
      doc.moveDown(0.4);
      continue;
    }

    // 4. Heading 1 (#)
    if (trimmed.startsWith('# ')) {
      const headingText = replaceEmojisForPdf(cleanMarkdownText(trimmed.replace(/^#\s+/, '')));
      if (doc.y > doc.page.height - 70) {
        doc.addPage();
        doc.y = 46;
      }
      doc.moveDown(0.4);
      doc.font(fontBold)
         .fontSize(15)
         .fillColor('#1e3a8a')
         .text(headingText, 88, doc.y, { width: contentWidth });
      doc.moveDown(0.2);
      continue;
    }

    // 5. Heading 2 (##)
    if (trimmed.startsWith('## ')) {
      const headingText = replaceEmojisForPdf(cleanMarkdownText(trimmed.replace(/^##\s+/, '')));
      if (doc.y > doc.page.height - 65) {
        doc.addPage();
        doc.y = 46;
      }
      doc.moveDown(0.5);
      doc.font(fontBold)
         .fontSize(12)
         .fillColor('#1d4ed8')
         .text(headingText, 88, doc.y, { width: contentWidth });
      doc.moveDown(0.2);
      continue;
    }

    // 6. Heading 3 (###) - includes Visual Slides
    if (trimmed.startsWith('### ')) {
      const headingText = replaceEmojisForPdf(cleanMarkdownText(trimmed.replace(/^###\s+/, '')));
      if (doc.y > doc.page.height - 55) {
        doc.addPage();
        doc.y = 46;
      }
      doc.moveDown(0.3);

      const isSlide = headingText.toLowerCase().includes('visual slide') || headingText.toLowerCase().includes('visual frame');
      if (isSlide) {
        doc.font(fontBold)
           .fontSize(10)
           .fillColor('#047857')
           .text(`[SLIDE RECONSTRUCTION] ${headingText}`, 88, doc.y, { width: contentWidth });
      } else {
        doc.font(fontBold)
           .fontSize(10)
           .fillColor('#0f172a')
           .text(headingText, 88, doc.y, { width: contentWidth });
      }

      doc.moveDown(0.2);
      continue;
    }

    // 7. Bullet points (- or * or •)
    if (/^[-*•]\s+/.test(trimmed)) {
      const rawBullet = cleanMarkdownText(trimmed.replace(/^[-*•]\s+/, ''));
      const bulletContent = replaceEmojisForPdf(rawBullet);
      
      // Check for timestamp marker like [01:23]
      const timestampMatch = bulletContent.match(/^(\[\d{1,2}:\d{2}(?::\d{2})?\])\s*(.*)/);

      if (doc.y > doc.page.height - 45) {
        doc.addPage();
        doc.y = 46;
      }

      if (timestampMatch) {
        const timeBadge = timestampMatch[1];
        const restText = timestampMatch[2];

        // Check if there is a concept title like "Concept Title: Description"
        const tagColonMatch = restText.match(/^([A-Za-z0-9\s&/-]{3,45}):\s*(.*)/);

        if (tagColonMatch) {
          const conceptTag = tagColonMatch[1];
          const descText = tagColonMatch[2];

          doc.font(fontBold).fontSize(9).fillColor('#b45309')
             .text(`* ${timeBadge} `, 96, doc.y, { continued: true });
          doc.font(fontBold).fontSize(9).fillColor('#1e3a8a')
             .text(`${conceptTag}: `, { continued: true });
          doc.font(fontRegular).fontSize(9).fillColor('#1e293b')
             .text(descText, { width: contentWidth - 20, align: 'left', lineGap: 2 });
        } else {
          doc.font(fontBold).fontSize(9).fillColor('#b45309')
             .text(`* ${timeBadge} `, 96, doc.y, { continued: true });
          doc.font(fontRegular).fontSize(9).fillColor('#1e293b')
             .text(restText, { width: contentWidth - 20, align: 'left', lineGap: 2 });
        }
      } else {
        const isMarginNote = bulletContent.toLowerCase().includes('handwritten margin note') || bulletContent.toLowerCase().includes('important');
        if (isMarginNote) {
          doc.font(fontBold).fontSize(9).fillColor('#dc2626')
             .text(`* ${bulletContent}`, 96, doc.y, { width: contentWidth - 20, align: 'left', lineGap: 2 });
        } else {
          doc.font(fontRegular).fontSize(9).fillColor('#1e293b')
             .text(`* ${bulletContent}`, 96, doc.y, { width: contentWidth - 20, align: 'left', lineGap: 2 });
        }
      }

      doc.moveDown(0.2);
      continue;
    }

    // 8. Numbered list items (1. 2.)
    const numberedMatch = trimmed.match(/^(\d+\.)\s+(.*)/);
    if (numberedMatch) {
      const numPrefix = numberedMatch[1];
      const restText = replaceEmojisForPdf(cleanMarkdownText(numberedMatch[2]));

      if (doc.y > doc.page.height - 45) {
        doc.addPage();
        doc.y = 46;
      }
      
      doc.font(fontBold).fontSize(9).fillColor('#1e3a8a')
         .text(`${numPrefix} `, 96, doc.y, { continued: true });
      doc.font(fontRegular).fontSize(9).fillColor('#1e293b')
         .text(restText, { width: contentWidth - 20, align: 'left', lineGap: 2 });
      doc.moveDown(0.2);
      continue;
    }

    // 9. Standard paragraph text & Section Sub-Headings
    const isSectionLabel = trimmed.startsWith('**Section Detailed Summary:**') ||
                           trimmed.startsWith('**Key Highlighted Concepts') ||
                           trimmed.startsWith('**Section Takeaway');
    const cleanPara = replaceEmojisForPdf(cleanMarkdownText(trimmed));
    if (cleanPara) {
      if (doc.y > doc.page.height - 45) {
        doc.addPage();
        doc.y = 46;
      }

      if (isSectionLabel) {
        doc.moveDown(0.2);
        doc.font(fontBold)
           .fontSize(10)
           .fillColor('#0369a1')
           .text(`-> ${cleanPara}`, 88, doc.y, { width: contentWidth });
        doc.moveDown(0.2);
      } else {
        doc.font(fontRegular)
           .fontSize(9.5)
           .fillColor('#1e293b')
           .text(cleanPara, 88, doc.y, { width: contentWidth, align: 'left', lineGap: 2 });
        doc.moveDown(0.3);
      }
    }
  }

  // Safety Footers: Temporarily reset bottom margin so doc.text never triggers extra blank pages
  const totalPages = doc.bufferedPageRange().count;
  for (let p = 0; p < totalPages; p++) {
    doc.switchToPage(p);
    const oldBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.moveTo(88, doc.page.height - 30)
       .lineTo(doc.page.width - 38, doc.page.height - 30)
       .lineWidth(0.4)
       .strokeColor('#cbd5e1')
       .stroke();

    doc.font(fontRegular)
       .fontSize(8)
       .fillColor('#64748b')
       .text(
         'NoteFlow Studio  |  Handwritten Notebook Edition',
         88,
         doc.page.height - 22,
         { lineBreak: false }
       );

    doc.font(fontRegular)
       .fontSize(8)
       .fillColor('#64748b')
       .text(
         `Page ${p + 1} of ${totalPages}`,
         doc.page.width - 150,
         doc.page.height - 22,
         {
           width: 112,
           align: 'right',
           lineBreak: false
         }
       );

    doc.page.margins.bottom = oldBottom;
  }

  doc.end();
}

module.exports = {
  createNotesPDF
};

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function generatePDF() {
  const markdownPath = path.join(__dirname, '..', 'reports', 'Forensic_Tax_Audit_Report_2026-01-26.md');
  const pdfPath = path.join(__dirname, '..', 'reports', 'Forensic_Tax_Audit_Report_2026-01-26.pdf');

  // Read markdown content
  const markdown = fs.readFileSync(markdownPath, 'utf-8');

  // Convert markdown to HTML (simple conversion)
  const html = convertMarkdownToHTML(markdown);

  // Launch puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Set content
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // Generate PDF
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm'
    },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size:8px; color:#666; width:100%; text-align:center; padding:5px;">Forensic Tax Audit Report - Confidential</div>',
    footerTemplate: '<div style="font-size:8px; color:#666; width:100%; text-align:center; padding:5px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
  });

  await browser.close();

  console.log('PDF generated successfully:', pdfPath);
  return pdfPath;
}

function convertMarkdownToHTML(markdown) {
  let html = markdown;

  // Convert headers
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^#### (.*$)/gm, '<h4>$1</h4>');

  // Convert bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Convert italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Convert code blocks
  html = html.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Convert blockquotes
  html = html.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');

  // Convert horizontal rules
  html = html.replace(/^---$/gm, '<hr>');

  // Convert tables
  html = convertTables(html);

  // Convert lists
  html = html.replace(/^- (.*)$/gm, '<li>$1</li>');
  html = html.replace(/^(\d+)\. (.*)$/gm, '<li>$2</li>');

  // Wrap consecutive li elements in ul
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Convert line breaks
  html = html.replace(/\n\n/g, '</p><p>');

  // Wrap in styled document
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Forensic Tax Audit Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      max-width: 100%;
      margin: 0;
      padding: 0;
      font-size: 11px;
    }

    h1 {
      color: #1a1a2e;
      border-bottom: 3px solid #8b5cf6;
      padding-bottom: 10px;
      font-size: 24px;
      margin-top: 0;
    }

    h2 {
      color: #2d2d44;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
      font-size: 18px;
      margin-top: 25px;
      page-break-after: avoid;
    }

    h3 {
      color: #4a4a6a;
      font-size: 14px;
      margin-top: 20px;
      page-break-after: avoid;
    }

    h4 {
      color: #6366f1;
      font-size: 12px;
      margin-top: 15px;
      page-break-after: avoid;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 10px;
      page-break-inside: avoid;
    }

    th {
      background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
      color: white;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
    }

    td {
      padding: 8px 12px;
      border-bottom: 1px solid #e5e7eb;
    }

    tr:nth-child(even) {
      background-color: #f9fafb;
    }

    tr:hover {
      background-color: #f3f4f6;
    }

    blockquote {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px 20px;
      margin: 20px 0;
      font-style: italic;
      color: #92400e;
    }

    code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
    }

    pre {
      background: #1a1a2e;
      color: #e5e7eb;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
    }

    pre code {
      background: none;
      color: inherit;
    }

    ul, ol {
      margin: 10px 0;
      padding-left: 25px;
    }

    li {
      margin: 5px 0;
    }

    hr {
      border: none;
      border-top: 2px solid #e5e7eb;
      margin: 30px 0;
    }

    strong {
      color: #1a1a2e;
    }

    .executive-summary {
      background: linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%);
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }

    .recommendation {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
      page-break-inside: avoid;
    }

    .priority-medium {
      border-left: 4px solid #f59e0b;
    }

    .priority-low {
      border-left: 4px solid #10b981;
    }

    .priority-high {
      border-left: 4px solid #ef4444;
    }

    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      h2 {
        page-break-before: auto;
      }

      table, blockquote, .recommendation {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
}

function convertTables(html) {
  const tableRegex = /\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)+)/g;

  return html.replace(tableRegex, (match, headerRow, bodyRows) => {
    const headers = headerRow.split('|').filter(h => h.trim()).map(h => `<th>${h.trim()}</th>`).join('');
    const rows = bodyRows.trim().split('\n').map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });
}

generatePDF().catch(console.error);

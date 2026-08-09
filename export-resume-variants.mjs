#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.split('=');
    return [k, v ?? true];
  })
);

const format = String(args.get('--format') || 'letter').toLowerCase();
const date = String(args.get('--date') || new Date().toISOString().slice(0, 10));

if (!['letter', 'a4'].includes(format)) {
  console.error(`Invalid --format=${format}. Use letter or a4.`);
  process.exit(1);
}

const fullInput = resolve(__dirname, 'output', 'brian-current-resume.v2.input.json');
const recruiterInput = resolve(__dirname, 'output', 'brian-recruiter-v5.input.json');

if (!existsSync(fullInput)) {
  console.error(`Missing full resume input JSON: ${fullInput}`);
  process.exit(1);
}

if (!existsSync(recruiterInput)) {
  console.error(`Missing recruiter resume input JSON: ${recruiterInput}`);
  process.exit(1);
}

const outputs = {
  fullHtml: resolve(__dirname, 'output', `brian-full-${date}.html`),
  recruiterHtml: resolve(__dirname, 'output', `brian-recruiter-${date}.html`),
  fullOrderedHtml: resolve(__dirname, 'output', `brian-full-${date}.ordered.html`),
  recruiterOrderedHtml: resolve(__dirname, 'output', `brian-recruiter-${date}.ordered.html`),
  fullPdf: resolve(__dirname, 'output', `brian-full-${date}.pdf`),
  recruiterPdf: resolve(__dirname, 'output', `brian-recruiter-${date}.pdf`),
};

runNode(['build-cv-html.mjs', fullInput, outputs.fullHtml]);
runNode(['build-cv-html.mjs', recruiterInput, outputs.recruiterHtml]);

normalizeAndOrder(outputs.fullHtml, outputs.fullOrderedHtml);
normalizeAndOrder(outputs.recruiterHtml, outputs.recruiterOrderedHtml);

runNode(['generate-pdf.mjs', outputs.fullOrderedHtml, outputs.fullPdf, `--format=${format}`, '--allow-reorder']);
runNode(['generate-pdf.mjs', outputs.recruiterOrderedHtml, outputs.recruiterPdf, `--format=${format}`, '--allow-reorder']);

console.log('\nResume export complete:');
console.log(`- Recruiter cut PDF: ${outputs.recruiterPdf}`);
console.log(`- Full version PDF:  ${outputs.fullPdf}`);

function runNode(argsList) {
  const result = spawnSync('node', argsList, {
    cwd: __dirname,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function normalizeAndOrder(inputPath, outputPath) {
  let html = readFileSync(inputPath, 'utf8');

  // Keep accent consistent and avoid hardcoded purple tones.
  html = html.replace(/hsl\(270,\s*70%,\s*45%\)/g, 'var(--accent-color)');

  // Ensure title line is present under the candidate name.
  if (!html.includes('class="header-subtitle"')) {
    html = html.replace(
      '<h1>Brian Sodano</h1>',
      '<h1>Brian Sodano</h1>\n    <div class="header-subtitle">VP / Senior Director Engineering | AI-Enabled Engineering | Platform at Scale</div>'
    );

    html = html.replace(
      '.header-gradient {',
      '.header-subtitle {\n    font-family: var(--font-family);\n    font-size: 12px;\n    font-weight: 600;\n    color: var(--accent-color);\n    margin-bottom: 8px;\n    line-height: 1.25;\n  }\n\n  .header-gradient {'
    );
  }

  html = reorderSections(html);
  writeFileSync(outputPath, html);
}

function reorderSections(html) {
  const mkExp = '  <!-- WORK EXPERIENCE -->';
  const mkProj = '  <!-- PROJECTS -->';
  const mkEdu = '  <!-- EDUCATION -->';
  const mkComm = '  <!-- CERTIFICATIONS -->';
  const mkPrev = '  <!-- SKILLS -->';
  const footer = '</div>\n</body>\n</html>';

  const exp = findBlock(html, mkExp, mkProj);
  const proj = findBlock(html, mkProj, mkEdu);
  const edu = findBlock(html, mkEdu, mkComm);
  const comm = findBlock(html, mkComm, mkPrev);
  const prev = findBlock(html, mkPrev, footer);

  if (!exp || !proj || !edu || !comm || !prev) return html;

  let out = html.slice(0, exp.start);
  out += proj.text + '\n' + exp.text + '\n' + prev.text + '\n' + comm.text + '\n' + edu.text;
  out += html.slice(prev.end);
  return out;
}

function findBlock(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  if (start < 0) return null;
  const end = src.indexOf(endMarker, start);
  if (end < 0) return null;
  return { start, end, text: src.slice(start, end) };
}

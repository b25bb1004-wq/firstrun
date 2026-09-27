#!/usr/bin/env node
/**
 * Render all title cards to PNG using headless Chrome
 * Uses the Windows Chrome binary via WSL interop
 * Output must go to a Windows path (C:\tmp\...)
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const CHROME_PATH = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';
const CARDS_DIR = path.resolve('docs/pitch/cards');
const WIN_OUTPUT_DIR = 'C:\\tmp\\chrome-screenshots';
const OUTPUT_DIR = path.resolve('docs/pitch/cards');

const CARDS = [
  '01-hook.html',
  '02-real-run.html',
  '03-windows-console.html',
  '04-ibm-bob.html',
  '05-four-surfaces.html',
  'agent-harvey.html',
  'agent-unity.html',
  'agent-mach.html',
  'agent-drbo.html',
  'agent-larp.html',
  'agent-echo.html',
  'bob-cost-template.html',
];

function toWinPath(wsPath) {
  // Convert /home/dev/firstrun2/... to C:\home\dev\firstrun2\...
  // Actually Chrome in WSL can read Linux paths for input but needs Windows paths for output
  return wsPath.replace('/home/dev', 'C:\\home\\dev').replace(/\//g, '\\');
}

async function renderCard(htmlFile) {
  const inputPath = path.join(CARDS_DIR, htmlFile);
  const outputName = htmlFile.replace('.html', '.png');
  const winOutputPath = `${WIN_OUTPUT_DIR}\\${outputName}`;
  const finalOutputPath = path.join(OUTPUT_DIR, outputName);

  const fileUrl = `file://${inputPath}`;

  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
      `--screenshot=${winOutputPath}`,
      fileUrl,
    ];

    const child = spawn(CHROME_PATH, args, {
      stdio: 'pipe',
    });

    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', async (code) => {
      if (code === 0) {
        // Copy from Windows temp to our output dir
        try {
          await fs.cp(`/mnt/c/tmp/chrome-screenshots/${outputName}`, finalOutputPath);
          console.log(`✓ Rendered ${outputName}`);
          resolve(finalOutputPath);
        } catch (err) {
          console.error(`✗ Failed to copy ${outputName}:`, err.message);
          reject(err);
        }
      } else {
        console.error(`✗ Failed to render ${htmlFile} (exit ${code}): ${stderr}`);
        reject(new Error(`Chrome exited with code ${code}: ${stderr}`));
      }
    });

    setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Timeout rendering ${htmlFile}`));
    }, 30000);
  });
}

async function createContactSheet() {
  const cardFiles = CARDS.map(f => f.replace('.html', '.png'));
  const outputPath = path.join(OUTPUT_DIR, 'contact-sheet.png');
  const winOutputPath = `${WIN_OUTPUT_DIR}\\contact-sheet.png`;

  // Create a simple HTML contact sheet and render it
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 3840px;
      height: 2160px;
      background: #f4e9dc;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(3, 1fr);
      gap: 0;
      padding: 40px;
    }
    .card {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border: 2px solid #b9aa9c;
      border-radius: 8px;
    }
  </style>
</head>
<body>
${cardFiles.map(f => `<img class="card" src="file:///mnt/c/tmp/chrome-screenshots/${f}" alt="${f}">`).join('\n')}
</body>
</html>
`;

  const contactHtmlPath = path.join(OUTPUT_DIR, 'contact-sheet.html');
  await fs.writeFile(contactHtmlPath, html);

  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=3840,2160',
      `--screenshot=${winOutputPath}`,
      `file://${contactHtmlPath}`,
    ];

    const child = spawn(CHROME_PATH, args, { stdio: 'pipe' });

    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', async (code) => {
      if (code === 0) {
        try {
          await fs.cp(`/mnt/c/tmp/chrome-screenshots/contact-sheet.png`, outputPath);
          console.log('✓ Created contact-sheet.png');
          resolve(outputPath);
        } catch (err) {
          console.error('✗ Failed to copy contact sheet:', err.message);
          reject(err);
        }
      } else {
        console.error(`✗ Failed to create contact sheet (exit ${code}): ${stderr}`);
        reject(new Error(`Chrome exited with code ${code}: ${stderr}`));
      }
    });

    setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Timeout creating contact sheet'));
    }, 30000);
  });
}

async function main() {
  console.log('Rendering title cards...\n');

  // Render all cards
  for (const card of CARDS) {
    try {
      await renderCard(card);
    } catch (err) {
      console.error(`Failed to render ${card}:`, err.message);
      process.exit(1);
    }
  }

  console.log('\nCreating contact sheet...');
  await createContactSheet();

  console.log('\n✓ All cards rendered successfully!');
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
import path from 'node:path';
import { startPreview, launchChrome, ensureDir, TMP_DIR } from './verify-lib.ts';

async function main() {
  const preview = await startPreview(4174);
  const { context, userDataDir } = await launchChrome({ enableWebmcp: false, headless: true });
  const page = await context.newPage();
  await page.goto(preview.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  ensureDir(TMP_DIR);
  const out = path.join(TMP_DIR, 'snapshot-desktop.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log('saved', out);
  await context.close();
  preview.stop();
  const fs = await import('node:fs');
  fs.rmSync(userDataDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import path from 'node:path';
import fs from 'node:fs';
import { launchChrome, ensureDir, APP_ROOT, LIVE_URL } from './verify-lib.ts';

async function main() {
  const dest = path.join(APP_ROOT, 'docs', 'screenshots');
  ensureDir(dest);
  const { context, userDataDir } = await launchChrome({ enableWebmcp: false, headless: true });
  const page = await context.newPage();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(LIVE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const desktop = path.join(dest, 'desktop.png');
  await page.screenshot({ path: desktop, fullPage: false });
  console.log('saved', desktop);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(LIVE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const mobile = path.join(dest, 'mobile.png');
  await page.screenshot({ path: mobile, fullPage: false });
  console.log('saved', mobile);

  await context.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

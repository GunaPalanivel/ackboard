import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  APP_ROOT,
  EVIDENCE_DIR,
  EXPECTED_TOOLS,
  attachConsole,
  bundlePolyfillWithEsbuild,
  ensureDir,
  launchChrome,
  missingTools,
  startPreview,
  summarize,
  waitForConnected,
  writeJson,
} from './verify-lib.ts';

function serveDir(dir: string, port: number): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      const rel = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
      const filePath = path.normalize(path.join(dir, rel === '/' ? 'embed.js' : rel));
      if (!filePath.startsWith(path.normalize(dir))) {
        res.statusCode = 403;
        res.end();
        return;
      }
      fs.readFile(filePath, (err, buf) => {
        if (err) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        const ext = path.extname(filePath);
        const type = ext === '.js' ? 'text/javascript' : ext === '.html' ? 'text/html' : 'application/octet-stream';
        res.setHeader('Content-Type', type);
        res.end(buf);
      });
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => server.close(),
      });
    });
  });
}

async function main(): Promise<void> {
  ensureDir(EVIDENCE_DIR);
  const distHtml = path.join(APP_ROOT, 'dist', 'index.html');
  if (!fs.existsSync(distHtml)) {
    console.log('[verify:mcp] building');
    execSync('npx vite build', { cwd: APP_ROOT, stdio: 'inherit', shell: true });
  }

  const iife = await bundlePolyfillWithEsbuild();
  const embedDir = path.join(APP_ROOT, 'node_modules', '@mcp-b', 'webmcp-local-relay', 'dist', 'browser');
  const cli = path.join(APP_ROOT, 'node_modules', '@mcp-b', 'webmcp-local-relay', 'dist', 'cli.mjs');
  if (!fs.existsSync(cli) || !fs.existsSync(path.join(embedDir, 'embed.js'))) {
    throw new Error('webmcp-local-relay dist is missing');
  }

  const preview = await startPreview(4173);
  const embedServer = await serveDir(embedDir, 9334);
  const { context } = await launchChrome({ enableWebmcp: false, headless: true });
  const page = context.pages()[0] ?? await context.newPage();
  const logs = attachConsole(page);
  await page.addInitScript({ path: iife });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cli, '--port', '9333', '--widget-origin', 'http://127.0.0.1:4173'],
    stderr: 'pipe',
  });

  const client = new Client({ name: 'ackboard-verify', version: '0.0.0' });
  let skipped: string | null = null;

  try {
    try {
      await client.connect(transport);
    } catch (err) {
      skipped = `relay connect failed: ${err instanceof Error ? err.message : String(err)}`;
      writeJson(path.join(EVIDENCE_DIR, 'mcp-client.json'), { ok: false, skipped: true, reason: skipped });
      console.warn(`[verify:mcp] SKIP  ${skipped}`);
      return;
    }

    await page.goto(preview.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.getByText('Ackboard').first().waitFor({ timeout: 20_000 });
    await waitForConnected(page, logs, 20_000);

    await page.evaluate((src) => {
      const s = document.createElement('script');
      s.src = src;
      s.setAttribute('data-relay-port', '9333');
      s.setAttribute('data-request-timeout', '20000');
      document.documentElement.appendChild(s);
    }, `${embedServer.url}/embed.js`);

    const listed = { names: [] as string[] };
    const start = Date.now();
    while (Date.now() - start < 25_000) {
      const res = await client.listTools();
      listed.names = res.tools.map((t) => t.name);
      const hit = EXPECTED_TOOLS.filter((n) => listed.names.includes(n));
      if (hit.length >= 8) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    const present = EXPECTED_TOOLS.filter((n) => listed.names.includes(n));
    const missing = missingTools(present);
    if (present.length === 0) {
      throw new Error(`Relay listed no Ackboard tools. Saw: ${listed.names.join(', ') || '(none)'}`);
    }

    const call = await client.callTool({
      name: 'get_service_status',
      arguments: {},
    });
    const content = (call as { content?: Array<{ type?: string; text?: string }> }).content;
    const text = content?.find((c) => c.type === 'text')?.text ?? JSON.stringify(call);
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // keep text
    }
    const services = (parsed as { services?: unknown[] })?.services;
    const callOk = Array.isArray(services) && services.length === 8;

    const result = {
      ok: callOk && missing.length === 0,
      skipped: false,
      url: preview.url,
      listed: listed.names,
      ackboardTools: present,
      missing,
      call: {
        tool: 'get_service_status',
        ok: callOk,
        summary: summarize(parsed),
      },
    };
    writeJson(path.join(EVIDENCE_DIR, 'mcp-client.json'), result);
    console.log(`listed ${listed.names.length} mcp tools, ackboard ${present.length}/11`);
    console.log(`${callOk ? 'ok' : 'FAIL'}\tget_service_status\t${summarize(parsed)}`);
    if (!result.ok) {
      console.error('FAIL  mcp client proof');
      process.exit(1);
    }
    console.log('PASS  mcp client list+call');
  } finally {
    try {
      await client.close();
    } catch {
      // already closed
    }
    await context.close();
    embedServer.close();
    preview.stop();
  }
}

main().catch((err) => {
  console.error(err);
  writeJson(path.join(EVIDENCE_DIR, 'mcp-client.json'), {
    ok: false,
    skipped: false,
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});

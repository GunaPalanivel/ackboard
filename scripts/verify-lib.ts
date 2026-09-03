import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type BrowserContext, type Page } from 'playwright';

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(APP_ROOT, '..');
export const EVIDENCE_DIR = path.join(REPO_ROOT, '.idea', 'evidence');
export const TMP_DIR = path.join(APP_ROOT, '.tmp');

export const LIVE_URL = process.env.ACKBOARD_TARGET_URL || 'https://ackboard.vercel.app';
export const CONNECTED_BANNER = 'WebMCP connected, 11 tools registered';

export const EXPECTED_TOOLS = [
  'get_service_status',
  'search_logs',
  'analyze_error_patterns',
  'get_metrics',
  'compare_metrics',
  'get_deployments',
  'create_incident',
  'update_incident',
  'execute_runbook_step',
  'generate_incident_report',
  'suggest_remediation',
] as const;

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeJson(file: string, data: unknown): void {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

export function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

function writeChromeProfile(userDataDir: string, enableWebmcp: boolean): void {
  ensureDir(path.join(userDataDir, 'Default'));
  fs.writeFileSync(path.join(userDataDir, 'First Run'), '');
  const localState = {
    browser: {
      enabled_labs_experiments: enableWebmcp
        ? ['enable-webmcp-testing@1', 'enable-webmcp-testing']
        : [],
    },
  };
  fs.writeFileSync(path.join(userDataDir, 'Local State'), JSON.stringify(localState));
}

export async function launchChrome(opts: {
  enableWebmcp: boolean;
  headless?: boolean;
}): Promise<{ context: BrowserContext; userDataDir: string }> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ackboard-chrome-'));
  writeChromeProfile(userDataDir, opts.enableWebmcp);

  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--disable-dev-shm-usage',
  ];
  if (opts.enableWebmcp) {
    args.push('--enable-features=WebMCP', '--enable-blink-features=WebMCP');
  } else {
    args.push('--disable-features=WebMCP');
  }

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const launchOpts = {
    headless: opts.headless ?? true,
    args,
    viewport: { width: 1440, height: 900 } as const,
  };

  try {
    const context = await chromium.launchPersistentContext(userDataDir, {
      ...launchOpts,
      channel: 'chrome',
    });
    return { context, userDataDir };
  } catch (err) {
    if (!fs.existsSync(chromePath)) throw err;
    const context = await chromium.launchPersistentContext(userDataDir, {
      ...launchOpts,
      executablePath: chromePath,
    });
    return { context, userDataDir };
  }
}

export function attachConsole(page: Page): string[] {
  const logs: string[] = [];
  page.on('console', (msg) => {
    logs.push(msg.text());
  });
  page.on('pageerror', (err) => {
    logs.push(`pageerror: ${err.message}`);
  });
  return logs;
}

export function bannerSeen(logs: string[]): boolean {
  return logs.some((line) => line.includes(CONNECTED_BANNER));
}

export async function waitForConnected(page: Page, logs: string[], timeoutMs = 20_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (bannerSeen(logs)) return true;
    const n = await page.locator('text=WebMCP connected').count();
    if (n > 0) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return bannerSeen(logs);
}

export async function readModelContextProbe(page: Page): Promise<{
  documentModelContext: boolean;
  navigatorModelContext: boolean;
  hasGetTools: boolean;
  hasExecuteTool: boolean;
  hasTestingShim: boolean;
  userAgent: string;
  chromeVersion: string | null;
}> {
  return page.evaluate(() => {
    const docCtx = (document as Document & { modelContext?: { getTools?: unknown; executeTool?: unknown } }).modelContext;
    const nav = navigator as Navigator & {
      modelContext?: unknown;
      modelContextTesting?: unknown;
      userAgent: string;
    };
    const ua = nav.userAgent;
    const m = ua.match(/Chrome\/([\d.]+)/);
    return {
      documentModelContext: Boolean(docCtx),
      navigatorModelContext: Boolean(nav.modelContext),
      hasGetTools: typeof docCtx?.getTools === 'function',
      hasExecuteTool: typeof docCtx?.executeTool === 'function',
      hasTestingShim: Boolean(nav.modelContextTesting),
      userAgent: ua,
      chromeVersion: m ? m[1] : null,
    };
  });
}

export async function listPageTools(page: Page): Promise<Array<{
  name: string;
  description?: string;
  annotations?: unknown;
}>> {
  return page.evaluate(async () => {
    const ctx = (document as Document & {
      modelContext?: {
        getTools?: () => Promise<Array<{ name: string; description?: string; annotations?: unknown }>>;
      };
    }).modelContext;
    const nav = navigator as Navigator & {
      modelContextTesting?: { listTools?: () => Array<{ name: string; description?: string }> };
    };
    if (ctx && typeof ctx.getTools === 'function') {
      const tools = await ctx.getTools();
      return tools.map((t) => ({
        name: t.name,
        description: t.description,
        annotations: t.annotations ?? null,
      }));
    }
    if (nav.modelContextTesting?.listTools) {
      return nav.modelContextTesting.listTools();
    }
    throw new Error('No getTools or modelContextTesting.listTools on this page');
  });
}

export type ParsedToolResult = {
  raw: unknown;
  structuredContent: Record<string, unknown> | null;
  data: unknown;
  isError: boolean;
};

export function parseToolResult(raw: unknown): ParsedToolResult {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { text: raw };
    }
  }
  const obj = parsed !== null && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  const structured = obj && obj['structuredContent'] && typeof obj['structuredContent'] === 'object'
    ? obj['structuredContent'] as Record<string, unknown>
    : null;
  const content = obj?.['content'];
  const first = Array.isArray(content) ? content[0] as { text?: string } | undefined : undefined;
  let data: unknown = structured;
  if (!data && typeof first?.text === 'string') {
    try {
      data = JSON.parse(first.text);
    } catch {
      data = { text: first.text };
    }
  }
  if (!data) data = parsed;
  return {
    raw,
    structuredContent: structured,
    data,
    isError: Boolean(obj?.['isError']),
  };
}

export async function callPageTool(page: Page, name: string, args: Record<string, unknown> = {}): Promise<ParsedToolResult> {
  const raw = await page.evaluate(async ({ name, args }) => {
    const ctx = (document as Document & {
      modelContext?: {
        getTools?: () => Promise<Array<{ name: string }>>;
        executeTool?: (tool: unknown, input: string) => Promise<unknown>;
      };
    }).modelContext;
    const nav = navigator as Navigator & {
      modelContextTesting?: {
        executeTool?: (name: string, input: string) => Promise<unknown>;
      };
    };
    if (ctx && typeof ctx.getTools === 'function' && typeof ctx.executeTool === 'function') {
      const tools = await ctx.getTools();
      const tool = tools.find((t) => t.name === name);
      if (!tool) throw new Error(`Tool not registered: ${name}`);
      return await ctx.executeTool(tool, JSON.stringify(args));
    }
    if (nav.modelContextTesting?.executeTool) {
      return await nav.modelContextTesting.executeTool(name, JSON.stringify(args));
    }
    throw new Error('No executeTool surface on this page');
  }, { name, args });
  return parseToolResult(raw);
}

export async function clickConfirm(page: Page, action: 'Approve' | 'Decline'): Promise<void> {
  const btn = page.getByRole('button', { name: action });
  await btn.waitFor({ state: 'visible', timeout: 15_000 });
  await btn.click();
}

export function waitForHttp(url: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
        } else {
          setTimeout(tick, 250);
        }
      });
    };
    tick();
  });
}

export function killTree(child: ChildProcess): void {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

export async function startPreview(port = 4173): Promise<{ url: string; stop: () => void }> {
  const child = spawn(
    'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: APP_ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: true },
  );
  const url = `http://127.0.0.1:${port}/`;
  try {
    await waitForHttp(url);
  } catch (err) {
    killTree(child);
    throw err;
  }
  return {
    url,
    stop: () => killTree(child),
  };
}

export function ensurePolyfillIife(): string {
  ensureDir(TMP_DIR);
  const outfile = path.join(TMP_DIR, 'mcpb-global.iife.js');
  const packaged = path.join(APP_ROOT, 'node_modules', '@mcp-b', 'global', 'dist', 'index.iife.js');
  if (!fs.existsSync(packaged)) {
    throw new Error('Missing @mcp-b/global dist/index.iife.js. Run npm install.');
  }
  fs.copyFileSync(packaged, outfile);
  return outfile;
}

export async function bundlePolyfillWithEsbuild(): Promise<string> {
  const esbuild = await import('esbuild');
  ensureDir(TMP_DIR);
  const outfile = path.join(TMP_DIR, 'mcpb-global.iife.js');
  const packaged = path.join(APP_ROOT, 'node_modules', '@mcp-b', 'global', 'dist', 'index.iife.js');
  await esbuild.build({
    entryPoints: [packaged],
    outfile,
    bundle: false,
    logLevel: 'silent',
  });
  return outfile;
}

export function summarize(data: unknown, max = 180): string {
  try {
    const text = JSON.stringify(data);
    return text.length > max ? `${text.slice(0, max)}...` : text;
  } catch {
    return String(data);
  }
}

export function missingTools(names: string[]): string[] {
  return EXPECTED_TOOLS.filter((n) => !names.includes(n));
}

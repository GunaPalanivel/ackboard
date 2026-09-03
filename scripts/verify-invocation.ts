import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  APP_ROOT,
  EVIDENCE_DIR,
  EXPECTED_TOOLS,
  attachConsole,
  bannerSeen,
  bundlePolyfillWithEsbuild,
  callPageTool,
  clickConfirm,
  ensureDir,
  launchChrome,
  listPageTools,
  missingTools,
  readModelContextProbe,
  startPreview,
  summarize,
  waitForConnected,
  writeJson,
  type ParsedToolResult,
} from './verify-lib.ts';

type CallRow = {
  tool: string;
  ok: boolean;
  structuredContent: boolean;
  isError: boolean;
  summary: string;
  error?: string;
};

function row(tool: string, parsed: ParsedToolResult, ok: boolean): CallRow {
  return {
    tool,
    ok,
    structuredContent: parsed.structuredContent !== null,
    isError: parsed.isError,
    summary: summarize(parsed.data ?? parsed.raw),
  };
}

async function main(): Promise<void> {
  ensureDir(EVIDENCE_DIR);
  console.log('[verify:invoke] building');
  execSync('npx vite build', { cwd: APP_ROOT, stdio: 'inherit', shell: true });

  const iife = await bundlePolyfillWithEsbuild();
  const preview = await startPreview(4173);
  const { context } = await launchChrome({ enableWebmcp: false, headless: true });
  const page = context.pages()[0] ?? await context.newPage();
  const logs = attachConsole(page);
  await page.addInitScript({ path: iife });

  const calls: CallRow[] = [];
  let tools: string[] = [];
  let screenshotModal = '';
  let screenshotAfter = '';

  try {
    await page.goto(preview.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.getByText('Ackboard').first().waitFor({ timeout: 20_000 });
    const connected = await waitForConnected(page, logs, 20_000);
    const probe = await readModelContextProbe(page);

    if (!connected && !bannerSeen(logs) && !probe.documentModelContext && !probe.navigatorModelContext) {
      throw new Error('Polyfill did not install modelContext');
    }

    const listed = await listPageTools(page);
    tools = listed.map((t) => t.name);
    const missing = missingTools(tools);
    if (missing.length > 0) {
      throw new Error(`Missing tools after polyfill register: ${missing.join(', ')}`);
    }

    const status = await callPageTool(page, 'get_service_status', {});
    const statusObj = status.data as { services?: Array<{ name: string; status: string }> };
    const statusOk = Array.isArray(statusObj?.services)
      && statusObj.services.length === 8
      && statusObj.services.some((s) => s.name === 'payment-gateway');
    calls.push(row('get_service_status', status, statusOk));

    const logsResult = await callPageTool(page, 'search_logs', {
      service: 'payment-gateway',
      query: 'signature',
      severity: 'error',
      limit: 20,
    });
    const logsObj = logsResult.data as { totalMatches?: number; entries?: unknown[] };
    const logsOk = (logsObj?.totalMatches ?? 0) > 0 && Array.isArray(logsObj?.entries);
    calls.push(row('search_logs', logsResult, logsOk));

    const deploys = await callPageTool(page, 'get_deployments', {
      service: 'payment-gateway',
      limit: 10,
    });
    const deployList = Array.isArray(deploys.data)
      ? deploys.data as Array<{ id?: string; changelog?: string }>
      : (deploys.structuredContent?.['rows'] as Array<{ id?: string; changelog?: string }> | undefined)
        ?? (deploys.data as { rows?: Array<{ id?: string; changelog?: string }> })?.rows
        ?? [];
    const deploysOk = deployList.some(
      (d) => d.id === 'deploy_incident_root' || String(d.changelog ?? '').toLowerCase().includes('chrony'),
    );
    calls.push(row('get_deployments', deploys, deploysOk));

    const ideas = await callPageTool(page, 'suggest_remediation', { service: 'payment-gateway' });
    const ideasObj = ideas.data as { suggestions?: unknown[] };
    const ideasOk = Array.isArray(ideasObj?.suggestions);
    calls.push(row('suggest_remediation', ideas, ideasOk));

    const declinePromise = callPageTool(page, 'create_incident', {
      title: 'verify decline path',
      severity: 'P3-Medium',
      affectedServices: ['payment-gateway'],
      description: 'Automated decline check. Not a real incident.',
    });
    await clickConfirm(page, 'Decline');
    const declined = await declinePromise;
    const declinedObj = declined.data as { status?: string };
    const declineOk = declinedObj?.status === 'cancelled' && !declined.isError;
    calls.push(row('create_incident (decline)', declined, declineOk));

    const createPromise = callPageTool(page, 'create_incident', {
      title: 'P1 payment-gateway signature failures (verify harness)',
      severity: 'P1-Critical',
      affectedServices: ['payment-gateway'],
      description: 'Opened by the invocation harness after the triage read chain.',
    });
    await page.getByRole('dialog').waitFor({ timeout: 15_000 });
    screenshotModal = path.join(EVIDENCE_DIR, 'invocation-modal.png');
    await page.screenshot({ path: screenshotModal, fullPage: true });
    await clickConfirm(page, 'Approve');
    const created = await createPromise;
    const createdObj = created.data as { status?: string; incident?: { id?: string } };
    const createOk = createdObj?.status === 'created' && Boolean(createdObj.incident);
    calls.push(row('create_incident (approve)', created, createOk));

    const runbookPromise = callPageTool(page, 'execute_runbook_step', {
      runbookId: 'rb-general-restart',
      stepIndex: 0,
    });
    await clickConfirm(page, 'Approve');
    const runbook = await runbookPromise;
    const runbookObj = runbook.data as { status?: string };
    const runbookOk = runbookObj?.status === 'completed' || runbookObj?.status === 'skipped';
    calls.push(row('execute_runbook_step (approve)', runbook, Boolean(runbookOk) && runbookObj?.status === 'completed'));

    screenshotAfter = path.join(EVIDENCE_DIR, 'invocation.png');
    await page.screenshot({ path: screenshotAfter, fullPage: true });

    const failed = calls.filter((c) => !c.ok);
    const result = {
      ok: failed.length === 0 && tools.length === EXPECTED_TOOLS.length,
      url: preview.url,
      chromeVersion: probe.chromeVersion,
      polyfill: true,
      nativeDocumentModelContext: probe.documentModelContext,
      navigatorModelContext: probe.navigatorModelContext,
      hasGetTools: probe.hasGetTools,
      hasExecuteTool: probe.hasExecuteTool,
      banner: connected || bannerSeen(logs),
      tools,
      missing,
      calls,
      writeGate: {
        declineReturnsCancelled: declineOk,
        createApproved: createOk,
        runbookApproved: runbookObj?.status === 'completed',
      },
      screenshots: { modal: screenshotModal, after: screenshotAfter },
      consoleLines: logs.filter((l) => l.includes('[Ackboard]') || l.toLowerCase().includes('webmcp')),
    };

    writeJson(path.join(EVIDENCE_DIR, 'invocation.json'), result);
    console.log(`tools ${tools.length}/11`);
    for (const c of calls) {
      console.log(`${c.ok ? 'ok' : 'FAIL'}\t${c.tool}\tstructured=${c.structuredContent}\t${c.summary}`);
    }
    console.log(`wrote ${path.join(EVIDENCE_DIR, 'invocation.json')}`);

    if (!result.ok) {
      console.error(`FAIL  ${failed.length} invocation check(s) failed`);
      process.exit(1);
    }
    console.log('PASS  polyfill invocation chain');
  } finally {
    await context.close();
    preview.stop();
  }
}

main().catch((err) => {
  console.error(err);
  writeJson(path.join(EVIDENCE_DIR, 'invocation.json'), {
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});

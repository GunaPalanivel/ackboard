import path from "node:path";
import {
  EVIDENCE_DIR,
  LIVE_URL,
  CONNECTED_BANNER,
  attachConsole,
  bannerSeen,
  ensureDir,
  launchChrome,
  listPageTools,
  missingTools,
  readModelContextProbe,
  waitForConnected,
  writeJson,
} from "./verify-lib.ts";

const target = process.argv[2] ?? LIVE_URL;

type RegResult = {
  ok: boolean;
  url: string;
  chromeVersion: string | null;
  userAgent: string;
  headless: boolean;
  documentModelContext: boolean;
  navigatorModelContext: boolean;
  hasGetTools: boolean;
  hasExecuteTool: boolean;
  banner: boolean;
  bannerText: string;
  tools: string[];
  missing: string[];
  consoleLines: string[];
  screenshot: string;
  notes: string[];
};

async function runOnce(headless: boolean): Promise<RegResult> {
  const notes: string[] = [];
  const { context } = await launchChrome({ enableWebmcp: true, headless });
  const page = context.pages()[0] ?? (await context.newPage());
  const logs = attachConsole(page);

  try {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.getByText("Ackboard").first().waitFor({ timeout: 20_000 });
    const connected = await waitForConnected(page, logs, 20_000);
    const probe = await readModelContextProbe(page);

    let tools: string[] = [];
    if (probe.hasGetTools) {
      try {
        const listed = await listPageTools(page);
        tools = listed.map((t) => t.name);
      } catch (err) {
        notes.push(
          `getTools threw: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    ensureDir(EVIDENCE_DIR);
    const screenshot = path.join(EVIDENCE_DIR, "registration.png");
    await page.screenshot({ path: screenshot, fullPage: true });

    const missing = missingTools(tools);
    const banner = connected || bannerSeen(logs);
    const listedOk = probe.hasGetTools
      ? tools.length === 11 && missing.length === 0
      : true;
    const ok = probe.documentModelContext && banner && listedOk;

    return {
      ok,
      url: target,
      chromeVersion: probe.chromeVersion,
      userAgent: probe.userAgent,
      headless,
      documentModelContext: probe.documentModelContext,
      navigatorModelContext: probe.navigatorModelContext,
      hasGetTools: probe.hasGetTools,
      hasExecuteTool: probe.hasExecuteTool,
      banner,
      bannerText: CONNECTED_BANNER,
      tools,
      missing,
      consoleLines: logs.filter(
        (l) => l.includes("[Ackboard]") || l.toLowerCase().includes("webmcp")
      ),
      screenshot,
      notes,
    };
  } finally {
    await context.close();
  }
}

async function main(): Promise<void> {
  ensureDir(EVIDENCE_DIR);
  let result = await runOnce(true);
  if (!result.documentModelContext || !result.banner) {
    console.warn("[verify:reg] headless miss, retrying headed");
    try {
      result = await runOnce(false);
    } catch (err) {
      result.notes.push(
        `headed retry failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  const out = path.join(EVIDENCE_DIR, "registration.json");
  writeJson(out, result);

  console.log(
    `chrome ${result.chromeVersion ?? "unknown"}  headless=${result.headless}`
  );
  console.log(
    `document.modelContext=${result.documentModelContext}  banner=${result.banner}`
  );
  if (result.tools.length > 0) {
    console.log(`tools ${result.tools.length}/11: ${result.tools.join(", ")}`);
  }
  for (const line of result.consoleLines) console.log(`console  ${line}`);
  console.log(`wrote ${out}`);
  console.log(`wrote ${result.screenshot}`);

  if (!result.documentModelContext) {
    console.error("FAIL  native document.modelContext was not present");
    process.exit(1);
  }
  if (!result.banner) {
    console.error(`FAIL  did not see "${CONNECTED_BANNER}"`);
    process.exit(1);
  }
  if (result.tools.length > 0 && result.missing.length > 0) {
    console.error(`FAIL  missing tools: ${result.missing.join(", ")}`);
    process.exit(1);
  }
  console.log("PASS  native WebMCP registration");
}

main().catch((err) => {
  console.error(err);
  const fallback = {
    ok: false,
    url: target,
    error: err instanceof Error ? err.message : String(err),
  };
  try {
    writeJson(path.join(EVIDENCE_DIR, "registration.json"), fallback);
  } catch {
    // ignore
  }
  process.exit(1);
});

import fs from "node:fs";
import path from "node:path";
import {
  EVIDENCE_DIR,
  EXPECTED_TOOLS,
  LIVE_URL,
  ensureDir,
  readJson,
} from "./verify-lib.ts";

type Reg = {
  ok?: boolean;
  chromeVersion?: string | null;
  documentModelContext?: boolean;
  navigatorModelContext?: boolean;
  hasGetTools?: boolean;
  hasExecuteTool?: boolean;
  banner?: boolean;
  tools?: string[];
  missing?: string[];
  headless?: boolean;
  url?: string;
  notes?: string[];
  error?: string;
};

type CallRow = {
  tool: string;
  ok: boolean;
  structuredContent: boolean;
  isError?: boolean;
  summary: string;
};

type Inv = {
  ok?: boolean;
  chromeVersion?: string | null;
  polyfill?: boolean;
  tools?: string[];
  calls?: CallRow[];
  writeGate?: {
    declineReturnsCancelled?: boolean;
    createApproved?: boolean;
    runbookApproved?: boolean;
  };
  url?: string;
  error?: string;
};

type Mcp = {
  ok?: boolean;
  skipped?: boolean;
  reason?: string;
  ackboardTools?: string[];
  missing?: string[];
  listed?: string[];
  call?: { tool: string; ok: boolean; summary: string };
  error?: string;
};

function mark(v: boolean | undefined): string {
  if (v === true) return "Pass";
  if (v === false) return "FAIL";
  return "Not run";
}

function reuseSentence(
  reg: Reg | null,
  inv: Inv | null,
  mcp: Mcp | null,
  chrome: string
): string {
  const bits: string[] = [];
  if (reg?.ok && reg.documentModelContext && reg.banner) {
    bits.push(
      `Tool registration verified in Chrome ${chrome} with the WebMCP flag on ${LIVE_URL}: \`document.modelContext\` was present, \`getTools()\` returned all ${EXPECTED_TOOLS.length} tools, and the console printed \`WebMCP connected, 11 tools registered\``
    );
  }
  if (inv?.ok) {
    bits.push(
      "Tool discovery and invocation verified through the model-context surface: `get_service_status`, `search_logs`, `get_deployments`, and `suggest_remediation` returned `structuredContent`; Decline on `create_incident` returned `{ status: cancelled }`; Approve created a ticket; Approve on `execute_runbook_step` completed a step"
    );
  }
  if (mcp?.ok) {
    bits.push(
      "The same 11 tools plus `get_service_status` were listed and called over the MCP wire via `@mcp-b/webmcp-local-relay`"
    );
  }
  if (bits.length === 0) {
    return "Automated agent verification did not pass. Do not claim a working agent client until it does. ChatGPT Atlas was not part of this pass.";
  }
  return `${bits.join(". ")}. ChatGPT Atlas was not part of this pass.`;
}

function main(): void {
  ensureDir(EVIDENCE_DIR);
  const reg = readJson<Reg>(path.join(EVIDENCE_DIR, "registration.json"));
  const inv = readJson<Inv>(path.join(EVIDENCE_DIR, "invocation.json"));
  const mcp = readJson<Mcp>(path.join(EVIDENCE_DIR, "mcp-client.json"));
  const date = new Date().toISOString().slice(0, 10);
  const chrome = (reg?.chromeVersion ?? inv?.chromeVersion ?? "152").replace(
    /\.0\.0$/,
    ""
  );

  const callTable = (inv?.calls ?? [])
    .map(
      (c) =>
        `| ${c.tool} | ${c.ok ? "ok" : "FAIL"} | ${
          c.structuredContent ? "yes" : "no"
        } | ${c.summary.replace(/\|/g, "/")} |`
    )
    .join("\n");

  const mcpLine = !mcp
    ? "Not run."
    : mcp.skipped
    ? `Skipped. ${mcp.reason ?? mcp.error ?? ""}`.trim()
    : `${mark(Boolean(mcp.ok))}. Relay listed ${
        (mcp.listed ?? []).length
      } tools, Ackboard ${(mcp.ackboardTools ?? []).length}/11. Call ${
        mcp.call?.tool ?? "?"
      }: ${mcp.call?.ok ? "ok" : "FAIL"}.`;

  const body = `# Agent verification

Date: ${date}. Chrome: ${chrome}. Live URL: ${LIVE_URL}.

## Sentence to reuse

${reuseSentence(reg, inv, mcp, chrome)}

## Proof 1: native registration

${
  reg
    ? `${mark(Boolean(reg.ok))}. Headless=${String(
        reg.headless
      )}. \`document.modelContext\`=${String(
        reg.documentModelContext
      )}. Banner=${String(reg.banner)}. getTools=${String(
        reg.hasGetTools
      )}. executeTool=${String(reg.hasExecuteTool)}.
Tools listed: ${(reg.tools ?? []).length}/${EXPECTED_TOOLS.length}${
        (reg.missing ?? []).length
          ? ` (missing ${reg.missing?.join(", ")})`
          : ""
      }.
${reg.error ? `Error: ${reg.error}` : ""}
${(reg.notes ?? []).map((n) => `Note: ${n}`).join("\n")}
Reproduce: \`npm run verify:reg\``.trim()
    : "Not run."
}

## Proof 2: invocation chain

${
  inv
    ? `${mark(Boolean(inv.ok))}. Preview: ${inv.url ?? ""}.
Write gate: decline cancelled=${String(
        inv.writeGate?.declineReturnsCancelled
      )}, create approved=${String(
        inv.writeGate?.createApproved
      )}, runbook approved=${String(inv.writeGate?.runbookApproved)}.
${inv.error ? `Error: ${inv.error}` : ""}

| tool | ok | structuredContent | summary |
| --- | --- | --- | --- |
${callTable || "| (no calls) | | | |"}

Reproduce: \`npm run verify:invoke\``.trim()
    : "Not run."
}

## Stretch: MCP client

${mcpLine}

Reproduce: \`npm run verify:mcp\`

## Atlas (manual, still yours)

Not run from this harness. Do not write Atlas into Devpost until you have done this:

1. Open ChatGPT desktop, in-app browser (Atlas).
2. Go to ${LIVE_URL}. No login.
3. DevTools console should show \`WebMCP connected, 11 tools registered\`. Header badge: WebMCP connected.
4. Paste: \`Triage the payment-gateway errors. Check health, search logs for signature failures, look at recent deploys, tell me the likely cause.\`
5. Watch get_service_status / search_logs / get_deployments fire and panels pulse.
6. Paste: \`Open a P1 incident for this and show me the rollback runbook. Do not execute a step until I approve.\`
7. Approve or Decline the modal. Note which.

If Atlas is missing on Windows, film Chrome with \`chrome://flags/#enable-webmcp-testing\` (this machine already proved that path) and keep the sentence above. Do not add Atlas.

## Commands

\`\`\`
npm run verify
npm run verify:mcp
npm run verify:report
\`\`\`
`;

  const out = path.join(EVIDENCE_DIR, "..", "AGENT-VERIFICATION.md");
  fs.writeFileSync(out, `${body.trim()}\n`);
  console.log(`wrote ${out}`);
}

main();

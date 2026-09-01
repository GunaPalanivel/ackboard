Sevboard is an incident-response workspace for on-call SREs. People click the same panels an in-browser agent can call as WebMCP tools, so a triage that used to take six clicks can finish in one turn, with a human still approving anything that writes.

## Try it

Live demo: (deploy URL lands in this paragraph after the static host is up)

Open the URL in ChatGPT Atlas, or in Chrome with `chrome://flags/#enable-webmcp-testing` enabled. There is no login. The fleet is simulated; the header says so.

```bash
npm install
npm run check
npm run dev
```

`npm run check` runs the store logic behind every read tool. It does not replace a Chrome Inspector pass.

## Tool shape

Eleven tools, grouped by job. Count is not the point. Each one has a reason it is not a flag on another tool.

Read primitives. `get_service_status` is a cheap fleet snapshot. `search_logs` returns raw lines with filters. `get_metrics` returns a time series, which is a different shape than logs. `get_deployments` lists deploys or fetches one by id, including changelog and diff stats, so a separate diff tool was cut.

Analytical. `analyze_error_patterns` clusters messages and suggests a cause. `compare_metrics` compares two windows and flags a two-sigma move. Neither is a dump of rows.

Synthesis. `suggest_remediation` joins errors, deploys, and runbooks into ranked actions. `generate_incident_report` compiles a stakeholder summary in one call instead of three.

Write, with confirmation. `create_incident`, `update_incident`, and `execute_runbook_step` keep the execute promise pending until the person in front of the page hits Approve or Decline. Decline is a structured cancel, not a crash.

## Why WebMCP

An SRE can ask the agent to pull recent payment-gateway deploys, correlate the error spike with the chrony NTP change from five days ago, and draft INC-001, in one turn. Doing that by hand is: open health, filter logs, open metrics, open deploys, expand the suspect row, open the incident form. The agent and the human share the tab, so the human sees panels pulse as tools run and can stop a rollback before it happens.

Server MCP would copy this data to a remote process. WebMCP keeps it in the page. That matches an ops console that already has the session and should not export production logs to a third box just so a model can read them.

Example call:

```json
{
  "name": "get_service_status",
  "arguments": { "service": "payment-gateway" }
}
```

The page returns JSON with status, error rate, and p99. Then `search_logs` with `query: "signature verification"` and `analyze_error_patterns` on the same service. The write path only proceeds after the modal.

Implementation lives in `src/webmcp/register-tools.ts`. Tools register on `document.modelContext` (with `navigator.modelContext` as the old alias). Annotations nest as `{ readOnlyHint, untrustedContentHint }`. `execute` accepts `{ signal }`. Unregister is `AbortController.abort` on unmount. Types come from `@mcp-b/webmcp-types`. HITL is documented in `docs/adr/0002-human-in-the-loop.md`.

## Landscape

WebKit filed `position: oppose` on 2026-06-03 (WebKit/standards-positions#670). Mozilla filed `position: neutral` (mozilla/standards-positions#1412) and has discussed the imperative API since. Chrome ships the API behind a flag and by default in ChatGPT Atlas. Turkish Airlines has WebMCP tools in production. This repo is another adoption data point on that split.

## Limits

The fleet is simulated. This repo was verified with `npm run check` and a no-WebMCP browser fallback. ChatGPT Atlas was not run here (dev machine is Windows). `requestUserInteraction()` is still an open discussion, so writes use an in-page modal.

## License

MIT. See [LICENSE](./LICENSE).

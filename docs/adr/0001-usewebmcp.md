# ADR 001: stay on imperative registerTool, skip usewebmcp

Date: 2026-09-01
Status: accepted

## Context

Alex Nahas ships `usewebmcp`, a React hook that ties tool registration to component mount. Duckboard, his showcase app, is the calibration bar for this hackathon. Adopting the hook would be a readable signal.

This app is a single-page dashboard. Tools are valid for the whole session, not a route. The Chrome imperative API (`document.modelContext.registerTool(tool, { signal })`) already matches that lifetime: one AbortController for the App effect, abort on unmount.

The hook is experimental, adds a runtime dependency during a two-day clock, and hides the exact call a Chrome engineer will look for in `src/webmcp/register-tools.ts`.

## Decision

Register tools with the imperative API and `@mcp-b/webmcp-types` (devDependency, types only). Do not add `usewebmcp`.

## Consequences

The registration file is longer. Lifecycle is explicit. A judge can read one file and see annotations, AbortSignal unregistration, and execute's `{ signal }` argument without stepping through a hook.

# ADR 002: human-in-the-loop via an in-page modal

Date: 2026-09-01
Status: accepted

## Context

Write tools (create_incident, update_incident, execute_runbook_step) must not complete a side effect until a human on the page says yes.

A proposed API, `requestUserInteraction()`, would tell the agent and the browser that the page needs the user. It is discussed in:

- https://github.com/webmachinelearning/webmcp/issues/165 (open, elicitation)
- https://github.com/webmachinelearning/webmcp/issues/21 (open, original HITL thread)

It is not on the shipping Chrome imperative API as of the 2026-08-20 docs. Those docs give `execute(input, { signal })` for cancellation, not elicitation.

Alex Nahas's public demo `creativoma/webmcp` / `demos/payment-confirmation-imperative` holds the execute promise open until the page UI resolves. That is the pattern Chrome can actually run today.

## Decision

Gate writes on `ConfirmDialog`. `execute` does not return until Approve or Decline. Decline is a structured `{ status: "cancelled" }` result, not an exception, so the agent can continue.

`gateWrite` feature-detects `ctx.requestUserInteraction`. If a future client passes that function as part of the execute extras object, the same modal is wrapped in it. If not, the modal runs directly. The branch is inert on current Chrome.

## Consequences

HITL works in ChatGPT Atlas and in Chrome with the flag, without waiting on a spec landing. When elicitation ships, we pick it up without changing the three write tools.

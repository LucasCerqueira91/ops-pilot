# Agent Tools Contract

All tools validate input with Zod and use the injected `OperationsStore`.
Unknown IDs, services, statuses, and invalid fields produce domain errors and
do not mutate state.

| Tool | Input | Result |
|---|---|---|
| `list_alerts` | `{ status: "firing" \| "resolved" \| "all" }` | Count and one readable line per matching alert: ID, service ID, severity, and title |
| `open_incident` | `{ title, service, severity }` | Newly created open incident with generated ID |
| `resolve_incident` | `{ id }` | Incident updated to resolved with resolution time |

Severity is one of `low`, `medium`, `high`, or `critical`. `service` identifies
an existing service. Resolution accepts only an existing open incident.

For the initial fixture, `list_alerts({ status: "firing" })` reports three
alerts. Exactly two are critical: `[alert-001] payment-api` and
`[alert-003] order-service`.

The shared JSON fixture defines five services and six alerts, split evenly
between firing and resolved. The JSON store is the current local operational
source of truth and persists changes; the in-memory adapter starts from an
independent fixture copy for deterministic tests. Running the seed initializes
the JSON file only when missing and preserves existing operations.

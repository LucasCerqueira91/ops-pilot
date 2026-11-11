# Agent Tools Contract

All tools validate input with Zod and use the injected `OperationsStore`.
Unknown IDs, services, statuses, and invalid fields produce domain errors and
do not mutate state.

| Tool | Input | Result |
|---|---|---|
| `list_alerts` | `{ status: "firing" \| "resolved" }` | Matching alerts with service references |
| `open_incident` | `{ title, service, severity }` | Newly created open incident with generated ID |
| `resolve_incident` | `{ id }` | Incident updated to resolved with resolution time |

Severity is one of `low`, `medium`, `high`, or `critical`. `service` identifies
an existing service. Resolution accepts only an existing open incident.

The shared fixture defines five services and six alerts, split evenly between
firing and resolved. The memory adapter starts from a fresh fixture for each
arena strategy. The MySQL seed is repeatable and only upserts records owned by
the fixture.

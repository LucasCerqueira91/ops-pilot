# Implementation Plan: Agent Reasoning Arena

**Branch**: `001-agent-reasoning-arena` (feature metadata; current checkout: `master`) | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-agent-reasoning-arena/spec.md`

## Summary

Deliver a CLI arena that compares ReAct and Plan-and-Execute against the same
operational request, returning typed traces and per-run metrics. A shared
Zod-validated tool contract operates through a store interface. The committed
JSON operations file is the current local source of truth; tests use isolated
in-memory stores seeded from the same JSON fixture. Sequelize/MySQL remains a
future adapter, not a prerequisite for the current seed or arena. All model
clients are created by one OpenRouter-backed factory. The arena launcher uses
Node.js native optional `.env` loading so local credentials are available
without an extra dependency or manual shell exports.

## Technical Context

**Language/Version**: TypeScript ESM, strict mode; Node.js 22 LTS.

**Primary Dependencies**: Existing `@langchain/core`, `@langchain/langgraph`,
`@langchain/openai`, Zod, Node.js filesystem APIs and the existing Sequelize 6
adapter. No dotenv or additional runtime dependency is required; Node's
`--env-file-if-exists` option loads the local arena configuration.

**Storage**: `OperationsStore` port with a JSON-file implementation for local
operations and an in-memory implementation for isolated deterministic tests.
The existing Sequelize/MySQL adapter is deferred and is not used by the
current seed command.

**Testing**: `node:test` through `tsx`; `npm run test` discovers
`src/**/*.test.ts`. Store and trace-format tests use no network or MySQL.

**Target Platform**: Node.js 22 LTS on the project's supported local and
server platforms.

**Project Type**: Node.js CLI and agent library; no HTTP endpoint is added by
this feature.

**Performance Goals**: No latency SLO is specified. Report elapsed time per
strategy in milliseconds and count logical model invocations.

**Constraints**: Exactly five seeded services and six alerts (three firing,
three resolved, two critical among firing); at most eight executed
Plan-and-Execute actions total;
positive iteration budget; temperature zero; no secrets in traces;
model/network calls excluded from deterministic tests; required OpenRouter
values are loaded from the process environment or optional local `.env`;
empty final model responses are reported explicitly; alert-list tool results
include a readable count and identifier/service/severity/title rows.

**Scale/Scope**: Single arena invocation, two strategies, five services, six
seed alerts, and a maximum of eight executed Plan-and-Execute tool steps.

## Constitution Check

*Gate before Phase 0: PASS.*

- **Agent-first**: Both strategies are LangGraph executions backed by the
  shared OpenRouter model factory.
- **Layer direction**: CLI/controller → agent → Zod tools/services → store.
  JSON and memory stores implement the same persistence boundary; Sequelize
  remains a deferred adapter.
- **MVC**: Persistence entities live in Models, the CLI orchestration in
  Controllers, and trace rendering in Views.
- **Validation**: Zod validates CLI options, model configuration, tool inputs,
  structured plans, and persisted records at their boundaries.
- **Errors**: Domain errors are explicit and translated to CLI output at the
  controller boundary; unexpected errors are not hidden.
- **Test-first and purity**: Store and trace formatting are covered by
  deterministic tests; pure formatting/planning transformations stay separate
  from I/O.
- **Secrets**: Model credentials come from `process.env`; do not inspect `.env`
  files, log credentials, or add dotenv.
- **Spec Kit**: Feature requirements are documented in the versioned spec.

No constitution violations or unresolved design gates were found.

## Project Structure

### Documentation

```text
specs/001-agent-reasoning-arena/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── reasoning-strategy.md
    ├── agent-tools.md
    └── arena-cli.md
```

### Source Code

```text
src/
├── arena.ts
├── controllers/
│   ├── arena-controller.ts
│   └── arena-controller.test.ts
├── agents/
│   ├── model.ts
│   ├── model.test.ts
│   ├── strategy.ts
│   ├── trace.ts
│   ├── tool.ts
│   ├── tool.test.ts
│   ├── react.ts
│   ├── react.test.ts
│   ├── plan-and-execute.ts
│   └── plan-and-execute.test.ts
├── models/
│   ├── domain.ts
│   ├── service.ts
│   ├── alert.ts
│   ├── incident.ts
│   └── models.test.ts
├── services/
│   ├── domain-errors.ts
│   └── operations.ts
├── store/
│   ├── operations-store.ts
│   ├── memory-store.ts
│   ├── sequelize-store.ts
│   ├── database.ts
│   ├── json-store.ts
│   ├── json-store.test.ts
│   ├── seed-data.json
│   ├── seed-data.ts
│   ├── seed.ts
│   ├── operations-store.test.ts
│   ├── sequelize-store.test.ts
│   └── seed.test.ts
└── views/
    ├── trace.ts
    └── trace.test.ts
```

**Structure Decision**: Keep the requested `src/agents/model.ts`,
`src/agents/tool.ts`, `src/agents/react.ts`, and
`src/agents/plan-and-execute.ts` entry points with `src/arena.ts`. Add
conventional MVC folders for controllers, views, and Sequelize models, a domain
service, and store adapters behind a single operations-store contract. Add
`npm run seed` for `src/store/seed.ts`. Tests remain under `src/` to match the
existing npm test glob.
`src/store/seed-data.json` is the canonical fixture and local JSON database.
`src/store/seed.ts` validates and initializes it without overwriting existing
operations. The in-memory adapter loads independent copies of this fixture.

## Phase 0: Research

The decisions and source links are recorded in [research.md](./research.md).
Key findings:

- Keep the requested prebuilt LangGraph ReAct API for this feature; its current
  API is deprecated in favor of `langchain`'s newer agent API, so isolate it
  behind `ReasoningStrategy` and record that migration as future work.
- Use a custom `StateGraph` for Plan-and-Execute: text-only plans, a structured
  tool executor, and a replanner with adjust/continue/finish decisions. Enforce
  an eight-action total budget across the entire graph run.
- Use the OpenRouter API base URL with a NVIDIA free model ID. The researched
  free model supports tools, structured output, and temperature; validate
  structured results with Zod regardless of provider enforcement.
- Count model invocations separately from strategy iterations and bound graph
  execution with an explicit iteration policy plus LangGraph recursion limit.
  For the two-node prebuilt ReAct loop, derive the recursion ceiling as
  `2 * maxIterations + 1` (allowing the final model turn after the last action)
  and return the trace accumulated when the ceiling is reached.
- Use a Zod-validated JSON operations file for local persistence; the seed
  command initializes only a missing file and preserves existing operations.

All design questions are resolved.

## Phase 1: Design and Contracts

- [data-model.md](./data-model.md) defines domain, trace, strategy, and
  persistence entities.
- [contracts/reasoning-strategy.md](./contracts/reasoning-strategy.md)
  defines the shared strategy and trace output contract.
- [contracts/agent-tools.md](./contracts/agent-tools.md) defines tool inputs,
  outcomes, validation, and store behavior.
- [contracts/arena-cli.md](./contracts/arena-cli.md) defines CLI arguments,
  defaults, and output/error behavior.
- [quickstart.md](./quickstart.md) defines local validation and seed scenarios.

The tests create an independently seeded in-memory store per strategy.
Production local operations use the JSON file; the MySQL adapter remains
available for future activation but is not part of the current run path.
No HTTP API is introduced.

## Constitution Check (post-design)

*Gate after Phase 1: PASS.*

- The concrete structure preserves Agent-First flow and MVC roles.
- The JSON and memory stores implement the same persistence boundary; agent
  tools never import HTTP or Sequelize models directly.
- External inputs and LLM-produced plans are Zod-validated.
- Tests require no network; live model execution is a separate manual
  quickstart scenario.
- The seed command validates and initializes the JSON database only when it is
  missing; it does not overwrite unrelated or user-created records.
- No extra project, runtime dependency, or constitution exception is required.

## Complexity Tracking

No constitution violations; no complexity exception requested.

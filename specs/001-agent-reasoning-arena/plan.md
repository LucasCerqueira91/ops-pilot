# Implementation Plan: Agent Reasoning Arena

**Branch**: `001-agent-reasoning-arena` (feature metadata; current checkout: `master`) | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-agent-reasoning-arena/spec.md`

## Summary

Deliver a CLI arena that compares ReAct and Plan-and-Execute against the same
operational request, returning typed traces and per-run metrics. A shared
Zod-validated tool contract will operate through a store interface. The arena
and deterministic tests use an explicitly seeded in-memory adapter; the
Sequelize/MySQL adapter and repeatable seed command provide persistent storage.
All model clients are created by one OpenRouter-backed factory.

## Technical Context

**Language/Version**: TypeScript ESM, strict mode; Node.js 22 LTS.

**Primary Dependencies**: Existing `@langchain/core`, `@langchain/langgraph`,
`@langchain/openai`, Zod, Sequelize 6 and mysql driver. No dotenv or additional
runtime dependency is required.

**Storage**: `OperationsStore` port with an in-memory implementation for the
mock arena and tests, plus a Sequelize/MySQL implementation for persistence
and seeding.

**Testing**: `node:test` through `tsx`; `npm run test` discovers
`src/**/*.test.ts`. Store and trace-format tests use no network or MySQL.

**Target Platform**: Node.js 22 LTS on the project's supported local and
server platforms.

**Project Type**: Node.js CLI and agent library; no HTTP endpoint is added by
this feature.

**Performance Goals**: No latency SLO is specified. Report elapsed time per
strategy in milliseconds and count logical model invocations.

**Constraints**: Exactly five seeded services and six alerts (three firing,
three resolved); at most eight planning steps; positive iteration budget;
temperature zero; no secrets in traces; model/network calls excluded from
deterministic tests.

**Scale/Scope**: Single arena invocation, two strategies, five services, six
seed alerts, and a maximum of eight plan steps.

## Constitution Check

*Gate before Phase 0: PASS.*

- **Agent-first**: Both strategies are LangGraph executions backed by the
  shared OpenRouter model factory.
- **Layer direction**: CLI/controller → agent → Zod tools/services → store.
  Sequelize models implement persistence; the arena uses the same store port
  with its isolated memory adapter.
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
`src/store/seed-data.ts` is the canonical fixture used by both adapters;
`src/store/seed.ts` is the repeatable MySQL seed entry point.

## Phase 0: Research

The decisions and source links are recorded in [research.md](./research.md).
Key findings:

- Keep the requested prebuilt LangGraph ReAct API for this feature; its current
  API is deprecated in favor of `langchain`'s newer agent API, so isolate it
  behind `ReasoningStrategy` and record that migration as future work.
- Use a custom `StateGraph` for Plan-and-Execute, with structured Zod output
  and one tool execution per plan step.
- Use the OpenRouter API base URL with a NVIDIA free model ID. The researched
  free model supports tools, structured output, and temperature; validate
  structured results with Zod regardless of provider enforcement.
- Count model invocations separately from strategy iterations and bound graph
  execution with an explicit iteration policy plus LangGraph recursion limit.
  For the two-node prebuilt ReAct loop, derive the recursion ceiling as
  `2 * maxIterations + 1` (allowing the final model turn after the last action)
  and return the trace accumulated when the ceiling is reached.
- Use an idempotent Sequelize seed scoped to stable fixture identifiers; never
  truncate arbitrary application tables.

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

The arena creates an independently seeded in-memory store per strategy so
comparison order cannot leak state between runs. The Sequelize adapter and
seed command are separate persistent-storage paths. No HTTP API is introduced.

## Constitution Check (post-design)

*Gate after Phase 1: PASS.*

- The concrete structure preserves Agent-First flow and MVC roles.
- Both store adapters implement the same persistence boundary; agent tools
  never import HTTP or Sequelize models directly.
- External inputs and LLM-produced plans are Zod-validated.
- Tests require no network; live model execution is a separate manual
  quickstart scenario.
- The seed command uses stable fixture keys and transactions, and does not
  destructively reset unrelated rows.
- No extra project, runtime dependency, or constitution exception is required.

## Complexity Tracking

No constitution violations; no complexity exception requested.

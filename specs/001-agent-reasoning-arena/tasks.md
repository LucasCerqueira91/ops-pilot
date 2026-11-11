# Tasks: Agent Reasoning Arena

**Input**: Design documents from `specs/001-agent-reasoning-arena/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: Required by the feature specification and project constitution.
Tests for the store and trace formatting MUST run deterministically without
network access.

**Organization**: Tasks are grouped by user story. Every task has an exact
file path and follows the checklist format.

## Phase 1: Setup

**Purpose**: Add the only new script entry point needed by this feature.

- [ ] T001 Add the `seed` script (`tsx src/store/seed.ts`) to the scripts section in `package.json`

## Phase 2: Foundational

**Purpose**: Establish validated domain, tracing, storage, tools, and model
configuration contracts required by all user stories.

- [ ] T002 [P] Define Zod schemas in `src/models/domain.ts` enforcing Service `id` "Stable slug; primary/unique key", `name` "Required, non-empty"; Alert `id` "Stable fixture ID or generated ID; primary key", `serviceId` "Required reference to an existing service", `title` "Required, non-empty", `status` "`firing` or `resolved`", `severity` "`low`, `medium`, `high`, or `critical`", `triggeredAt` "Required", `resolvedAt` "Required for resolved alerts; null while firing"; and Incident `id` "UUID", `title` "Required, non-empty", `serviceId` "Required reference to an existing service", `severity` "`low`, `medium`, `high`, or `critical`", `status` "`open` or `resolved`; new incidents start `open`", `createdAt` "Required", `resolvedAt` "Null while open; set on resolution"
- [ ] T003 [P] Define explicit not-found, validation, and invalid-state domain error classes in `src/services/domain-errors.ts`
- [ ] T004 [P] Define the six discriminated trace-event types and strategy input/result/metrics types in `src/agents/trace.ts` and `src/agents/strategy.ts`
- [ ] T005 Define the `OperationsStore` interface for services, filtered alerts, incident creation/resolution, and fixture upserts in `src/store/operations-store.ts` (depends on T002)
- [ ] T006 Write failing deterministic tests for fixture counts, alert filtering, incident lifecycle, invalid input, and unknown IDs in `src/store/operations-store.test.ts` (depends on T002, T005)
- [ ] T007 Implement the immutable five-service/six-alert fixture and fresh in-memory store with injectable clock/ID generation in `src/store/seed-data.ts` and `src/store/memory-store.ts` (depends on T006)
- [ ] T008 Write failing Zod tool-schema and store-delegation tests for `list_alerts`, `open_incident`, and `resolve_incident` in `src/agents/tool.test.ts` (depends on T007)
- [ ] T009 Implement the domain operations and three validated tools using the injected `OperationsStore` in `src/services/operations.ts` and `src/agents/tool.ts` (depends on T008)
- [ ] T010 [P] Write model-configuration tests for required environment values, OpenRouter base URL, configured model, and temperature zero without reading `.env` or making network calls in `src/agents/model.test.ts`
- [ ] T011 Implement the single Zod-validated `ChatOpenAI` factory using `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `https://openrouter.ai/api/v1`, and temperature zero in `src/agents/model.ts` (depends on T010)

**Checkpoint**: Shared contracts and tools are ready; deterministic tests need
no network or MySQL.

## Phase 3: User Story 1 - Comparar estratégias de raciocínio (Priority: P1) 🎯 MVP

**Goal**: Run one or both strategies on the same request and print each
strategy's result and metrics within its iteration limit.

**Independent Test**: Use injected fake models and an isolated seeded memory
store to run selected strategies over one request; assert every result includes
answer, typed trace, `llCalls`, and `latencyMs`, and no strategy exceeds its
iteration budget.

### Tests for User Story 1

- [ ] T012 [P] [US1] Write deterministic ReAct tests with a fake tool-calling model for final answers, tool execution, logical LLM-call counts, and iteration exhaustion in `src/agents/react.test.ts`
- [ ] T013 [P] [US1] Write deterministic Plan-and-Execute tests with a fake structured-output model for planning, one-step execution, replanning, completion, eight-step cap, and iteration exhaustion in `src/agents/plan-and-execute.test.ts`
- [ ] T014 [P] [US1] Write CLI/controller tests for shared request propagation, strategy selection/defaults, positive iteration limits, and invalid arguments in `src/controllers/arena-controller.test.ts`

### Implementation for User Story 1

- [ ] T015 [P] [US1] Implement the prebuilt LangGraph ReAct strategy, ordered tool/action/observation trace, callback-based logical LLM-call counting, monotonic latency, and graph safety limit in `src/agents/react.ts` (depends on T004, T009, T011, T012)
- [ ] T016 [P] [US1] Implement the Plan-and-Execute StateGraph with Zod-validated structured plans, one tool per step, replanning after each step, eight-step maximum, callback metrics, and bounded graph execution in `src/agents/plan-and-execute.ts` (depends on T004, T009, T011, T013)
- [ ] T017 [US1] Implement Zod-validated CLI parsing, strategy selection, a fresh seeded memory store per strategy, result aggregation, and the executable entry point in `src/controllers/arena-controller.ts` and `src/arena.ts` (depends on T014, T015, T016)

**Checkpoint**: Both strategies can run against the same prompt and print
separate results without sharing mutable mock state.

## Phase 4: User Story 2 - Inspecionar ações e resultados do agente (Priority: P1)

**Goal**: Present a readable, ordered trace that exposes plans, actions,
observations, critiques, and final answers without leaking secrets or hidden
chain-of-thought.

**Independent Test**: Format a fixed event sequence and compare the exact
output; verify every event type is rendered and action output includes tool
and arguments.

### Tests for User Story 2

- [ ] T018 [P] [US2] Write deterministic formatting tests for all six trace event variants, order preservation, action arguments, and secret/private-reasoning redaction in `src/views/trace.test.ts`

### Implementation for User Story 2

- [ ] T019 [US2] Implement the pure trace formatter and connect arena result rendering to it in `src/views/trace.ts` and `src/controllers/arena-controller.ts` (depends on T018, T017)

**Checkpoint**: The arena prints an ordered human-readable trace for each
strategy without logging API credentials or raw hidden reasoning.

## Phase 5: User Story 3 - Testar operações com dados reproduzíveis (Priority: P2)

**Goal**: Persist service, alert, and incident data with Sequelize/MySQL and
provide a repeatable fixture seed while keeping the in-memory tests offline.

**Independent Test**: Run the in-memory store tests without a database; with a
configured development MySQL database, execute the seed twice and verify five
services, six alerts (three firing and three resolved), no fixture duplicates,
and no deletion of unrelated records.

### Tests for User Story 3

- [ ] T020 [P] [US3] Write Sequelize-model metadata tests for required fields, status/severity enums, service foreign keys, and model associations without opening a database connection in `src/models/models.test.ts`
- [ ] T021 [P] [US3] Write seed tests proving stable fixture IDs are upserted, repeated seeding creates no duplicates, and unrelated store rows are untouched in `src/store/seed.test.ts`
- [ ] T022 [P] [US3] Write adapter tests for alert filtering, incident creation/resolution, unknown IDs, and transaction rollback using injected Sequelize model doubles in `src/store/sequelize-store.test.ts`

### Implementation for User Story 3

- [ ] T023 [P] [US3] Define typed Sequelize models and explicit foreign keys in `src/models/service.ts`, `src/models/alert.ts`, and `src/models/incident.ts`, preserving these constraints verbatim: Service `id` "Stable slug; primary/unique key", `name` "Required, non-empty"; Alert `id` "Stable fixture ID or generated ID; primary key", `serviceId` "Required reference to an existing service", `title` "Required, non-empty", `status` "`firing` or `resolved`", `severity` "`low`, `medium`, `high`, or `critical`", `triggeredAt` "Required", `resolvedAt` "Required for resolved alerts; null while firing"; Incident `id` "UUID", `title` "Required, non-empty", `serviceId` "Required reference to an existing service", `severity` "`low`, `medium`, `high`, or `critical`", `status` "`open` or `resolved`; new incidents start `open`", `createdAt` "Required", `resolvedAt` "Null while open; set on resolution" (depends on T002, T020)
- [ ] T024 [US3] Implement the Sequelize/MySQL adapter for `OperationsStore`, including filtered alert reads and transactional incident state changes, in `src/store/sequelize-store.ts` (depends on T005, T022, T023)
- [ ] T025 [US3] Implement an idempotent fixture seeder that upserts only stable service/alert IDs inside a transaction and never truncates unrelated rows in `src/store/seed.ts` (depends on T007, T021, T024)
- [ ] T026 [US3] Add Zod-validated MySQL connection configuration from process environment and ensure the seed command closes the Sequelize connection on success or failure in `src/store/database.ts` and `src/store/seed.ts` (depends on T023, T025)
- [ ] T027 [US3] Execute `npm run seed` against a configured development database and verify five services plus six alerts split three firing/three resolved; record any missing database configuration instead of substituting a success result in `src/store/seed.ts` (depends on T026)

**Checkpoint**: The persistent seed is repeatable and scoped to fixture rows;
the memory-store and trace tests remain offline.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify the implementation against the documented usage and
project quality gates.

- [ ] T028 [P] Align the default model ID, environment-variable names, MySQL prerequisites, CLI options, and seed behavior in `specs/001-agent-reasoning-arena/quickstart.md`
- [ ] T029 Run `npm run test` and `npm run typecheck`, resolve failures, and confirm the offline store/trace suites pass without credentials or network in `package.json` and `tsconfig.json`
- [ ] T030 Run the documented arena and seed scenarios where their external prerequisites are available; record actual outcomes and limitations in `specs/001-agent-reasoning-arena/quickstart.md`

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No prerequisite; adds the seed npm script.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **US1 (Phase 3)**: Depends on foundational contracts, tools, and model
  factory; delivers the MVP comparison flow.
- **US2 (Phase 4)**: Depends on the shared trace contract and US1 arena
  controller so the formatter can be connected to real results.
- **US3 (Phase 5)**: Depends on the store contract and fixture; persistence
  implementation can proceed independently from the agent graphs after the
  foundation is ready.
- **Polish (Phase 6)**: Depends on the user stories selected for delivery.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2; no dependency on another user story.
- **US2 (P1)**: Trace formatting tests can start after Phase 2. Integrating the
  formatter into arena output depends on US1 controller task T017.
- **US3 (P2)**: Starts after Phase 2. The MySQL adapter depends on shared
  `OperationsStore` and fixture contracts, not on model execution.

### Within Each User Story

- Write deterministic tests before implementing the behavior they cover.
- Complete the shared model/store/tool foundation before strategy tasks.
- ReAct and Plan-and-Execute implementations can proceed in parallel after
  their respective tests and shared foundation are complete.
- Complete both strategies before wiring arena selection and output.
- Complete model definitions before implementing the Sequelize adapter and
  seed runner.
- Run the MySQL seed only with explicit development-database configuration.

### Dependency Graph

```text
T001 → T002/T003/T004 → T005 → T006 → T007 → T008 → T009
                                             ├→ T010 → T011
                                             ├→ T012 → T015 ─┐
                                             ├→ T013 → T016 ─┴→ T017 → T019
                                             ├→ T014 ─────────┘       ↑
                                             ├→ T018 ─────────────────┘
                                             └→ T020/T021/T022 → T023 → T024 → T025 → T026 → T027
                                                                                         └→ T028-T030
```

### Parallel Opportunities

- **Foundation**: T002, T003, and T004 are independent; after T005, T006 is
  test-first for the store and model-configuration tests T010 can be developed
  independently.
- **US1**: T012, T013, and T014 are independent test files. T015 and T016 are
  separate strategy modules and can proceed in parallel after their tests.
- **US2**: T018 is independent of graph code after the common event contract
  is established; T019 must wait for T017 to connect arena output.
- **US3**: T020, T021, and T022 are separate test files and can be prepared
  after foundational types exist. T023 model definitions can proceed while
  those adapter/seed tests are being written.
- **Cross-story**: After Phase 2, US1 strategy work, US2 formatter tests, and
  US3 persistence/model work can be assigned in parallel; only US2 integration
  depends on T017.
- Do not parallelize tasks that edit the same file, or start an implementation
  before its corresponding tests have been written.

## Parallel Example: User Story 1

```text
After Phase 2:
- T012 ReAct tests in src/agents/react.test.ts
- T013 Plan-and-Execute tests in src/agents/plan-and-execute.test.ts
- T014 CLI/controller tests in src/controllers/arena-controller.test.ts

After the tests are ready:
- T015 ReAct implementation in src/agents/react.ts
- T016 Plan-and-Execute implementation in src/agents/plan-and-execute.ts
```

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Setup and Foundational tasks.
2. Complete US1 tests, both strategy implementations, and arena wiring.
3. Validate US1 with fake models and the seeded memory store; no network or
   MySQL is needed for this independent test.
4. Deliver the arena comparison MVP before adding trace presentation and
   persistent MySQL seeding.

### Incremental Delivery

1. Add US1 to compare both strategies and validate independently.
2. Add US2 readable, safe trace output and validate the exact formatter output.
3. Add US3 Sequelize persistence and repeatable MySQL seed; keep offline tests
   independent from database availability.
4. Run all tests and typecheck, then follow quickstart for live model/database
   checks only when credentials and services are configured.

### Parallel Team Strategy

After Phase 2, assign separate contributors to US1 strategy modules, US2 trace
formatting tests, and US3 Sequelize models/tests. Integrate the arena view only
after T017; integrate persistent storage and seed only after the common store
contract is stable.

## Notes

- Every task uses a checkbox, sequential task ID, applicable parallel/story
  labels, and an exact file path.
- `[P]` appears only when the file and prerequisite graph permit parallel work.
- The seed execution task is conditional on a configured development database;
  its result must be reported honestly if that prerequisite is unavailable.
- Never inspect `.env` files; use process environment configuration without
  adding dotenv.

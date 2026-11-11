# Research: Agent Reasoning Arena

## Decisions

### Prebuilt ReAct agent

- **Decision**: Use `createReactAgent` from
  `@langchain/langgraph/prebuilt`, as requested, behind the common
  `ReasoningStrategy` interface.
- **Rationale**: It is available in the project's existing LangGraph
  dependency and directly provides the requested prebuilt ReAct loop.
- **Alternatives considered**: The current LangChain docs recommend
  `createAgent` from the separate `langchain` package. That API replaces and
  deprecates `createReactAgent`, but adding the package and changing the
  requested API is not necessary for this feature. Keep the strategy boundary
  small so a later migration is isolated.
- **Sources**:
  [LangGraph `createReactAgent` reference](https://reference.langchain.com/javascript/langchain-langgraph/prebuilt/createReactAgent),
  [current LangChain agents guide](https://docs.langchain.com/oss/javascript/langchain/agents).

### Plan-and-Execute graph and structured outputs

- **Decision**: Build Plan-and-Execute as a custom `StateGraph`: planner,
  single-step executor, replanner, and finalizer. Use a Zod schema for the
  plan and validate the returned value locally.
- **Rationale**: Explicit state and conditional routing make the eight-step
  cap, per-step replan, trace collection, and iteration limit testable.
  `ChatOpenAI.withStructuredOutput()` accepts Zod-compatible schemas.
- **Alternatives considered**: A larger planning-oriented agent framework
  provides more orchestration than this bounded workflow needs.
- **Sources**:
  [LangGraph graph API](https://docs.langchain.com/oss/javascript/langgraph/graph-api),
  [LangChain structured output](https://docs.langchain.com/oss/javascript/langchain/structured-output),
  [ChatOpenAI integration](https://docs.langchain.com/oss/javascript/integrations/chat/openai).

### Iteration limits, model-call metrics, and trace

- **Decision**: Track tool/action iterations explicitly in strategy state;
  enforce a graph-level `recursionLimit` as a secondary safety bound. Count
  logical chat-model invocations through callbacks at each strategy run and
  measure duration with a monotonic clock.
- **Rationale**: Iterations represent work cycles, while planner, replanner,
  agent, final-answer, and retry calls are separate model invocations.
  LangGraph documents `recursionLimit`, and LangChain callbacks expose chat
  model start events for call accounting.
- **Alternatives considered**: Token usage is not a call count. Provider-side
  request telemetry would be required to count physical retry attempts
  exactly; the feature metric is the number of logical LangChain model runs.
- **Sources**:
  [LangGraph recursion limit](https://docs.langchain.com/oss/javascript/langgraph/graph-api#recursion-limit),
  [LangChain event streaming](https://docs.langchain.com/oss/javascript/langchain/event-streaming),
  [model parameters and retries](https://docs.langchain.com/oss/javascript/langchain/models#parameters).

### OpenRouter and NVIDIA model

- **Decision**: Configure the OpenAI-compatible client with
  `https://openrouter.ai/api/v1`, the required `OPENROUTER_API_KEY`, and
  required `OPENROUTER_MODEL`; use `temperature: 0`. The currently verified
  free NVIDIA model suitable for tools and structured planner output is
  `nvidia/nemotron-3.5-super-vl:free`.
- **Rationale**: The model and its free NVIDIA endpoint currently advertise
  tool calling, constrained/structured outputs, and temperature support.
  The `:free` suffix belongs to the model ID; it is not a base URL. Provider
  capabilities can change, so the planner still validates every output with
  Zod.
- **Alternatives considered**: `nvidia/nemotron-3.5-lightning:free` supports
  tools but its free endpoint metadata does not advertise structured outputs.
  NVIDIA's direct NIM URL is not the OpenRouter endpoint.
- **Sources**:
  [OpenRouter Chat Completions API](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion),
  [free NVIDIA model metadata](https://openrouter.ai/api/v1/model/nvidia/nemotron-3.5-super-vl:free),
  [free NVIDIA endpoint metadata](https://openrouter.ai/api/v1/models/nvidia/nemotron-3.5-super-vl:free/endpoints),
  [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs),
  [LangChain OpenRouter integration](https://docs.langchain.com/oss/javascript/integrations/chat/openrouter).

### Store adapters and seed

- **Decision**: Define one `OperationsStore` contract, an in-memory adapter
  for the arena and offline tests, and a Sequelize/MySQL adapter for persistent
  operations. Use one immutable fixture dataset for memory initialization and
  a repeatable MySQL seed that upserts only stable fixture IDs.
- **Rationale**: This preserves the requested mock/in-memory experience and
  deterministic offline tests while honoring the constitution's MySQL/
  Sequelize persistence requirement. Scoped upserts avoid deleting unrelated
  operational records; seed writes run transactionally.
- **Alternatives considered**: A single in-memory store would not satisfy
  persistent MySQL storage. Blind inserts or table-wide truncation are not
  safe repeatable seed strategies.
- **Sources**:
  [Sequelize model basics](https://sequelize.org/docs/v6/core-concepts/model-basics/),
  [Sequelize TypeScript](https://sequelize.org/docs/v6/other-topics/typescript/),
  [Sequelize associations](https://sequelize.org/docs/v6/core-concepts/assocs/),
  [Sequelize transactions](https://sequelize.org/docs/v6/other-topics/transactions/),
  [Sequelize migrations and seeders](https://sequelize.org/docs/v6/other-topics/migrations/).

### Trace safety

- **Decision**: Capture observable plans, tool calls, tool results, critiques,
  and final answers. Support the `thought` event type only for concise,
  non-sensitive operational summaries; do not capture hidden chain-of-thought
  or credentials.
- **Rationale**: Traces remain useful for debugging and evaluation without
  storing private reasoning or secrets. Event formatting is a pure function
  and has deterministic tests.
- **Alternatives considered**: Persisting every raw model message would leak
  internal reasoning and may expose sensitive content.

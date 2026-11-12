# Arena CLI Contract

## Invocation

```text
tsx src/arena.ts [--strategies react,plan-and-execute] [--max-iterations N] <request>
```

- `request` is required non-empty text and is passed unchanged to every
  selected strategy.
- `--strategies` accepts a non-empty comma-separated list containing `react`
  and/or `plan-and-execute`; when omitted, both run.
- `--max-iterations` accepts a positive integer; the initial default is 5.
- Unknown flags, empty strategy selections, unknown names, and invalid limits
  are rejected before model calls.

Each strategy receives the same request and reads the local JSON operations
store. Results print in selection order and include the strategy name, answer,
ordered trace, `llCalls`, and `latencyMs`.

## Seed command

`npm run seed` creates the local JSON store from the committed fixture when it
is missing, or validates and preserves it when it already exists. The initial
fixture contains five services and six alerts (three firing and three
resolved); two of the three firing alerts are critical.

## Configuration and errors

`OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are required. The arena launcher
loads them from the process environment or the local `.env` file using Node's
built-in env-file support. Model creation uses the OpenRouter base URL and
temperature zero. Missing values are reported before model calls. The current
local store does not require MySQL configuration. Secrets are never printed.

Input validation errors are presented as CLI usage errors. Domain errors are
presented as actionable messages. Unexpected failures exit non-zero and are
not converted to successful-looking output.

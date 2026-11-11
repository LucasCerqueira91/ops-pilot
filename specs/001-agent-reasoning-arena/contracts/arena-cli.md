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

Each strategy receives an isolated copy of the same seeded initial store.
Results print in selection order and include the strategy name, answer,
ordered trace, `llCalls`, and `latencyMs`.

## Seed command

`npm run seed` initializes/updates the five service and six alert fixture rows
in the configured development MySQL database. The operation is repeatable,
uses stable fixture IDs, and does not truncate unrelated data.

## Configuration and errors

`OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are required environment
variables. Model creation uses the OpenRouter base URL and temperature zero.
The MySQL seed requires `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`,
`MYSQL_USER`, and `MYSQL_PASSWORD`, supplied through the local runtime;
secrets are never printed.

Input validation errors are presented as CLI usage errors. Domain errors are
presented as actionable messages. Unexpected failures exit non-zero and are
not converted to successful-looking output.

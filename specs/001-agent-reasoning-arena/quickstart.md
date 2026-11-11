# Quickstart: Agent Reasoning Arena

## Prerequisites

- Node.js 22 LTS and npm dependencies installed.
- For unit tests: no network or database is required.
- For the seed command: a local development MySQL database and its connection
  settings (`MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`,
  `MYSQL_PASSWORD`) supplied through process environment variables.
- For a live arena run: `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` supplied
  through the process environment. The currently verified free NVIDIA model
  ID is `nvidia/nemotron-3.5-super-vl:free`.

Do not print secrets or inspect `.env` files. Set values through the shell or
the approved local secret manager.

## Offline validation

Run the deterministic tests and typecheck:

```sh
npm run test
npm run typecheck
```

Expected: both commands exit successfully without making model or database
network requests.

## Seed validation

Configure a development database, then run:

```sh
npm run seed
```

Expected: the seed reports five services and six fixture alerts (three firing,
three resolved). Running it again updates the same fixture rows rather than
creating duplicates or deleting unrelated records.

## Live strategy comparison

Set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` in the shell or secret manager,
then run:

```sh
npm run arena -- --strategies react,plan-and-execute --max-iterations 5 "list firing alerts"
```

Expected: both strategies receive the same request and an isolated copy of
the seeded state. Each prints an answer, ordered trace, logical model-call
count, and latency. Each Plan-and-Execute plan has at most eight steps.

## Boundary checks

- Run with an empty request, unknown strategy, or non-positive iteration
  limit: the CLI rejects it before any model call.
- Run store/trace tests with the network disabled: they still pass.
- Check that output contains no API key or raw hidden chain-of-thought.

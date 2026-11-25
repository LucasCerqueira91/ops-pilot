# Quickstart: Agent Reasoning Arena

## Prerequisites

- Node.js 22 LTS and npm dependencies installed.
- For unit tests and the local JSON seed: no network or database is required.
- For a live arena run: `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` supplied
  through the process environment or the local `.env` file. The currently
  verified free NVIDIA model ID is `nvidia/nemotron-3.5-super-vl:free`.

Do not print secrets or commit `.env`. The `arena` npm script loads `.env`
using Node.js's built-in env-file support; populate it locally or use an
approved secret manager.

The project exposes the local JSON database initializer as `npm run seed`.
It creates the database from the committed fixture when missing, validates an
existing database, and never overwrites existing incidents or operational
changes.

## Offline validation

Run the deterministic tests and typecheck:

```sh
npm run test
npm run typecheck
```

Expected: both commands exit successfully without making model or database
network requests.

## Seed validation

Run the local initializer:

```sh
npm run seed
```

Expected: the seed reports five services and six alerts (three firing, three
resolved) on first initialization. Repeated runs validate and preserve
existing records rather than resetting them.

## Live strategy comparison

Set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` in the local `.env` file or
shell, then run:

```sh
npm run arena -- "quantos alertas críticos estão disparando" --strategies react
```

Expected: ReAct uses `list_alerts` and answers that two critical alerts are
firing, listing `alert-001` on `payment-api` and `alert-003` on `order-service`.
It also prints the ordered trace, logical model-call count, and latency.
Plan-and-Execute remains available and executes at most eight tool steps total.

## Boundary checks

- Run with an empty request, unknown strategy, or non-positive iteration
  limit: the CLI rejects it before any model call.
- Run store/trace tests with the network disabled: they still pass.
- Check that output contains no API key or raw hidden chain-of-thought.
- If the provider returns no final text, the arena reports an explicit
  provider/model error instead of printing a blank successful answer.

## Validation status

The latest `npm run seed` validated the JSON database (5 services, 6 alerts,
3 incidents) and reported that existing data was preserved. The command
`npm run arena -- "quantos alertas críticos estão disparando" --strategies react`
loaded the local configuration and returned:

```text
Existem 2 alertas críticos disparando:
- [alert-001] payment-api | critical | High error rate on /checkout
- [alert-003] order-service | critical | DB connection pool exhausted
```

All 29 tests and `npm run typecheck` passed. An empty final provider response
is reported as an explicit error rather than a blank successful answer.

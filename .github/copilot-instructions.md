# OpsPilot

OpsPilot é um copiloto de plantão para gerenciar alertas e incidentes de produção. A API é um agente LangChain/LangGraph que usa OpenRouter.

## Stack e comandos

- Node.js 22 LTS; TypeScript ESM em modo strict.
- Express e MySQL. Use Zod para validar toda entrada externa nas fronteiras HTTP e CLI.
- Testes com `node:test` via `tsx`.
- Comandos definidos em [package.json](../package.json): `npm run dev`, `npm run arena`, `npm run bench`, `npm run test` e `npm run typecheck`.

## Convenções

- Organize o código em camadas MVC: Model, Service e Controller.
- Erros de domínio devem ser classes e traduzidos na borda da aplicação.
- Toda lógica nova deve nascer com teste; mantenha `test` e `typecheck` verdes.
- Prefira funções puras; isole efeitos colaterais nas bordas.
- Nunca commite segredos nem leia arquivos `.env`.

## Fluxo de desenvolvimento

Siga o Spec Kit do GitHub Copilot em quatro etapas obrigatórias e nesta ordem:

`speckit.specify` → `speckit.plan` → `speckit.tasks` → `speckit.implement`

1. `speckit.specify` — escreve ou atualiza a spec da feature em Markdown versionado em `specs/`.
2. `speckit.plan` — gera o plano de design e as decisões técnicas a partir da spec.
3. `speckit.tasks` — decompõe o plano em tarefas ordenadas por dependência.
4. `speckit.implement` — executa as tarefas, incluindo código e testes; `test` e `typecheck` devem passar antes do commit.

Specs são artefatos de primeira classe: devem ser criadas, revisadas e versionadas junto com o código. Não comece uma implementação sem uma spec aprovada.

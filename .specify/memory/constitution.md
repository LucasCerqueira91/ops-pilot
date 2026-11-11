<!--
Sync Impact Report
Version change: 2.0.0 → 2.1.0
Modified sections: Fluxo de desenvolvimento; Governance
Added sections: nenhuma
Removed sections: nenhuma
Follow-up TODO: confirmar a data original de ratificação.
-->
# OpsPilot Constitution

## Core Principles

### I. Agent-First Architecture
O núcleo do produto MUST ser um grafo LangGraph executado sobre OpenRouter.
Toda nova capacidade operacional MUST ser modelada primeiro como nó ou
ferramenta do agente. Express e MySQL são infraestrutura de suporte, não o
produto.

### II. Camadas explícitas (NON-NEGOTIABLE)
As dependências MUST fluir em uma única direção:

`HTTP/CLI → agente (grafo LangGraph) → tools/services → store`

- **HTTP/CLI:** rotas Express e validação Zod; sem lógica de negócio.
- **Agente:** grafo LangGraph, nós, edges e ferramentas; orquestra o fluxo.
- **Tools/Services:** funções de domínio chamadas pelo agente; sem dependência
  de HTTP.
- **Store:** modelos Sequelize e persistência MySQL; sem dependência de HTTP ou
  do agente.

Nenhuma camada MUST acessar uma camada anterior ou depender de detalhes de uma
camada superior.

### III. Validação na fronteira (NON-NEGOTIABLE)
Toda entrada externa — incluindo corpo e parâmetros HTTP, argumentos CLI,
variáveis de ambiente e saídas do LLM — MUST ser validada com Zod antes de
entrar no agente, domínio ou persistência.

### IV. Erros de domínio
Falhas previsíveis MUST ser representadas por classes de erro próprias,
lançadas em services/tools e traduzidas em status HTTP ou mensagens CLI na
borda.

### V. Test-First (NON-NEGOTIABLE)
Lógica nova MUST nascer com teste em `node:test`. O ciclo é: spec aprovada →
teste escrito → teste falha → implementação → teste passa. `npm run test` e
`npm run typecheck` MUST passar antes de qualquer commit.

### VI. Funções puras e imutabilidade
Prefira funções puras. Efeitos colaterais — I/O, banco de dados e chamadas ao
LLM — MUST ficar isolados nas bordas. Estado mutável MUST ser explícito e
localizado.

### VII. Sem secrets no código
Segredos e arquivos `.env` MUST NOT ser commitados. Agentes e comandos MUST
NOT ler arquivos `.env`. Use o suporte nativo `--env-file` do Node.js para
carregar variáveis; não adicione `dotenv`. O arquivo de exemplo versionado
MUST conter apenas valores vazios ou fictícios, nunca segredos.

## Stack e restrições técnicas

| Camada | Tecnologia | Restrição |
|---|---|---|
| Runtime | Node.js 22 LTS | Não reduzir a versão mínima |
| Linguagem | TypeScript ESM (`strict: true`) | `"type": "module"` obrigatório |
| Agente IA | LangChain + LangGraph → OpenRouter | Não chamar diretamente a API OpenAI |
| Validação | Zod | Única biblioteca de validação permitida |
| HTTP | Express | A camada HTTP não contém lógica de negócio |
| Persistência | Sequelize + MySQL | A store não depende de HTTP nem do agente |
| Testes | `node:test` via `tsx` | Testes executados pelo script `npm run test` |

Os scripts de desenvolvimento são os definidos em `package.json`:

- `npm run dev`
- `npm run arena`
- `npm run bench`
- `npm run test`
- `npm run typecheck`

## Fluxo de desenvolvimento

Todo trabalho MUST seguir o pipeline Spec Kit do GitHub Copilot em ordem estrita
e em quatro etapas obrigatórias:

`speckit.specify` → `speckit.plan` → `speckit.tasks` → `speckit.implement`

Specs MUST ser versionadas em `specs/` e são pré-requisito para qualquer
implementação. Cada fase MUST ser revisada por uma pessoa antes de avançar à
próxima. Nenhum código de feature pode ser escrito sem uma spec aprovada.

- `speckit.specify` escreve ou atualiza a spec da feature.
- `speckit.plan` gera o plano de design e as decisões técnicas a partir da spec.
- `speckit.tasks` decompõe o plano em tarefas ordenadas por dependência.
- `speckit.implement` executa as tarefas de implementação.

## Governance

Esta constituição tem precedência sobre qualquer outra diretriz do projeto.
Alterações MUST incluir uma nova versão e a data da alteração. Toda PR MUST
verificar conformidade com esta constituição. Para orientação operacional do
agente de codificação, consulte `.github/copilot-instructions.md`.

Alterações à constituição MUST ser documentadas, revisadas e aprovadas antes
de serem integradas. A revisão MUST confirmar que `npm run test` e
`npm run typecheck` passam. Exceções MUST ser justificadas e aprovadas junto
com a mudança.

A versão segue SemVer: MAJOR para mudanças incompatíveis nos princípios,
MINOR para novos princípios ou expansão material das diretrizes, e PATCH para
esclarecimentos sem mudança de política.

**Version**: 2.1.0 | **Ratified**: TODO(RATIFICATION_DATE): confirmar data original | **Last Amended**: 2026-11-10

# Feature Specification: Agent Reasoning Arena

**Feature Branch**: `001-agent-reasoning-arena`

**Created**: 2026-11-11

**Status**: Implementation update approved by user (2026-11-12)

**Input**: User description: "Núcleo de raciocínio do OpsPilot com estratégias ReAct e Plan-and-Execute, ferramentas para alertas e incidentes, arena para comparar estratégias e testes determinísticos sem rede."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Comparar estratégias de raciocínio (Priority: P1)

Como pessoa operadora ou desenvolvedora do OpsPilot, quero executar uma ou mais
estratégias sobre a mesma solicitação para comparar as respostas e acompanhar
como cada estratégia chegou ao resultado.

**Why this priority**: A comparação é o principal valor da arena e permite
avaliar diferentes formas de resolver uma solicitação operacional.

**Independent Test**: Executar duas estratégias para a mesma solicitação e
confirmar que cada resultado é identificado e apresenta resposta, trace e
métricas próprias.

**Acceptance Scenarios**:

1. **Given** uma solicitação e pelo menos uma estratégia selecionada,
   **When** a arena é executada, **Then** cada estratégia selecionada recebe
   exatamente a mesma solicitação.
2. **Given** estratégias selecionadas, **When** uma delas termina,
   **Then** seu resultado exibe a resposta, o trace e as métricas sem ocultar
   os resultados das demais.
3. **Given** um limite de iterações configurado, **When** uma estratégia
   alcança esse limite, **Then** ela encerra sem excedê-lo e informa o
   resultado obtido até então.
4. **Given** credenciais OpenRouter válidas no arquivo local de ambiente,
   **When** a arena é iniciada pelo comando do projeto, **Then** a configuração
   é carregada sem exigir exportação manual de variáveis.

### User Story 2 - Inspecionar ações e resultados do agente (Priority: P1)

Como pessoa operadora, quero consultar um trace estruturado para entender
quais planos, ações, observações e respostas ocorreram durante a execução.

**Why this priority**: Um histórico compreensível torna o comportamento do
agente verificável e facilita a avaliação de decisões operacionais.

**Independent Test**: Executar uma solicitação que use uma ferramenta e
verificar que o trace mantém a ordem dos eventos e os argumentos da ação.

**Acceptance Scenarios**:

1. **Given** uma execução que produz eventos, **When** o trace é exibido,
   **Then** cada evento tem um tipo reconhecido: thought, action,
   observation, plan, critique ou answer.
2. **Given** um evento action, **When** seu conteúdo é inspecionado,
   **Then** estão disponíveis o nome da ferramenta e seus argumentos.
3. **Given** uma estratégia que consulta o modelo, **When** sua execução
   termina, **Then** as métricas incluem o total de chamadas ao modelo e a
   latência em milissegundos.

### User Story 3 - Testar operações com dados reproduzíveis (Priority: P2)

Como pessoa desenvolvedora, quero testar operações sobre um conjunto inicial
conhecido de serviços e alertas para reproduzir cenários sem depender de
serviços externos.

**Why this priority**: Dados reproduzíveis permitem avaliar o fluxo operacional
e executar testes locais de forma consistente.

**Independent Test**: Inicializar o conjunto de dados padrão, consultar alertas
por estado, abrir um incidente e resolvê-lo; repetir os testes sem acesso à
rede.

**Acceptance Scenarios**:

1. **Given** o conjunto de dados inicial, **When** os serviços e alertas são
   consultados, **Then** existem cinco serviços e seis alertas, dos quais três
   estão firing e três resolved.
2. **Given** um estado de alerta válido, **When** alertas são consultados,
   **Then** apenas alertas daquele estado são retornados.
3. **Given** um serviço existente e dados válidos, **When** um incidente é
   aberto, **Then** o incidente pode ser posteriormente resolvido pelo seu
   identificador.
4. **Given** entradas inválidas para uma operação, **When** a operação é
   solicitada, **Then** a entrada é rejeitada sem alterar os dados.
5. **Given** a suíte de testes do store e do trace, **When** ela é executada,
   **Then** os resultados são determinísticos e não exigem acesso à rede.
6. **Given** dados alterados durante uma execução, **When** o comando de seed é
   executado novamente, **Then** os dados existentes são validados e
   preservados sem duplicação ou redefinição.
7. **Given** os três alertas firing do conjunto inicial, **When** a solicitação
   pergunta quantos alertas críticos estão disparando, **Then** a resposta
   identifica exatamente dois (`alert-001` e `alert-003`) e apresenta cada
   identificador, serviço, severidade e título.

### Edge Cases

- Se nenhuma estratégia for selecionada, a arena informa o erro e não inicia
  execuções.
- Se uma estratégia ou estado de alerta não for reconhecido, a solicitação é
  rejeitada com uma mensagem compreensível e sem alterar os dados.
- Se o limite de iterações for zero, negativo ou inválido, a arena rejeita a
  configuração antes de iniciar as estratégias.
- Se um incidente, serviço ou alerta solicitado não existir, a operação informa
  que o item não foi encontrado e preserva o estado.
- Se o limite de iterações for atingido antes da conclusão, a estratégia encerra
  e retorna os eventos e a resposta disponíveis, sem exceder o limite.
- Se o arquivo `.env` não existir ou não contiver as configurações obrigatórias,
  a arena informa quais variáveis precisam ser definidas e não chama o modelo.
- Se o modelo retornar uma resposta final vazia, a arena informa a falha do
  provedor em vez de apresentar uma resposta vazia como sucesso.
- Se a geração do plano produzir mais de oito passos, somente os oito
  primeiros poderão ser executados.
- Se a geração ou o ajuste do plano produzir mais passos que o orçamento
  restante, apenas os passos que cabem no limite total de oito serão executados.
- Se o seed for executado depois que a base JSON já existir, registros e
  alterações operacionais existentes serão preservados.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Toda estratégia MUST expor o mesmo contrato: nome e operação
  `run(input)`, que retorna resposta, trace tipado e métricas.
- **FR-002**: O trace MUST aceitar eventos dos tipos thought, action,
  observation, plan, critique e answer. Eventos action MUST incluir ferramenta
  e argumentos.
- **FR-003**: As métricas MUST incluir total de chamadas ao modelo (`llCalls`)
  e duração da execução em milissegundos (`latencyMs`).
- **FR-004**: O sistema MUST oferecer as estratégias ReAct e Plan-and-Execute.
- **FR-005**: A estratégia ReAct MUST poder consultar alertas, abrir incidentes
  e resolver incidentes, e MUST registrar no trace o ciclo de ações e
  observações.
- **FR-006**: A estratégia Plan-and-Execute MUST criar um plano estruturado,
  com passos curtos em texto, executar um passo por vez por meio das
  ferramentas disponíveis e revisar os passos restantes após cada execução.
- **FR-007**: A estratégia Plan-and-Execute MUST encerrar quando não houver
  passos restantes e MUST limitar a no máximo oito o total de passos
  executados durante uma execução. O replanner decide se ajusta o plano,
  continua com os passos restantes ou encerra.
- **FR-008**: Toda estratégia MUST respeitar o limite de iterações recebido e
  contabilizar todas as chamadas ao modelo que realizar, incluindo planejamento
  e replanejamento.
- **FR-009**: A arena MUST aceitar uma ou mais estratégias e uma solicitação,
  executar todas as estratégias selecionadas sobre essa mesma solicitação e
  exibir a resposta, o trace e as métricas de cada execução.
- **FR-010**: A arena MUST permitir selecionar estratégias e configurar o
  limite de iterações por opções de linha de comando `--strategies` e
  `--max-iterations`.
- **FR-011**: As ferramentas `list_alerts(status)`,
  `open_incident(title, service, severity)` e `resolve_incident(id)` MUST
  oferecer consulta de alertas por estado, abertura de incidente e resolução
  por identificador.
- **FR-012**: As entradas das ferramentas MUST ser validadas; entradas
  inválidas MUST ser rejeitadas sem modificar o estado.
- **FR-013**: O estado inicial MUST conter cinco serviços e seis alertas,
  variados entre esses serviços e com exatamente três firing e três resolved.
  Deve haver um comando local repetível de seed que valide e inicialize uma
  base JSON local quando ausente, preservando registros operacionais já salvos.
- **FR-014**: Os testes do store e da formatação do trace MUST ser determinísticos
  e executáveis sem chamadas de rede.
- **FR-015**: A arena MUST rejeitar uma seleção vazia ou estratégias
  desconhecidas e MUST rejeitar limites de iteração inválidos antes de iniciar
  execuções.
- **FR-016**: Uma operação sobre serviço, alerta ou incidente inexistente MUST
  retornar um erro compreensível e MUST NOT alterar o estado.
- **FR-017**: Todas as estratégias MUST usar a mesma configuração de modelo,
  carregada de `OPENROUTER_API_KEY` e `OPENROUTER_MODEL` do ambiente do
  processo, incluindo um arquivo local `.env` quando presente, com o endpoint
  gratuito NVIDIA indicado e temperatura zero; credenciais MUST NOT aparecer
  nos traces ou resultados.
- **FR-018**: Durante o desenvolvimento, a base operacional MUST ser um único
  arquivo JSON local com serviços, alertas e incidentes. Ferramentas devem ler
  os registros existentes e persistir operações válidas nesse arquivo; testes
  determinísticos devem poder usar caminhos isolados e não alterar a base local.
- **FR-019**: O comando local da arena MUST carregar variáveis de um arquivo
  `.env` presente usando suporte nativo do Node.js, sem dependência adicional;
  se as variáveis obrigatórias estiverem ausentes ou vazias, MUST informar
  claramente os nomes necessários antes de iniciar uma chamada ao modelo.
- **FR-020**: Uma resposta final vazia do provedor MUST ser apresentada como
  erro explícito, nunca como conclusão bem-sucedida da solicitação.
- **FR-021**: A resposta de `list_alerts` MUST apresentar a quantidade e, para
  cada alerta, seu identificador, serviço, severidade e título em formato
  legível pelo operador.
- **FR-022**: Para perguntas de contagem, a resposta final MUST incluir o total
  e listar cada alerta correspondente no formato `[id] serviço | severidade |
  título`, no idioma da solicitação.

### Key Entities

- **Serviço**: serviço operacional ao qual alertas e incidentes podem estar
  associados.
- **Alerta**: sinal operacional associado a um serviço e classificado como
  firing ou resolved.
- **Incidente**: ocorrência operacional com título, serviço, severidade e
  estado de resolução.
- **Estratégia de raciocínio**: modo de processar uma solicitação e produzir
  resposta, trace e métricas.
- **Evento de trace**: registro tipado de uma etapa observável da execução.
- **Plano**: sequência ordenada e limitada de passos para resolver uma
  solicitação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% das execuções concluídas pela arena, cada estratégia
  selecionada apresenta sua resposta, trace e métricas separadamente.
- **SC-002**: 100% dos eventos de trace exibidos usam um dos seis tipos
  definidos; toda ação exibe ferramenta e argumentos.
- **SC-003**: Plan-and-Execute executa no máximo oito ferramentas por execução,
  inclusive quando o replanner adiciona ou ajusta passos.
- **SC-004**: A primeira inicialização do JSON produz cinco serviços e seis
  alertas, com a distribuição de três firing e três resolved; execuções de seed
  subsequentes preservam os registros operacionais existentes.
- **SC-005**: Os testes do store e do trace passam sem acesso à rede e produzem
  os mesmos resultados em execuções repetidas.
- **SC-006**: Com as duas variáveis OpenRouter configuradas no arquivo local de
  ambiente, a arena pode ser iniciada sem exportação manual, e nenhum segredo
  aparece na saída.
- **SC-007**: Uma resposta final vazia do modelo produz um erro acionável, não
  uma saída de sucesso sem conteúdo.
- **SC-008**: No conjunto inicial, uma consulta de alertas críticos firing
  identifica exatamente `alert-001` e `alert-003`.

## Assumptions

- Os nomes de estratégia aceitos pela arena são `react` e
  `plan-and-execute`.
- Se `--strategies` não for informado, a arena executa ambas as estratégias;
  se `--max-iterations` não for informado, aplica-se o limite padrão definido
  durante o planejamento.
- O parâmetro `--max-iterations` limita os ciclos de decisão de cada
  estratégia; Plan-and-Execute também aplica o teto absoluto de oito ações
  executadas.
- O arquivo JSON versionado contém o seed inicial e serve como base local
  operacional até que a persistência MySQL seja retomada. O comando de seed
  inicializa o arquivo somente quando ele está ausente e não apaga alterações
  existentes.
- O identificador do serviço deve corresponder a um dos serviços semeados;
  severidades válidas serão definidas no planejamento.
- A solicitação da arena é texto fornecido pela pessoa usuária na linha de
  comando.

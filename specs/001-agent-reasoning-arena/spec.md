# Feature Specification: Agent Reasoning Arena

**Feature Branch**: `001-agent-reasoning-arena`

**Created**: 2026-11-11

**Status**: Draft

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
   executado novamente, **Then** os dados retornam ao conjunto inicial definido.

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
- Se a geração do plano produzir mais de oito passos, o plano é limitado a
  oito antes da execução.

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
  executar um passo por vez e revisar os passos restantes após cada execução.
- **FR-007**: A estratégia Plan-and-Execute MUST encerrar quando não houver
  passos restantes e MUST limitar cada plano a no máximo oito passos.
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
  Deve haver um comando local repetível de seed que restaure esse estado inicial.
- **FR-014**: Os testes do store e da formatação do trace MUST ser determinísticos
  e executáveis sem chamadas de rede.
- **FR-015**: A arena MUST rejeitar uma seleção vazia ou estratégias
  desconhecidas e MUST rejeitar limites de iteração inválidos antes de iniciar
  execuções.
- **FR-016**: Uma operação sobre serviço, alerta ou incidente inexistente MUST
  retornar um erro compreensível e MUST NOT alterar o estado.
- **FR-017**: Todas as estratégias MUST usar a mesma configuração de modelo,
  carregada de `OPENROUTER_API_KEY` e `OPENROUTER_MODEL`, com o endpoint
  gratuito NVIDIA indicado e temperatura zero; credenciais MUST NOT aparecer
  nos traces ou resultados.

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
- **SC-003**: Nenhum plano contém mais de oito passos, e todos os ciclos de
  planejamento terminam quando não há passos restantes ou ao alcançar o
  limite configurado.
- **SC-004**: A inicialização dos dados produz exatamente cinco serviços e
  seis alertas, com a distribuição de três firing e três resolved, em 100%
  das execuções de seed.
- **SC-005**: Os testes do store e do trace passam sem acesso à rede e produzem
  os mesmos resultados em execuções repetidas.

## Assumptions

- Os nomes de estratégia aceitos pela arena são `react` e
  `plan-and-execute`.
- Se `--strategies` não for informado, a arena executa ambas as estratégias;
  se `--max-iterations` não for informado, aplica-se o limite padrão definido
  durante o planejamento.
- O parâmetro `--max-iterations` limita os ciclos de decisão de cada
  estratégia; o limite específico de oito passos do plano também se aplica.
- O conjunto de dados mock usado pelas ferramentas é local e mantido em
  memória; executar o seed restaura o estado inicial em vez de depender de
  dados remotos. O banco persistente do projeto permanece sujeito à
  constituição.
- O identificador do serviço deve corresponder a um dos serviços semeados;
  severidades válidas serão definidas no planejamento.
- A solicitação da arena é texto fornecido pela pessoa usuária na linha de
  comando.

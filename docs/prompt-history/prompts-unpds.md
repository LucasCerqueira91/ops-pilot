curl -X post http://localhost:3000/tasks \ -H "Content-type: apllication/json" \ -d '{"title": "Minha nova tarefa"}'

Crie o esqueleto de um projeto Node.js chamado ops-pilot:

git inicializado; package.json com "type": "module"
dependências: zod, @langchain/core, @langchain/openai, @langchain/langgraph, não instale o dorenv utilize a opção nativa do node. express, sequelize, mysql
dev: typescript, tsx, @types/node, @types/express, @types/sequelize (caso tenha)
-scripts: dev = "tsx src/index.ts; arena = "tsx src/arena.ts"; bench = "src/bench.ts"; test = node --import tsx --test ~src/**/*.test.ts""; typechecl = "tsc --noEmit
.gitignore: node_modules, .env, .env.*, dist
.env.exemple com OPENROUTER_API_KEY= e OPENROUTER_MODEL=
Não crie arquivos em src/ ainda (apenas um vazio para o typecheck)
Rode npm run typecheck ao final




/speckit-specify  Núcleo de raciocício do OpsPilot:
- Interface comum ReasoningStrategy: name + run(input) -> (answer, trace, metrics). trace = eventos tipados (thought | action | observation | plan | critique | answer; action carrega (tool, args)). metrics = ( llCalls, latencyMs).
Fábrica única em src/agents/model.ts lend OPENROUTER_API_KEY e OPENOUTER_MODEL (baseURL nvidia free), temperature 0.
- Ferramentas mock em src/agents/tool.ts sobre um store in-memory pré-populado (o seed primário: 5 serviços, 6 alertas variados - 3 firing, 3 resolved (crie um script para rodar o seed, e execute ele ao final desse prompt)): list_alerts(status), open_incident(title, service, serverity), resolve_incident(id). Schemas zod, banco mysql, utilizando sequelize.
- Estratégia ReAct em src/agents/react.ts usando o agente ReAct pré-construido do LangGraph com essas tools, capturando o trace completo.
- Estratégia Plan-and-Execute em src/agents/plan-and-execute.ts como grafo: planner (sapida estruturada : lista de passos), executor(um passo por vez com as tool), replanner (revisa o restante após cada passo; encerra quando não resta nada). Máximo 8 passos.
- Toda estratégia respeita limite de iterações e conta chamadas de LLM.
Arena mínima em src/arena.ts: roda 1+ estratégias sobre o mesmo input e imprime traces e métricas (flags --strategies e --max-iterations)
- Testes: store e formatação de trace (deterministicos, sem rede).




//refrencia para a factory src/agents/models.ts

import {ChatOpenAI} from "langchain/openai";

export function createModel() {
  return new ChatOpenAI({
    modelName: "process.env.OPENROUTER_MODEL ?? "",
    apiKey: "process.env.OPENROUTER_API_KEY ?? "",
    configuration: { baseURL: "https://openrouter.ai/api/v1" },
    },
    temperature: 0,
  });
}


// src/agents/tools.ts

import { Tool } from "langchain/core/tools";
import {z} from "zod";
import{store} from "./ops-store.ts";


export const listAlerts = tool({
    async ({status}) => JSON.stringify(store.listAlerts(status)),
    name: "list_alerts",
    description: "Lista os alertas de monitoramento. Use quando o plantonista perguntar o que está disparando,o estado dos serviçoes ou 'como está o plantão.' status: firing | resolved | all",
    schema: z.object({
        status: z.enum(["firing", "resolved", "all"]).default("firing"),
    }),
});



// src/agents/react.ts

import {createReactAgent} from "@langchain/langgraph/prebuilt";

export const reactStrategy = ResoningStrategy ={
    name: "react",
    async run(input) {
        const started = Date.now();
        const agent = createReactAgent({
            llm: createModel(),
            tools: opdTools,
        });
        const result = await agent.invoke(
            {message: [{role: "user", content: input}]},
            {recursionsLimit:12} //guardrail : nada de loop infinito
        )
        return {
            answer: lastText(result.messages),
            trace: toTrace(result.messages),
            metrics: {llmCalls : countAiMessages(result.messages), latencyMs: Date.now() - started},
        }
      }
    }
	
	
	
-------------------------------------------------------------------------------------------
	
	/speckit-implement  

use os seguintes exemplos para os códigos de seus respectivos arquivos:

//refrencia para a factory src/agents/models.ts

import {ChatOpenAI} from "langchain/openai";

export function createModel() {
  return new ChatOpenAI({
    modelName: "process.env.OPENROUTER_MODEL ?? "",
    apiKey: "process.env.OPENROUTER_API_KEY ?? "",
    configuration: { baseURL: "https://openrouter.ai/api/v1" },
    },
    temperature: 0,
  });
}


// src/agents/tools.ts

import { Tool } from "langchain/core/tools";
import {z} from "zod";
import{store} from "./ops-store.ts";


export const listAlerts = tool({
    async ({status}) => JSON.stringify(store.listAlerts(status)),
    name: "list_alerts",
    description: "Lista os alertas de monitoramento. Use quando o plantonista perguntar o que está disparando,o estado dos serviçoes ou 'como está o plantão.' status: firing | resolved | all",
    schema: z.object({
        status: z.enum(["firing", "resolved", "all"]).default("firing"),
    }),
});



// src/agents/react.ts

import {createReactAgent} from "@langchain/langgraph/prebuilt";

export const reactStrategy = ResoningStrategy ={
    name: "react",
    async run(input) {
        const started = Date.now();
        const agent = createReactAgent({
            llm: createModel(),
            tools: opdTools,
        });
        const result = await agent.invoke(
            {message: [{role: "user", content: input}]},
            {recursionsLimit:12} //guardrail : nada de loop infinito
        )
        return {
            answer: lastText(result.messages),
            trace: toTrace(result.messages),
            metrics: {llmCalls : countAiMessages(result.messages), latencyMs: Date.now() - started},
        }
      }
    }
	
	
	
----------------------------------------------------------------


/speckit.implement implemente o plan-execute para o nosso modelo do openrouter de acordo com os exemplos abaixo, executor resolve as tools, empurra para done, replanner decide se deve ajustar / seguir / encerrar; no total teto de 8 passos.
//implementar o plan-execute.ts seguindo o exemplo abaixo:

// o estado de referencia
const PEState = Annotation.Root({
    input: Annotation<string>(),
    plan: Annotation<string>(),
    done: Annotation<string, string[]>({reducer:(a,b) => a.concat(b), default:() => []}),
    answer: Annotation<string>(),
})


//planner - referencia
const planSchema =  z.object({
    steps: z.array(z.string()).describe("passos curtos, ordenados, executáveis com as ferramentas disponíveis"),
});

async function planner(state: typeof PEState.State) {
    const plan = await createModel().withStructuredOutput(planSchema).invoke(
        [["system", PLANNER_PROMPT], ["user", state.input]]
    );
    return {plan: plan.steps};
}

Execute o script de seed, e vamos usar por enquanto apenas o arquivo .json com as seeds para usar de base de dados, para o modelo ler o que já existe, ou, adicionar novos itens, faça essa modificação para ajustar a execução em memória para  nossos testes.

-----------------------------------------------------------------------------------------------------


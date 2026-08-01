import { isMapIterator } from "node:util/types";
import { OpenAI } from "openai";
import { HARNESS_PROMPT } from "./config.js";


export interface IMessage {
    role: "user" | "assistant" | "developer";
    content: string;
}

export interface ITool {
    name: string;
    description: string;
    doc?: string;
    executor: (input: string) => Promise<string>;
}

export class AgentBuilder {
    public instructions: string | undefined;
    public toolList: ITool[];

    constructor() {
        this.toolList = [];
    }

    public setInstruction(instructions: string) {
        this.instructions = instructions;
        return this;
    }

    public tool(t: ITool) {
        this.toolList.push(t);
        return this;
    }

    public build() {
        return new Agent(this);
    }
}

export class Agent {
    private instructions: string;
    private messageHistroy: IMessage[];
    private toolMap: Map<string, ITool>;
    private openai: OpenAI;




    private MAX_LOOP = 30;

    constructor(builder: AgentBuilder) {
        this.toolMap = new Map();
        this.openai = new OpenAI({
            apiKey: ''
        })

        for (const t of builder.toolList) {
            this.toolMap.set(t.name, t);
        }

        this.instructions = `
        ${HARNESS_PROMPT}\n\n

        System Prompt:
        ${builder.instructions}

        Available Tools:
        ${builder.toolList.map((t) => JSON.stringify({ functionName: t.name, functionDescription: t.description, functionDoc: t.doc })).join("\n")}

        `;

        this.messageHistroy = [];
    }

    static builder() {
        return new AgentBuilder();
    }

    public printSystemPrompt() {
        console.log(this.instructions)
    }

    public async run(query: string) {
        // console.log(`this is the function to run agent`);

        //append query in the message history
        this.messageHistroy.push({ role: 'user', content: query });
        for (let i = 0; i < this.MAX_LOOP; i++) {
            //call LLM (system prompt + message history)
            const llmResponse = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: this.instructions },
                    ...this.messageHistroy.map(e => ({ role: e.role, content: e.content }))
                ]

            })

            const rawLlmResponse: string = llmResponse.choices[0]?.message.content as string

            this.messageHistroy.push({ role: "assistant", content: rawLlmResponse });

            const parsedResult = JSON.parse(rawLlmResponse);

            if (parsedResult.step.toLowerCase() === "output") {
                return this.messageHistroy
            }



            if (parsedResult.step.toLowerCase() === "tool_request") {
                const { functionName, input } = parsedResult;
                const tool = this.toolMap.get(functionName)

                if (!tool) {
                    this.messageHistroy.push({ 'role': 'developer', content: `error, function name with ${functionName} does not exists` })
                    continue
                }

                const toolResult = await tool.executor(input)
                this.messageHistroy.push({
                    'role': 'developer', content: JSON.stringify({
                        functionName,
                        input,
                        toolResult
                    })
                })
            }
        }
    }
}

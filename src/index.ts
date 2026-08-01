import { Agent, AgentBuilder } from "./app/agent.js";
import type {ITool} from "./app/agent.js"
import axios from "axios";

const weatherTool: ITool={
    name: 'fetchWeatherTool',
    description: 'fetches  real time weather data by cityName',
    doc: 'fetchWeatherInfo(cityName: string): weatherReport',
    async executor(cityName) {
        const url = `https://wttr.in/${cityName.toLowerCase()}?format=%C+%t`;
        const response = await axios.get(url, { responseType: 'text' });
        return JSON.stringify({ cityName, weatherInfo: response.data });
    },

}

async function init(){
    const agent: Agent= Agent.builder()
    .setInstruction("you are an expert AI Assitant....")
    .tool(weatherTool)
    .build();

    // agent.run('what is 2+2')

    const result=await agent.run("tell me weather of khagaria");
    console.log(result)

}

init();
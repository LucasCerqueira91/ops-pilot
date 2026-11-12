import assert from "node:assert/strict";
import test from "node:test";
import { ChatOpenAI } from "@langchain/openai";
import { createModel, getModelConfiguration } from "./model.js";

const validEnvironment = {
  OPENROUTER_API_KEY: "test-key-not-for-network-use",
  OPENROUTER_MODEL: "nvidia/nemotron-3.5-super-vl:free",
};

test("model configuration requires explicit environment values", () => {
  assert.throws(() => getModelConfiguration({}), /OPENROUTER_API_KEY/);
  assert.throws(
    () =>
      getModelConfiguration({
        OPENROUTER_API_KEY: validEnvironment.OPENROUTER_API_KEY,
      }),
    /OPENROUTER_MODEL/,
  );
});

test("missing OpenRouter settings explain how to configure the local arena", () => {
  assert.throws(
    () =>
      getModelConfiguration({
        OPENROUTER_API_KEY: " ",
        OPENROUTER_MODEL: "",
      }),
    /OPENROUTER_API_KEY, OPENROUTER_MODEL.*process environment or local \.env/,
  );
});

test("the model factory uses OpenRouter and deterministic temperature", () => {
  const configuration = getModelConfiguration(validEnvironment);
  const model = createModel(validEnvironment);

  assert.equal(configuration.model, validEnvironment.OPENROUTER_MODEL);
  assert.equal(configuration.apiKey, validEnvironment.OPENROUTER_API_KEY);
  assert.equal(
    configuration.configuration.baseURL,
    "https://openrouter.ai/api/v1",
  );
  assert.equal(configuration.temperature, 0);
  assert.equal(configuration.modelKwargs.parallel_tool_calls, false);
  assert.ok(model instanceof ChatOpenAI);
  assert.equal(model.model, validEnvironment.OPENROUTER_MODEL);
  assert.equal(model.temperature, 0);
});

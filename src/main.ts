import * as core from "@actions/core";

const secretsString = core.getInput("secrets", { required: true });
const secretsJson = JSON.parse(secretsString);

console.log(secretsJson);

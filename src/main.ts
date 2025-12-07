import * as core from "@actions/core";
import * as z from "@zod/zod";

const secretsSchema = z.record(z.string(), z.string());

// Retrieve data
const secretsStr = core.getInput("secrets", { required: true });
const secrets = secretsSchema.parse(JSON.parse(secretsStr));

const check = core.getInput("check", { required: true }).split("\n").map((
  key,
) => key.trim());

// Check for invalid lines in check: Secret names shouldn't have space
if (check.findIndex((val) => val.includes(" ")) !== -1) {
  throw new Error(
    "Check input should not contain spaces in lines. Secret keys do not contain spaces.",
  );
}

// Compute check & output
const keyExists = check.map((key) => key in secrets && secrets[key]);
const result = keyExists.every((bool) => bool);

if (!result) {
  console.warn(`Secrets not set:`);
  keyExists.forEach((exists, idx) => {
    if (!exists) {
      console.warn(check[idx]);
    }
  });
}

core.setOutput("success", result);

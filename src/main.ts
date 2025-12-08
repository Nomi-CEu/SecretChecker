import * as core from "@actions/core";
import * as z from "@zod/zod";
import regexParse from "regex-parser";

const secretsSchema = z.record(z.string(), z.string());

export type ParsedInputs = {
  secrets: Record<string, string>;
  check: string[];
  allowEmpty: boolean;
  pattern: RegExp | undefined;
  throwIfFail: boolean;
  throwIfSuccess: boolean;
};

export type SecretCheckerOutput = {
  result: boolean;
  keyExists: { key: string; exists: boolean }[];
  notEmpty: { key: string; notEmpty: boolean }[];
  matchesPattern: { key: string; matchesPattern: boolean }[];
};

type GetInput = (key: string, options?: core.InputOptions) => string;

const getInputBoolean = (
  getInput: GetInput,
  key: string,
  defaultValue = false,
): boolean => {
  const input = getInput(key);
  const lower = input.toLowerCase();

  if (lower === "") return defaultValue;
  if (lower === "true") return true;
  if (lower === "false") return false;

  throw new Error(
    `Invalid input boolean value '${input}' for input key '${key}'. Excepted: 'true' or 'false' (case insensitive).`,
  );
};

const parseSecretsInput = (getInput: GetInput): Record<string, string> => {
  const secretsStr = getInput("secrets", { required: true });

  // Parse JSON (also guards against empty secrets input)
  let secretsJson: unknown;
  try {
    secretsJson = JSON.parse(secretsStr);
  } catch (err) {
    throw new Error("Invalid JSON for input 'secrets'.", {
      cause: err,
    });
  }

  // Validate schema
  let secrets: Record<string, string>;
  try {
    secrets = secretsSchema.parse(secretsJson);
  } catch (err) {
    throw new Error("Input 'secrets' does not fit schema: string -> string.", {
      cause: err,
    });
  }

  return secrets;
};

export const parseInputs = (getInput: GetInput): ParsedInputs => {
  const secrets: Record<string, string> = parseSecretsInput(getInput);

  const check = getInput("check", { required: true })
    .split("\n")
    .map((key) => key.trim());

  const allowEmpty = getInputBoolean(getInput, "allowEmpty");

  const patternStr = getInput("pattern");

  // Parse pattern
  let pattern: RegExp | undefined;
  try {
    pattern = patternStr ? regexParse(patternStr) : undefined;
  } catch (err) {
    throw new Error("Invalid regex for input 'pattern'.", {
      cause: err,
    });
  }

  const throwIfFail = getInputBoolean(getInput, "throwIfFail");
  const throwIfSuccess = getInputBoolean(getInput, "throwIfSuccess");

  // Validation
  // Check for empty lines (also prevents checks from being empty)
  if (check.findIndex((val) => val === "") !== -1) {
    throw new Error(
      "Input 'check' should not be empty, or contain empty lines.",
    );
  }

  // Check for spaces in line
  if (check.findIndex((val) => val.includes(" ")) !== -1) {
    throw new Error(
      "Input 'check' should not contain spaces in lines. Secret keys do not contain spaces.",
    );
  }

  return {
    secrets,
    check,
    allowEmpty,
    pattern,
    throwIfFail,
    throwIfSuccess,
  } satisfies ParsedInputs;
};

export const parseSecrets = (inputs: ParsedInputs): SecretCheckerOutput => {
  // Compute checks & output
  const keyExists = inputs.check.map((key) => {
    return { key, exists: key in inputs.secrets };
  });

  const notEmpty = keyExists
    .filter(({ exists }) => exists)
    .map(({ key }) => {
      return { key, notEmpty: inputs.allowEmpty || inputs.secrets[key] !== "" };
    });

  const matchesPattern = notEmpty
    .filter(({ notEmpty }) => notEmpty)
    .map(({ key }) => {
      return {
        key,
        matchesPattern: inputs.pattern === undefined ||
          inputs.pattern.test(inputs.secrets[key]),
      };
    });

  const result = matchesPattern
    .filter(({ matchesPattern }) => matchesPattern).length ===
    inputs.check.length;

  return {
    result,
    keyExists,
    notEmpty,
    matchesPattern,
  };
};

export const handleCheckerOutput = (
  inputs: ParsedInputs,
  outputs: SecretCheckerOutput,
): boolean => {
  // Log & Error
  if (outputs.result) {
    const msg = "All secrets are set and have valid values.";
    if (inputs.throwIfSuccess) {
      throw new Error(msg);
    } else {
      console.log(msg);
    }
  } else {
    const notSet = outputs.keyExists.filter(({ exists }) => !exists);
    if (notSet.length !== 0) {
      console.warn(
        `Secrets not set: ${
          notSet.map(({ key }) => key)
            .join(", ")
        }`,
      );
    }

    const empty = outputs.notEmpty.filter(({ notEmpty }) => !notEmpty);
    if (!inputs.allowEmpty && empty.length !== 0) {
      console.warn(
        `Secrets with empty values: ${
          empty
            .map(({ key }) => key)
            .join(", ")
        }`,
      );
    }

    const failedPattern = outputs.matchesPattern.filter(({ matchesPattern }) =>
      !matchesPattern
    );
    if (inputs.pattern !== undefined && failedPattern.length !== 0) {
      console.warn(
        `Secrets that failed to match pattern ${inputs.pattern}: ${
          failedPattern
            .map(({ key }) => key)
            .join(", ")
        }`,
      );
    }

    if (inputs.throwIfFail) {
      throw new Error(
        "Necessary secrets not set or do not have valid values. See above.",
      );
    }
  }

  return outputs.result;
};

// Main logic
if (import.meta.main) {
  const inputs = parseInputs(core.getInput);
  const outputs = parseSecrets(inputs);
  const result = handleCheckerOutput(inputs, outputs);
  core.setOutput("success", result);
}

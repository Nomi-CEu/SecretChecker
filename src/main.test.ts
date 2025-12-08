import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  handleCheckerOutput,
  type ParsedInputs,
  parseInputs,
  parseSecrets,
  type SecretCheckerOutput,
} from "./main.ts";

describe("parseInputs", () => {
  describe("correctly parses", () => {
    const testCases: {
      description: string;
      inputs: Record<string, string>;
      expected: ParsedInputs;
    }[] = [
      {
        description: "all inputs",
        inputs: {
          secrets:
            '{ "secret1": "val1\\nval2", "secret2": "", "secret3": "{ \\"nestedJSON\\": \\"nestedVal\\" }" }',
          check: "secret1\nsecret2\nsecret3\nsecret4",
          allowEmpty: "false",
          pattern: "/abcd.*\\d*/i",
          throwIfFail: "true",
          throwIfSuccess: "false",
        },
        expected: {
          secrets: {
            secret1: "val1\nval2",
            secret2: "",
            secret3: '{ "nestedJSON": "nestedVal" }',
          },
          check: ["secret1", "secret2", "secret3", "secret4"],
          allowEmpty: false,
          pattern: /abcd.*\d*/i,
          throwIfFail: true,
          throwIfSuccess: false,
        },
      },
      {
        description: "inputs with missing values",
        inputs: {
          secrets:
            '{ "secret1": "val1\\nval2", "secret2": "", "secret3": "{ \\"nestedJSON\\": \\"nestedVal\\" }" }',
          check: "secret1\nsecret2\nsecret3\nsecret4",
        },
        expected: {
          secrets: {
            secret1: "val1\nval2",
            secret2: "",
            secret3: '{ "nestedJSON": "nestedVal" }',
          },
          check: ["secret1", "secret2", "secret3", "secret4"],
          allowEmpty: false,
          pattern: undefined,
          throwIfFail: false,
          throwIfSuccess: false,
        },
      },
      {
        description: "inputs with boolean values that contain capital letters",
        inputs: {
          secrets:
            '{ "secret1": "val1\\nval2", "secret2": "", "secret3": "{ \\"nestedJSON\\": \\"nestedVal\\" }" }',
          check: "secret1\nsecret2\nsecret3\nsecret4",
          allowEmpty: "TRUE",
          throwIfFail: "tRuE",
          throwIfSuccess: "False",
        },
        expected: {
          secrets: {
            secret1: "val1\nval2",
            secret2: "",
            secret3: '{ "nestedJSON": "nestedVal" }',
          },
          check: ["secret1", "secret2", "secret3", "secret4"],
          allowEmpty: true,
          pattern: undefined,
          throwIfFail: true,
          throwIfSuccess: false,
        },
      },
      {
        description:
          "inputs with pattern that includes invalid flags; removing them",
        inputs: {
          secrets:
            '{ "secret1": "val1\\nval2", "secret2": "", "secret3": "{ \\"nestedJSON\\": \\"nestedVal\\" }" }',
          check: "secret1\nsecret2\nsecret3\nsecret4",
          pattern: "/abcd.*\\d*/ixyzabc",
        },
        expected: {
          secrets: {
            secret1: "val1\nval2",
            secret2: "",
            secret3: '{ "nestedJSON": "nestedVal" }',
          },
          check: ["secret1", "secret2", "secret3", "secret4"],
          allowEmpty: false,
          pattern: /abcd.*\d*/iy,
          throwIfFail: false,
          throwIfSuccess: false,
        },
      },
    ];

    testCases.forEach(({ description, inputs, expected }) => {
      it(description, () => {
        const result = parseInputs((key) => inputs[key] ?? "");

        // Compare all result except for regex
        expect({ ...result, pattern: undefined }).toStrictEqual({
          ...expected,
          pattern: undefined,
        });

        // Compare regex
        expect(result.pattern?.toString()).toEqual(
          expected.pattern?.toString(),
        );
      });
    });
  });

  describe("throws an error if", () => {
    const testCases: {
      description: string;
      inputs: Record<string, string>;
      error: string | undefined;
    }[] = [
      {
        description: "secrets is invalid JSON",
        inputs: {
          secrets: "something",
        },
        error: "Invalid JSON for input 'secrets'.",
      },
      {
        description: "secrets fails zod schema checks",
        inputs: {
          secrets: '{ "secret_1": 5 }',
        },
        error: "Input 'secrets' does not fit schema: string -> string.",
      },
      {
        description: "check is empty",
        inputs: {
          secrets: "{}",
        },
        error: "Input 'check' should not be empty, or contain empty lines.",
      },
      {
        description: "check contains invalid secret keys",
        inputs: {
          secrets: "{}",
          check: "SECRET 1\nSECRET_2",
        },
        error:
          "Input 'check' should not contain spaces in lines. Secret keys do not contain spaces.",
      },
      {
        description: "invalid boolean values are present",
        inputs: {
          secrets: "{}",
          check: "SECRET_1\nSECRET_2",
          allowEmpty: "5",
        },
        error:
          "Invalid input boolean value '5' for input key 'allowEmpty'. Excepted: 'true' or 'false' (case insensitive).",
      },
      {
        description: "invalid regex is provided",
        inputs: {
          secrets: "{}",
          check: "SECRET_1\nSECRET_2",
          pattern: "/(/g",
        },
        error: "Invalid regex for input 'pattern'.",
      },
    ];

    testCases.forEach(({ description, inputs, error }) => {
      it(description, () => {
        expect(() => parseInputs((key) => inputs[key] ?? "")).toThrow(error);
      });
    });
  });
});

describe("parseSecrets", () => {
  const testCases: {
    description: string;
    input: ParsedInputs;
    expected: SecretCheckerOutput;
  }[] = [
    {
      description: "all secrets are present",
      input: {
        secrets: {
          secret1: "val1\nval2",
          secret2: "",
          secret3: '{ "nestedJSON": "nestedVal" }',
        },
        check: ["secret1", "secret3"],
        allowEmpty: false,
        pattern: undefined,
        throwIfFail: false,
        throwIfSuccess: false,
      },
      expected: {
        result: true,
        keyExists: [
          {
            key: "secret1",
            exists: true,
          },
          {
            key: "secret3",
            exists: true,
          },
        ],
        notEmpty: [
          {
            key: "secret1",
            notEmpty: true,
          },
          {
            key: "secret3",
            notEmpty: true,
          },
        ],
        matchesPattern: [
          {
            key: "secret1",
            matchesPattern: true,
          },
          {
            key: "secret3",
            matchesPattern: true,
          },
        ],
      },
    },
    {
      description: "some secrets are empty and 'allowEmpty' is false",
      input: {
        secrets: {
          secret1: "val1\nval2",
          secret2: "",
          secret3: '{ "nestedJSON": "nestedVal" }',
        },
        check: ["secret1", "secret2", "secret3"],
        allowEmpty: false,
        pattern: undefined,
        throwIfFail: false,
        throwIfSuccess: false,
      },
      expected: {
        result: false,
        keyExists: [
          {
            key: "secret1",
            exists: true,
          },
          {
            key: "secret2",
            exists: true,
          },
          {
            key: "secret3",
            exists: true,
          },
        ],
        notEmpty: [
          {
            key: "secret1",
            notEmpty: true,
          },
          {
            key: "secret2",
            notEmpty: false,
          },
          {
            key: "secret3",
            notEmpty: true,
          },
        ],
        matchesPattern: [
          {
            key: "secret1",
            matchesPattern: true,
          },
          {
            key: "secret3",
            matchesPattern: true,
          },
        ],
      },
    },
    {
      description: "some secrets are empty and 'allowEmpty' is true",
      input: {
        secrets: {
          secret1: "val1\nval2",
          secret2: "",
          secret3: '{ "nestedJSON": "nestedVal" }',
        },
        check: ["secret1", "secret2", "secret3"],
        allowEmpty: true,
        pattern: undefined,
        throwIfFail: false,
        throwIfSuccess: false,
      },
      expected: {
        result: true,
        keyExists: [
          {
            key: "secret1",
            exists: true,
          },
          {
            key: "secret2",
            exists: true,
          },
          {
            key: "secret3",
            exists: true,
          },
        ],
        notEmpty: [
          {
            key: "secret1",
            notEmpty: true,
          },
          {
            key: "secret2",
            notEmpty: true,
          },
          {
            key: "secret3",
            notEmpty: true,
          },
        ],
        matchesPattern: [
          {
            key: "secret1",
            matchesPattern: true,
          },
          {
            key: "secret2",
            matchesPattern: true,
          },
          {
            key: "secret3",
            matchesPattern: true,
          },
        ],
      },
    },
    {
      description: "some secrets are missing",
      input: {
        secrets: {
          secret1: "val1\nval2",
          secret2: "",
          secret3: '{ "nestedJSON": "nestedVal" }',
        },
        check: ["secret1", "secret2", "secret3", "secret4"],
        allowEmpty: false,
        pattern: undefined,
        throwIfFail: false,
        throwIfSuccess: false,
      },
      expected: {
        result: false,
        keyExists: [
          {
            key: "secret1",
            exists: true,
          },
          {
            key: "secret2",
            exists: true,
          },
          {
            key: "secret3",
            exists: true,
          },
          {
            key: "secret4",
            exists: false,
          },
        ],
        notEmpty: [
          {
            key: "secret1",
            notEmpty: true,
          },
          {
            key: "secret2",
            notEmpty: false,
          },
          {
            key: "secret3",
            notEmpty: true,
          },
        ],
        matchesPattern: [
          {
            key: "secret1",
            matchesPattern: true,
          },
          {
            key: "secret3",
            matchesPattern: true,
          },
        ],
      },
    },
    {
      description: "a pattern is given",
      input: {
        secrets: {
          secret1: "hello world",
          secret2: "hello",
          secret3: "",
          secret4: "hello a",
        },
        check: ["secret1", "secret2", "secret3", "secret4", "secret5"],
        allowEmpty: false,
        pattern: /^hello\s.+$/,
        throwIfFail: false,
        throwIfSuccess: false,
      },
      expected: {
        result: false,
        keyExists: [
          {
            key: "secret1",
            exists: true,
          },
          {
            key: "secret2",
            exists: true,
          },
          {
            key: "secret3",
            exists: true,
          },
          {
            key: "secret4",
            exists: true,
          },
          {
            key: "secret5",
            exists: false,
          },
        ],
        notEmpty: [
          {
            key: "secret1",
            notEmpty: true,
          },
          {
            key: "secret2",
            notEmpty: true,
          },
          {
            key: "secret3",
            notEmpty: false,
          },
          {
            key: "secret4",
            notEmpty: true,
          },
        ],
        matchesPattern: [
          {
            key: "secret1",
            matchesPattern: true,
          },
          {
            key: "secret2",
            matchesPattern: false,
          },
          {
            key: "secret4",
            matchesPattern: true,
          },
        ],
      },
    },
  ];

  testCases.forEach(({ description, input, expected }) => {
    it(`correctly parses when ${description}`, () => {
      expect(parseSecrets(input)).toStrictEqual(expected);
    });
  });
});

describe("handleCheckerOutput", () => {
  describe("throws when", () => {
    const testCases: {
      description: string;
      inputs: ParsedInputs;
      result: boolean;
      error: string;
    }[] = [
      {
        description: "throwIfFail is true and the checker failed",
        inputs: {
          secrets: {},
          check: [],
          allowEmpty: false,
          pattern: undefined,
          throwIfFail: true,
          throwIfSuccess: false,
        },
        result: false,
        error:
          "Necessary secrets not set or do not have valid values. See above.",
      },
      {
        description: "throwIfSuccess is true and the checker succeeded",
        inputs: {
          secrets: {},
          check: [],
          allowEmpty: false,
          pattern: undefined,
          throwIfFail: true,
          throwIfSuccess: true,
        },
        result: true,
        error: "All secrets are set and have valid values.",
      },
    ];

    testCases.forEach(({ description, inputs, result, error }) => {
      it(description, () => {
        expect(() =>
          handleCheckerOutput(inputs, {
            result,
            keyExists: [],
            notEmpty: [],
            matchesPattern: [],
          })
        ).toThrow(error);
      });
    });
  });

  describe("doesn't throws when", () => {
    const testCases: {
      description: string;
      inputs: ParsedInputs;
      result: boolean;
    }[] = [
      {
        description: "throwIfFail is false and the checker failed",
        inputs: {
          secrets: {},
          check: [],
          allowEmpty: false,
          pattern: undefined,
          throwIfFail: false,
          throwIfSuccess: false,
        },
        result: false,
      },
      {
        description: "throwIfSuccess is false and the checker succeeded",
        inputs: {
          secrets: {},
          check: [],
          allowEmpty: false,
          pattern: undefined,
          throwIfFail: true,
          throwIfSuccess: false,
        },
        result: true,
      },
    ];

    testCases.forEach(({ description, inputs, result }) => {
      it(description, () => {
        expect(handleCheckerOutput(inputs, {
          result,
          keyExists: [],
          notEmpty: [],
          matchesPattern: [],
        })).toBe(result);
      });
    });
  });
});

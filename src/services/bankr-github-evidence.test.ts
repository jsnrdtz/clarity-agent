import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyBankrGitHubEvidence
} from "./bankr-github-evidence.js";

test(
  "classifies a direct website repository URL as high-confidence primary evidence",
  () => {
    const result =
      classifyBankrGitHubEvidence(
        {
          source:
            "website",

          text:
            "https://github.com/ExampleOrg/Agent",

          repositoryUrl:
            "https://github.com/ExampleOrg/Agent"
        }
      );

    assert.equal(
      result.relationship,
      "primary"
    );

    assert.equal(
      result.confidence,
      "high"
    );
  }
);

test(
  "classifies a direct product URL as high-confidence primary evidence",
  () => {
    const result =
      classifyBankrGitHubEvidence(
        {
          source:
            "product-url",

          text:
            "https://github.com/ExampleOrg/Product",

          repositoryUrl:
            "https://github.com/ExampleOrg/Product"
        }
      );

    assert.equal(
      result.relationship,
      "primary"
    );

    assert.equal(
      result.confidence,
      "high"
    );
  }
);

test(
  "classifies compatible-with language as an integration",
  () => {
    const result =
      classifyBankrGitHubEvidence(
        {
          source:
            "description",

          text:
            "Compatible with Aeon: https://github.com/aaronjmars/aeon",

          repositoryUrl:
            "https://github.com/aaronjmars/aeon"
        }
      );

    assert.equal(
      result.relationship,
      "integration"
    );

    assert.equal(
      result.confidence,
      "low"
    );
  }
);

test(
  "classifies built-on language as a dependency",
  () => {
    const result =
      classifyBankrGitHubEvidence(
        {
          source:
            "project-update",

          text:
            "Built on https://github.com/ExampleOrg/Framework.",

          repositoryUrl:
            "https://github.com/ExampleOrg/Framework"
        }
      );

    assert.equal(
      result.relationship,
      "dependency"
    );
  }
);

test(
  "classifies SDK evidence as a component",
  () => {
    const result =
      classifyBankrGitHubEvidence(
        {
          source:
            "product-description",

          text:
            "SDK repository: https://github.com/ExampleOrg/SDK",

          repositoryUrl:
            "https://github.com/ExampleOrg/SDK"
        }
      );

    assert.equal(
      result.relationship,
      "component"
    );
  }
);

test(
  "classifies example repositories separately",
  () => {
    const result =
      classifyBankrGitHubEvidence(
        {
          source:
            "description",

          text:
            "Example project: https://github.com/ExampleOrg/Demo",

          repositoryUrl:
            "https://github.com/ExampleOrg/Demo"
        }
      );

    assert.equal(
      result.relationship,
      "example"
    );
  }
);

test(
  "keeps an unclear repository reference unknown",
  () => {
    const result =
      classifyBankrGitHubEvidence(
        {
          source:
            "description",

          text:
            "See https://github.com/ExampleOrg/Unclear for more information.",

          repositoryUrl:
            "https://github.com/ExampleOrg/Unclear"
        }
      );

    assert.equal(
      result.relationship,
      "unknown"
    );

    assert.equal(
      result.confidence,
      "low"
    );
  }
);

import type {
  BankrGitHubEvidenceSource
} from "./bankr-candidate.js";

export type BankrGitHubRelationship =
  | "primary"
  | "component"
  | "integration"
  | "dependency"
  | "example"
  | "unknown";

export type BankrGitHubEvidenceConfidence =
  | "high"
  | "medium"
  | "low";

export type BankrGitHubEvidenceClassification = {
  relationship:
    BankrGitHubRelationship;

  confidence:
    BankrGitHubEvidenceConfidence;

  reasons:
    string[];
};

export type ClassifyBankrGitHubEvidenceInput = {
  source:
    BankrGitHubEvidenceSource;

  text:
    string;

  repositoryUrl:
    string;
};

const SOURCE_CONFIDENCE:
  Record<
    BankrGitHubEvidenceSource,
    BankrGitHubEvidenceConfidence
  > = {
    website:
      "high",

    "product-url":
      "high",

    "team-member-link":
      "medium",

    description:
      "low",

    "product-description":
      "low",

    "project-update":
      "low"
  };

const DEPENDENCY_PATTERNS =
  [
    /\bbuilt on\b/i,
    /\bpowered by\b/i,
    /\buses\b/i,
    /\busing\b/i,
    /\bdependency\b/i,
    /\bdepends on\b/i
  ];

const INTEGRATION_PATTERNS =
  [
    /\bcompatible with\b/i,
    /\bintegrates with\b/i,
    /\bintegration with\b/i,
    /\bplugin for\b/i,
    /\bworks with\b/i
  ];

const EXAMPLE_PATTERNS =
  [
    /\bexample\b/i,
    /\bdemo\b/i,
    /\bsample\b/i,
    /\btutorial\b/i,
    /\bstarter\b/i
  ];

const COMPONENT_PATTERNS =
  [
    /\bsdk\b/i,
    /\bmcp server\b/i,
    /\bplugin\b/i,
    /\blibrary\b/i,
    /\bpackage\b/i,
    /\bcomponent\b/i,
    /\bmodule\b/i
  ];

const PRIMARY_PATTERNS =
  [
    /\bofficial repository\b/i,
    /\bour repository\b/i,
    /\bsource code\b/i,
    /\bopen[- ]source project\b/i,
    /\bmain repository\b/i,
    /\bprimary repository\b/i
  ];

function matchesAny(
  text: string,
  patterns: RegExp[]
): boolean {
  return patterns.some(
    (pattern) =>
      pattern.test(text)
  );
}

function normalizeRepositoryUrl(
  value: string
): string {
  return value
    .trim()
    .replace(
      /\.git$/i,
      ""
    )
    .replace(
      /\/+$/u,
      ""
    )
    .toLowerCase();
}

function isDirectRepositoryUrl(
  text: string,
  repositoryUrl: string
): boolean {
  return (
    normalizeRepositoryUrl(text) ===
    normalizeRepositoryUrl(
      repositoryUrl
    )
  );
}

export function classifyBankrGitHubEvidence(
  input:
    ClassifyBankrGitHubEvidenceInput
): BankrGitHubEvidenceClassification {
  const confidence =
    SOURCE_CONFIDENCE[
      input.source
    ];

  const normalizedText =
    input.text.trim();

  if (
    matchesAny(
      normalizedText,
      DEPENDENCY_PATTERNS
    )
  ) {
    return {
      relationship:
        "dependency",

      confidence,

      reasons: [
        "Dependency language was found near the repository reference.",
        `Evidence source: ${input.source}.`
      ]
    };
  }

  if (
    matchesAny(
      normalizedText,
      INTEGRATION_PATTERNS
    )
  ) {
    return {
      relationship:
        "integration",

      confidence,

      reasons: [
        "Integration language was found near the repository reference.",
        `Evidence source: ${input.source}.`
      ]
    };
  }

  if (
    matchesAny(
      normalizedText,
      EXAMPLE_PATTERNS
    )
  ) {
    return {
      relationship:
        "example",

      confidence,

      reasons: [
        "Example or demonstration language was found near the repository reference.",
        `Evidence source: ${input.source}.`
      ]
    };
  }

  if (
    matchesAny(
      normalizedText,
      COMPONENT_PATTERNS
    )
  ) {
    return {
      relationship:
        "component",

      confidence,

      reasons: [
        "Component language was found near the repository reference.",
        `Evidence source: ${input.source}.`
      ]
    };
  }

  if (
    matchesAny(
      normalizedText,
      PRIMARY_PATTERNS
    )
  ) {
    return {
      relationship:
        "primary",

      confidence,

      reasons: [
        "Primary repository language was found near the repository reference.",
        `Evidence source: ${input.source}.`
      ]
    };
  }

  if (
    (
      input.source ===
        "website" ||
      input.source ===
        "product-url"
    ) &&
    isDirectRepositoryUrl(
      normalizedText,
      input.repositoryUrl
    )
  ) {
    return {
      relationship:
        "primary",

      confidence,

      reasons: [
        "A first-party URL field points directly to the repository.",
        `Evidence source: ${input.source}.`
      ]
    };
  }

  return {
    relationship:
      "unknown",

    confidence,

    reasons: [
      "The repository relationship could not be determined automatically.",
      `Evidence source: ${input.source}.`
    ]
  };
}

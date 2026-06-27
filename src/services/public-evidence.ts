import {
  type AgentEvidenceProfile,
  type PublicDevelopmentVisibility
} from "../data/agent-evidence.js";

import {
  type RegisteredAgent
} from "../data/agent-registry.js";

export type EvidenceConfidence =
  | "high"
  | "medium"
  | "low";

export type PublicEvidenceAssessment = {
  coverage: number;
  confidence: EvidenceConfidence;
  visibility: PublicDevelopmentVisibility;
  interpretation: string;
  signals: string[];
  limitations: string[];
};

function clampScore(
  value: number
): number {
  return Math.max(
    0,
    Math.min(100, value)
  );
}

function getConfidence(
  coverage: number
): EvidenceConfidence {
  if (coverage >= 75) {
    return "high";
  }

  if (coverage >= 45) {
    return "medium";
  }

  return "low";
}

function getInterpretation(
  confidence: EvidenceConfidence
): string {
  if (confidence === "high") {
    return (
      "The public GitHub score is likely to represent a meaningful portion of the project's visible development activity."
    );
  }

  if (confidence === "medium") {
    return (
      "The public GitHub score is useful, but some project development may not be represented."
    );
  }

  return (
    "The public GitHub score reflects only limited visible evidence and must not be treated as an assessment of the complete project."
  );
}

export function assessPublicEvidence(
  agent: RegisteredAgent,
  profile: AgentEvidenceProfile
): PublicEvidenceAssessment {
  let coverage = 60;

  const signals: string[] = [];
  const limitations: string[] = [];

  if (
    agent.github.scope === "component"
  ) {
    coverage -= 20;

    limitations.push(
      "The registered GitHub anchor represents a component, not necessarily the complete project."
    );
  } else {
    coverage += 20;

    signals.push(
      "The registered anchor represents the primary project repository rather than an isolated component."
    );
  }

  if (
    profile.visibility === "public-heavy"
  ) {
    coverage += 15;

    signals.push(
      "The project is currently classified as public-development-heavy."
    );
  }

  if (
    profile.visibility === "partial"
  ) {
    coverage -= 20;

    limitations.push(
      "The registry marks public GitHub data as partial evidence."
    );
  }

  if (
    profile.visibility === "unknown"
  ) {
    coverage -= 5;

    limitations.push(
      "The completeness of public development data has not been established."
    );
  }

  if (profile.privacySensitive) {
    limitations.push(
      "The project has a privacy-sensitive profile, so public repositories may underrepresent total development."
    );
  }

  const finalCoverage =
    clampScore(coverage);

  const confidence =
    getConfidence(finalCoverage);

  return {
    coverage: finalCoverage,
    confidence,
    visibility: profile.visibility,
    interpretation:
      getInterpretation(confidence),
    signals,
    limitations
  };
}

function formatConfidence(
  confidence: EvidenceConfidence
): string {
  return (
    confidence.charAt(0).toUpperCase() +
    confidence.slice(1)
  );
}

export function formatPublicEvidenceAssessment(
  assessment: PublicEvidenceAssessment,
  profileNote: string
): string {
  const signalRows =
    assessment.signals.length > 0
      ? assessment.signals.map(
          (signal) => `- ${signal}`
        )
      : [
          "- No strong public coverage signals were detected."
        ];

  const limitationRows =
    assessment.limitations.length > 0
      ? assessment.limitations.map(
          (limitation) =>
            `- ${limitation}`
        )
      : [
          "- No major public evidence limitations were detected."
        ];

  return [
    "PUBLIC EVIDENCE ASSESSMENT",
    "",
    `Public Evidence Coverage  ${assessment.coverage}/100`,
    `Rating Confidence         ${formatConfidence(
      assessment.confidence
    )}`,
    `Visibility Profile        ${assessment.visibility}`,
    "",
    `Interpretation: ${assessment.interpretation}`,
    "",
    `Registry note: ${profileNote}`,
    "",
    "Coverage signals:",
    ...signalRows,
    "",
    "Coverage limitations:",
    ...limitationRows,
    "",
    "Important:",
    "Public Evidence Coverage measures confidence in the available data, not project quality.",
    "A low coverage score must not automatically reduce the project's final quality rating."
  ].join("\n");
}
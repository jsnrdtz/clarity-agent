import {
  type AgentEvidenceProfile,
  type PublicDevelopmentVisibility
} from "../data/agent-evidence.js";

import {
  type RegisteredAgent
} from "../data/agent-registry.js";

import {
  type PublicEvidenceAssessment,
  type EvidenceConfidence
} from "./public-evidence.js";

import {
  type ProjectScoreResult
} from "./project-score.js";

const DAY_IN_MILLISECONDS =
  24 * 60 * 60 * 1000;

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

function getVisibility(
  coverage: number
): PublicDevelopmentVisibility {
  if (coverage >= 75) {
    return "public-heavy";
  }

  if (coverage >= 45) {
    return "partial";
  }

  return "unknown";
}

function getInterpretation(
  confidence: EvidenceConfidence
): string {
  if (confidence === "high") {
    return (
      "Public GitHub data appears sufficiently representative for an evidence-based development assessment."
    );
  }

  if (confidence === "medium") {
    return (
      "Public GitHub data provides useful signals, but may not represent the complete project."
    );
  }

  return (
    "Public GitHub data is too limited to support a confident assessment of the complete project."
  );
}

function getDaysSince(
  date: string | null
): number | null {
  if (!date) {
    return null;
  }

  const timestamp =
    new Date(date).getTime();

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(
      (
        Date.now() -
        timestamp
      ) /
        DAY_IN_MILLISECONDS
    )
  );
}

function getLatestCorePushDate(
  result: ProjectScoreResult
): string | null {
  const timestamps =
    result.metrics.repositories
      .map(
        (repository) =>
          repository.data.pushedAt
      )
      .filter(
        (date): date is string =>
          typeof date === "string"
      )
      .map(
        (date) => ({
          date,
          timestamp:
            new Date(date).getTime()
        })
      )
      .filter(
        (item) =>
          !Number.isNaN(
            item.timestamp
          )
      )
      .sort(
        (first, second) =>
          second.timestamp -
          first.timestamp
      );

  return timestamps[0]?.date ?? null;
}

function getMinimumCoreConfidence(
  result: ProjectScoreResult
): number {
  if (
    result.coreMatches.length === 0
  ) {
    return 0;
  }

  return Math.min(
    ...result.coreMatches.map(
      (match) =>
        match.relationScore
    )
  );
}

export function assessAutomaticPublicEvidence(
  agent: RegisteredAgent,
  profile: AgentEvidenceProfile,
  result: ProjectScoreResult
): PublicEvidenceAssessment {
  let coverage = 25;

  const signals: string[] = [];
  const limitations: string[] = [];

  if (
    agent.github.scope === "component"
  ) {
    coverage -= 20;

    limitations.push(
      "The registered anchor is classified as a component rather than a complete project repository."
    );
  } else {
    coverage += 20;

    signals.push(
      "The registered anchor is not classified as an isolated component."
    );
  }

  if (
    result.discovery
      .dedicatedBrandAccount
  ) {
    coverage += 10;

    signals.push(
      "Repositories belong to a dedicated GitHub account matching the project brand."
    );
  } else {
    limitations.push(
      "The project uses a personal or differently named GitHub account."
    );
  }

  const coreRepositoryCount =
    result.metrics.repositories.length;

  if (coreRepositoryCount >= 2) {
    coverage += 15;

    signals.push(
      `${coreRepositoryCount} approved public core repositories were identified.`
    );
  } else {
    coverage += 5;

    limitations.push(
      "Only one public core repository was identified."
    );
  }

  if (result.ecosystem.length > 0) {
    coverage += 5;

    signals.push(
      `${result.ecosystem.length} public ecosystem repositories were identified.`
    );
  } else {
    limitations.push(
      "No separate public ecosystem repositories were identified."
    );
  }

  if (
    result.metrics.aggregate
      .activity.hasReadme
  ) {
    coverage += 10;

    signals.push(
      "The anchor repository contains public README documentation."
    );
  } else {
    coverage -= 10;

    limitations.push(
      "No README was detected in the anchor repository."
    );
  }

  const reviewCount =
    result.discovery.review.length;

  if (reviewCount === 0) {
    coverage += 10;

    signals.push(
      "No discovered repositories currently require relationship review."
    );
  } else if (reviewCount <= 2) {
    coverage += 5;

    limitations.push(
      `${reviewCount} repositories still require relationship review.`
    );
  } else {
    coverage -= 5;

    limitations.push(
      `${reviewCount} repositories still require relationship review, reducing structural certainty.`
    );
  }

  const minimumCoreConfidence =
    getMinimumCoreConfidence(result);

  if (minimumCoreConfidence >= 80) {
    coverage += 10;

    signals.push(
      `All approved core repositories have relation confidence of at least ${minimumCoreConfidence}/100.`
    );
  } else if (
    minimumCoreConfidence >= 55
  ) {
    coverage += 5;

    limitations.push(
      `The weakest approved core relationship has confidence of ${minimumCoreConfidence}/100.`
    );
  } else {
    coverage -= 10;

    limitations.push(
      "At least one approved core repository has weak relationship evidence."
    );
  }

  const latestCorePushDate =
    getLatestCorePushDate(result);

  const daysSinceLatestCorePush =
    getDaysSince(
      latestCorePushDate
    );

  if (
    daysSinceLatestCorePush !== null &&
    daysSinceLatestCorePush <= 30
  ) {
    coverage += 10;

    signals.push(
      "At least one approved core repository was updated within the last 30 days."
    );
  } else if (
    daysSinceLatestCorePush !== null &&
    daysSinceLatestCorePush <= 120
  ) {
    coverage += 5;

    signals.push(
      "Approved core development was visible within the last 120 days."
    );
  } else if (
    daysSinceLatestCorePush !== null &&
    daysSinceLatestCorePush > 180
  ) {
    coverage -= 15;

    limitations.push(
      `No approved core repository has been pushed to for ${daysSinceLatestCorePush} days.`
    );
  } else {
    limitations.push(
      "Recent core repository activity could not be established."
    );
  }

  if (profile.privacySensitive) {
    limitations.push(
      "The project has a privacy-sensitive context, so private development may not be publicly observable."
    );
  }

  const finalCoverage =
    clampScore(coverage);

  const confidence =
    getConfidence(finalCoverage);

  return {
    coverage:
      finalCoverage,

    confidence,

    visibility:
      getVisibility(finalCoverage),

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

export function formatAutomaticPublicEvidence(
  agent: RegisteredAgent,
  profile: AgentEvidenceProfile,
  result: ProjectScoreResult,
  assessment: PublicEvidenceAssessment
): string {
  const latestCorePush =
    getDaysSince(
      getLatestCorePushDate(result)
    );

  return [
    "CLARITY AUTOMATIC PUBLIC EVIDENCE",
    "",
    `Agent: ${agent.name}`,
    `Anchor: ${result.discovery.anchor.fullName}`,
    "",
    `Public Evidence Coverage  ${assessment.coverage}/100`,
    `Rating Confidence         ${formatConfidence(
      assessment.confidence
    )}`,
    `Detected Visibility       ${assessment.visibility}`,
    "",
    `Interpretation: ${assessment.interpretation}`,
    "",
    "Observed inputs:",
    `- Anchor scope: ${agent.github.scope}`,
    `- Dedicated brand account: ${
      result.discovery.dedicatedBrandAccount
        ? "yes"
        : "no"
    }`,
    `- Core repositories: ${result.metrics.repositories.length}`,
    `- Ecosystem repositories: ${result.ecosystem.length}`,
    `- Repositories requiring review: ${result.discovery.review.length}`,
    `- Minimum core relation confidence: ${getMinimumCoreConfidence(
      result
    )}/100`,
    `- Latest core push: ${
      latestCorePush === null
        ? "unknown"
        : `${latestCorePush} days ago`
    }`,
    `- README detected: ${
      result.metrics.aggregate
        .activity.hasReadme
        ? "yes"
        : "no"
    }`,
    "",
    "Positive evidence:",
    ...(
      assessment.signals.length > 0
        ? assessment.signals.map(
            (signal) =>
              `- ${signal}`
          )
        : [
            "- No strong positive evidence signals were detected."
          ]
    ),
    "",
    "Evidence limitations:",
    ...(
      assessment.limitations.length > 0
        ? assessment.limitations.map(
            (limitation) =>
              `- ${limitation}`
          )
        : [
            "- No major evidence limitations were detected."
          ]
    ),
    "",
    `Context note: ${profile.note}`,
    "",
    "Important:",
    "The coverage score above is calculated from observed project structure and repository activity.",
    "The manual visibility label stored in the registry does not affect this automatic score.",
    "Public Evidence Coverage measures data completeness, not project quality."
  ].join("\n");
}

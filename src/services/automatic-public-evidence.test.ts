import assert from "node:assert/strict";
import test from "node:test";

import type {
  AgentEvidenceProfile
} from "../data/agent-evidence.js";

import type {
  RegisteredAgent
} from "../data/agent-registry.js";

import {
  assessAutomaticPublicEvidence
} from "./automatic-public-evidence.js";

import type {
  ProjectScoreResult
} from "./project-score.js";

const DAY_IN_MILLISECONDS =
  24 * 60 * 60 * 1000;

type EvidenceFixtureOptions = {
  scope?: "primary" | "component";
  dedicatedBrandAccount?: boolean;
  coreCount?: number;
  ecosystemCount?: number;
  hasReadme?: boolean;
  reviewCount?: number;
  coreRelationScores?: number[];
  daysSinceLatestPush?: number | null;
  privacySensitive?: boolean;
};

type EvidenceFixture = {
  agent: RegisteredAgent;
  profile: AgentEvidenceProfile;
  result: ProjectScoreResult;
};

function getPushDate(
  daysSinceLatestPush:
    number | null
): string | null {
  if (
    daysSinceLatestPush === null
  ) {
    return null;
  }

  return new Date(
    Date.now() -
      daysSinceLatestPush *
        DAY_IN_MILLISECONDS
  ).toISOString();
}

function createFixture(
  options:
    EvidenceFixtureOptions = {}
): EvidenceFixture {
  const coreCount =
    options.coreCount ?? 1;

  const coreRelationScores =
    options.coreRelationScores ??
    Array.from(
      {
        length:
          coreCount
      },

      () => 85
    );

  const pushedAt =
    getPushDate(
      options.daysSinceLatestPush ??
        null
    );

  const agent = {
    slug: "test-agent",
    name: "Test Agent",

    github: {
      owner: "test-owner",
      repository: "test-agent",

      scope:
        options.scope ??
        "primary"
    }
  } as unknown as RegisteredAgent;

  const profile = {
    visibility: "unknown",

    privacySensitive:
      options.privacySensitive ??
      false,

    note:
      "Test evidence profile."
  } as AgentEvidenceProfile;

  const result = {
    discovery: {
      dedicatedBrandAccount:
        options.dedicatedBrandAccount ??
        false,

      review:
        Array.from(
          {
            length:
              options.reviewCount ?? 0
          },

          () => ({})
        )
    },

    metrics: {
      repositories:
        Array.from(
          {
            length:
              coreCount
          },

          () => ({
            data: {
              pushedAt
            }
          })
        ),

      aggregate: {
        activity: {
          hasReadme:
            options.hasReadme ??
            false
        }
      }
    },

    coreMatches:
      coreRelationScores.map(
        (relationScore) => ({
          relationScore
        })
      ),

    ecosystem:
      Array.from(
        {
          length:
            options.ecosystemCount ?? 0
        },

        () => ({})
      )
  } as unknown as ProjectScoreResult;

  return {
    agent,
    profile,
    result
  };
}

function assess(
  options:
    EvidenceFixtureOptions
) {
  const fixture =
    createFixture(options);

  return assessAutomaticPublicEvidence(
    fixture.agent,
    fixture.profile,
    fixture.result
  );
}

test(
  "clamps strong public evidence at 100",
  () => {
    const assessment =
      assess({
        scope: "primary",
        dedicatedBrandAccount: true,
        coreCount: 2,
        ecosystemCount: 1,
        hasReadme: true,
        reviewCount: 0,

        coreRelationScores: [
          100,
          85
        ],

        daysSinceLatestPush: 0
      });

    assert.equal(
      assessment.coverage,
      100
    );

    assert.equal(
      assessment.confidence,
      "high"
    );

    assert.equal(
      assessment.visibility,
      "public-heavy"
    );
  }
);

test(
  "treats coverage of exactly 75 as high confidence",
  () => {
    const assessment =
      assess({
        scope: "primary",
        dedicatedBrandAccount: false,
        coreCount: 1,
        ecosystemCount: 1,
        hasReadme: true,
        reviewCount: 1,

        coreRelationScores: [
          60
        ],

        daysSinceLatestPush: null
      });

    assert.equal(
      assessment.coverage,
      75
    );

    assert.equal(
      assessment.confidence,
      "high"
    );

    assert.equal(
      assessment.visibility,
      "public-heavy"
    );
  }
);

test(
  "treats coverage of exactly 45 as medium confidence",
  () => {
    const assessment =
      assess({
        scope: "component",
        dedicatedBrandAccount: true,
        coreCount: 1,
        ecosystemCount: 0,
        hasReadme: true,
        reviewCount: 1,

        coreRelationScores: [
          60
        ],

        daysSinceLatestPush: 100
      });

    assert.equal(
      assessment.coverage,
      45
    );

    assert.equal(
      assessment.confidence,
      "medium"
    );

    assert.equal(
      assessment.visibility,
      "partial"
    );
  }
);

test(
  "clamps weak and stale public evidence at zero",
  () => {
    const assessment =
      assess({
        scope: "component",
        dedicatedBrandAccount: false,
        coreCount: 1,
        ecosystemCount: 0,
        hasReadme: false,
        reviewCount: 3,

        coreRelationScores: [
          40
        ],

        daysSinceLatestPush: 181
      });

    assert.equal(
      assessment.coverage,
      0
    );

    assert.equal(
      assessment.confidence,
      "low"
    );

    assert.equal(
      assessment.visibility,
      "unknown"
    );

    assert.ok(
      assessment.limitations.some(
        (limitation) =>
          limitation.includes(
            "181 days"
          )
      )
    );
  }
);

test(
  "privacy-sensitive context adds a limitation but does not change coverage",
  () => {
    const commonOptions:
    EvidenceFixtureOptions = {
      scope: "primary",
      dedicatedBrandAccount: false,
      coreCount: 1,
      ecosystemCount: 1,
      hasReadme: true,
      reviewCount: 1,

      coreRelationScores: [
        60
      ],

      daysSinceLatestPush: null
    };

    const publicAssessment =
      assess({
        ...commonOptions,

        privacySensitive:
          false
      });

    const privateAssessment =
      assess({
        ...commonOptions,

        privacySensitive:
          true
      });

    assert.equal(
      privateAssessment.coverage,
      publicAssessment.coverage
    );

    assert.equal(
      privateAssessment.confidence,
      publicAssessment.confidence
    );

    assert.equal(
      publicAssessment.limitations.some(
        (limitation) =>
          limitation.includes(
            "privacy-sensitive"
          )
      ),
      false
    );

    assert.equal(
      privateAssessment.limitations.some(
        (limitation) =>
          limitation.includes(
            "privacy-sensitive"
          )
      ),
      true
    );
  }
);

test(
  "caps evidence for a single repository on a differently named account",
  () => {
    const assessment =
      assess({
        scope: "primary",
        dedicatedBrandAccount: false,
        coreCount: 1,
        ecosystemCount: 0,
        hasReadme: true,
        reviewCount: 1,

        coreRelationScores: [
          100
        ],

        daysSinceLatestPush: 0
      });

    assert.equal(
      assessment.coverage,
      70
    );

    assert.equal(
      assessment.confidence,
      "medium"
    );

    assert.equal(
      assessment.visibility,
      "partial"
    );

    assert.ok(
      assessment.limitations.some(
        (limitation) =>
          limitation.includes(
            "capped below high confidence"
          )
      )
    );
  }
);

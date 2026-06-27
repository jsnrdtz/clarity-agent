import {
  ClarityError
} from "../errors/clarity-error.js";

import {
getAgentEvidenceProfile
} from "../data/agent-evidence.js";

import {
findRegisteredAgent
} from "../data/agent-registry.js";

import {
assessAutomaticPublicEvidence
} from "./automatic-public-evidence.js";

import {
type ProjectRepositoryMatch
} from "./github-project-discovery.js";

import {
calculateProjectScore
} from "./project-score.js";

export type AgentEvaluation = {
schemaVersion: "1.0";

agent: {
slug: string;
name: string;
};

github: {
owner: string;
anchorRepository: string;
anchorFullName: string;
anchorUrl: string;
anchorScope: string;
dedicatedBrandAccount: boolean;
};

scores: {
github: {
overall: number;
activity: number;
collaboration: number;
adoption: number;
releases: number;
dataCoverage: number;
};

publicEvidence: {
  coverage: number;
  confidence: "high" | "medium" | "low";
  detectedVisibility:
    | "public-heavy"
    | "partial"
    | "unknown";

  interpretation: string;
  signals: string[];
  limitations: string[];
};

};

repositories: {
core: Array<{
owner: string;
name: string;
fullName: string;
url: string;
role: string;
relationScore: number;
isAnchor: boolean;
stars: number;
forks: number;
commitsLast30Days: number;
adjustedActivityContribution: number;
contributors: number;
releasesLast90Days: number;
pushedAt: string | null;
}>;

ecosystem: Array<{
  fullName: string;
  url: string;
  role: string;
  relationStatus: string;
  relationScore: number;
  stars: number;
  daysSincePush: number | null;
}>;

review: Array<{
  fullName: string;
  url: string;
  role: string;
  relationStatus: string;
  relationScore: number;
  stars: number;
  daysSincePush: number | null;
}>;

};

summary: {
coreRepositories: number;
ecosystemRepositories: number;
reviewRepositories: number;
unrelatedRepositoriesHidden: number;
excludedRepositories: number;
rawCommitsLast30Days: number;
adjustedActivity: number;
uniqueContributors: number;
};

eligibility: {
ranking: {
eligible: boolean;
reason: string;
};

comparison: {
  eligible: boolean;
  reason: string;
};

};

context: {
privacySensitive: boolean;
registryVisibilityLabel: string;
registryNote: string;
affectsAutomaticCoverageScore: false;
};

sourceCollectedAt: string;
collectedAt: string;
};

function formatRelatedRepository(
match: ProjectRepositoryMatch
): {
fullName: string;
url: string;
role: string;
relationStatus: string;
relationScore: number;
stars: number;
daysSincePush: number | null;
} {
return {
fullName:
match.repository.fullName,

url:
  match.repository.url,

role:
  match.role,

relationStatus:
  match.status,

relationScore:
  match.relationScore,

stars:
  match.repository.stars,

daysSincePush:
  match.repository.daysSincePush

};
}

function getEligibilityReason(
confidence: "high" | "medium" | "low"
): string {
if (confidence === "low") {
return (
"Insufficient automatically verified public evidence."
);
}

return (
"Automatic public evidence confidence is sufficient."
);
}

export async function buildAgentEvaluation(
agentSlug: string
): Promise<AgentEvaluation> {
const agent =
findRegisteredAgent(agentSlug);

if (!agent) {
throw new ClarityError(
"AGENT_NOT_FOUND",
`Agent "${agentSlug}" is not registered.`,
404
);
}

const result =
await calculateProjectScore(
agent.name,
agent.github.owner,
agent.github.repository
);

const profile =
getAgentEvidenceProfile(
agent.slug
);

const evidence =
assessAutomaticPublicEvidence(
agent,
profile,
result
);

const eligible =
evidence.confidence !== "low";

const eligibilityReason =
getEligibilityReason(
evidence.confidence
);

const coreRepositories =
result.metrics.repositories.map(
(repository) => ({
owner:
repository.data.owner,

    name:
      repository.data.name,

    fullName:
      `${repository.data.owner}/${repository.data.name}`,

    url:
      repository.data.url,

    role:
      repository.input.role,

    relationScore:
      repository.input.relationScore,

    isAnchor:
      repository.input.isAnchor,

    stars:
      repository.data.stars,

    forks:
      repository.data.forks,

    commitsLast30Days:
      repository.data.activity
        .commitsLast30Days,

    adjustedActivityContribution:
      repository
        .adjustedCommitContribution,

    contributors:
      repository.data.activity
        .contributors,

    releasesLast90Days:
      repository.data.activity
        .releasesLast90Days,

    pushedAt:
      repository.data.pushedAt
  })
);

return {
schemaVersion: "1.0",


agent: {
  slug:
    agent.slug,

  name:
    agent.name
},

github: {
  owner:
    agent.github.owner,

  anchorRepository:
    agent.github.repository,

  anchorFullName:
    result.discovery.anchor.fullName,

  anchorUrl:
    result.discovery.anchor.url,

  anchorScope:
    agent.github.scope,

  dedicatedBrandAccount:
    result.discovery
      .dedicatedBrandAccount
},

scores: {
  github: {
    overall:
      result.score.overall,

    activity:
      result.score.activity,

    collaboration:
      result.score.collaboration,

    adoption:
      result.score.adoption,

    releases:
      result.score.releases,

    dataCoverage:
      result.score.dataCoverage
  },

  publicEvidence: {
    coverage:
      evidence.coverage,

    confidence:
      evidence.confidence,

    detectedVisibility:
      evidence.visibility,

    interpretation:
      evidence.interpretation,

    signals:
      evidence.signals,

    limitations:
      evidence.limitations
  }
},

repositories: {
  core:
    coreRepositories,

  ecosystem:
    result.ecosystem.map(
      formatRelatedRepository
    ),

  review:
    result.discovery.review.map(
      formatRelatedRepository
    )
},

summary: {
  coreRepositories:
    result.metrics.repositories.length,

  ecosystemRepositories:
    result.ecosystem.length,

  reviewRepositories:
    result.discovery.review.length,

  unrelatedRepositoriesHidden:
    result.discovery.unrelated.length,

  excludedRepositories:
    result.discovery.excluded.length,

  rawCommitsLast30Days:
    result.metrics
      .rawCommitsLast30Days,

  adjustedActivity:
    result.metrics
      .adjustedCommitsLast30Days,

  uniqueContributors:
    result.metrics.uniqueContributors
},

eligibility: {
  ranking: {
    eligible,
    reason:
      eligibilityReason
  },

  comparison: {
    eligible,
    reason:
      eligibilityReason
  }
},

context: {
  privacySensitive:
    profile.privacySensitive,

  registryVisibilityLabel:
    profile.visibility,

  registryNote:
    profile.note,

  affectsAutomaticCoverageScore:
    false
},

sourceCollectedAt:
  result.discovery.collectedAt,

collectedAt:
  new Date().toISOString()

};
}

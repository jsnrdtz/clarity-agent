import {
  randomUUID
} from "node:crypto";

import {
  mkdir,
  rename,
  unlink,
  writeFile
} from "node:fs/promises";

import {
  dirname
} from "node:path";

import {
  z
} from "zod";

import type {
  BankrCandidate
} from "./bankr-candidate.js";

import type {
  BankrGlobalGitHubRepositoryMatch
} from "./bankr-global-github-search.js";

import type {
  BankrOwnerRepositoryMatch
} from "./bankr-owner-repository.js";

const AutomaticGitHubCandidateSchema =
  z.object(
    {
      owner:
        z.string().min(1),

      repository:
        z.string().min(1),

      fullName:
        z.string().min(1),

      url:
        z.string().url(),

      scope:
        z.enum(
          [
            "primary",
            "component"
          ]
        ),

      status:
        z.enum(
          [
            "verified",
            "probable"
          ]
        ),

      source:
        z.enum(
          [
            "direct-evidence",
            "owner-discovery",
            "global-search"
          ]
        ),

      score:
        z.number()
          .min(0)
          .max(100),

      evidence:
        z.array(
          z.string()
        )
    }
  );

const AutomaticAgentIdentitySchema =
  z.object(
    {
      source:
        z.literal(
          "bankr"
        ),

      bankrProfileId:
        z.string().min(1),

      slug:
        z.string().min(1),

      name:
        z.string().min(1),

      aliases:
        z.array(
          z.string().min(1)
        ),

      description:
        z.string().nullable(),

      website:
        z.string().nullable(),

      twitterUsername:
        z.string().nullable(),

      token:
        z.object(
          {
            chainId:
              z.string().min(1),

            address:
              z.string().min(1),

            identity:
              z.string().min(1),

            symbol:
              z.string().min(1),

            name:
              z.string().min(1)
          }
        ),

      market:
        z.object(
          {
            marketCapUsd:
              z.number().nonnegative(),

            weeklyRevenueWeth:
              z.string().nullable()
          }
        ),

      github:
        z.object(
          {
            status:
              z.enum(
                [
                  "verified",
                  "probable",
                  "unresolved"
                ]
              ),

            conflict:
              z.boolean(),

            selected:
              AutomaticGitHubCandidateSchema
                .nullable(),

            candidates:
              z.array(
                AutomaticGitHubCandidateSchema
              )
          }
        ),

      eligibility:
        z.object(
          {
            agentScore:
              z.boolean(),

            tokenScore:
              z.boolean(),

            reasons:
              z.array(
                z.string()
              )
          }
        ),

      warnings:
        z.array(
          z.string()
        ),

      createdAt:
        z.string().min(1)
    }
  );

export const AutomaticAgentRegistrySchema =
  z.object(
    {
      schemaVersion:
        z.literal(
          "1.0"
        ),

      source:
        z.literal(
          "bankr"
        ),

      generatedAt:
        z.string().min(1),

      summary:
        z.object(
          {
            total:
              z.number()
                .int()
                .nonnegative(),

            githubVerified:
              z.number()
                .int()
                .nonnegative(),

            githubProbable:
              z.number()
                .int()
                .nonnegative(),

            githubUnresolved:
              z.number()
                .int()
                .nonnegative(),

            agentScoreEligible:
              z.number()
                .int()
                .nonnegative(),

            tokenScoreEligible:
              z.number()
                .int()
                .nonnegative()
          }
        ),

      agents:
        z.array(
          AutomaticAgentIdentitySchema
        )
    }
  );

export type AutomaticGitHubCandidate =
  z.infer<
    typeof AutomaticGitHubCandidateSchema
  >;

export type AutomaticAgentIdentity =
  z.infer<
    typeof AutomaticAgentIdentitySchema
  >;

export type AutomaticAgentRegistry =
  z.infer<
    typeof AutomaticAgentRegistrySchema
  >;

export type AutomaticAgentRegistryInput = {
  generatedAt: string;

  candidates:
    BankrCandidate[];

  ownerDiscovery: {
    results:
      Array<{
        bankrProfileId: string;

        status:
          | "probable"
          | "review"
          | "not-found"
          | "failed";

        candidates:
          BankrOwnerRepositoryMatch[];
      }>;
  };

  globalGitHubDiscovery: {
    results:
      Array<{
        bankrProfileId: string;

        candidates:
          BankrGlobalGitHubRepositoryMatch[];
      }>;
  };
};

const STATUS_PRIORITY:
  Record<
    AutomaticGitHubCandidate["status"],
    number
  > = {
    verified:
      2,

    probable:
      1
  };

const SCOPE_PRIORITY:
  Record<
    AutomaticGitHubCandidate["scope"],
    number
  > = {
    primary:
      2,

    component:
      1
  };

const SOURCE_PRIORITY:
  Record<
    AutomaticGitHubCandidate["source"],
    number
  > = {
    "direct-evidence":
      3,

    "global-search":
      2,

    "owner-discovery":
      1
  };

function normalizeValue(
  value: string
): string {
  return value
    .trim()
    .toLowerCase();
}

function createRepositoryKey(
  owner: string,
  repository: string
): string {
  return [
    normalizeValue(
      owner
    ),

    normalizeValue(
      repository
    )
  ].join("/");
}

function uniqueStrings(
  values:
    Array<
      string |
      null |
      undefined
    >
): string[] {
  const result:
    string[] =
    [];

  const seen =
    new Set<string>();

  for (
    const rawValue
    of values
  ) {
    const value =
      rawValue?.trim() ??
      "";

    if (!value) {
      continue;
    }

    const key =
      normalizeValue(
        value
      );

    if (
      seen.has(
        key
      )
    ) {
      continue;
    }

    seen.add(
      key
    );

    result.push(
      value
    );
  }

  return result;
}

function compareGitHubCandidates(
  left:
    AutomaticGitHubCandidate,

  right:
    AutomaticGitHubCandidate
): number {
  return (
    STATUS_PRIORITY[
      right.status
    ] -
      STATUS_PRIORITY[
        left.status
      ] ||

    SCOPE_PRIORITY[
      right.scope
    ] -
      SCOPE_PRIORITY[
        left.scope
      ] ||

    right.score -
      left.score ||

    SOURCE_PRIORITY[
      right.source
    ] -
      SOURCE_PRIORITY[
        left.source
      ] ||

    left.fullName.localeCompare(
      right.fullName
    )
  );
}

function collectDirectCandidates(
  candidate:
    BankrCandidate
): AutomaticGitHubCandidate[] {
  const result:
    AutomaticGitHubCandidate[] =
    [];

  for (
    const repository
    of candidate.githubRepositories
  ) {
    const scope =
      repository.relationship ===
        "primary"
        ? "primary"
        : repository.relationship ===
            "component"
          ? "component"
          : null;

    if (
      !scope ||
      repository.confidence ===
        "low"
    ) {
      continue;
    }

    const status =
      repository.confidence ===
        "high"
        ? "verified"
        : "probable";

    result.push(
      {
        owner:
          repository.owner,

        repository:
          repository.repository,

        fullName:
          `${repository.owner}/${repository.repository}`,

        url:
          repository.url,

        scope,

        status,

        source:
          "direct-evidence",

        score:
          repository.confidence ===
            "high"
            ? 100
            : 75,

        evidence:
          uniqueStrings(
            [
              `Direct Bankr evidence classified this repository as ${repository.relationship}.`,
              ...repository.reasons
            ]
          )
      }
    );
  }

  return result;
}

function collectOwnerCandidates(
  candidate:
    BankrCandidate,

  input:
    AutomaticAgentRegistryInput
): AutomaticGitHubCandidate[] {
  const result =
    input
      .ownerDiscovery
      .results
      .find(
        (entry) =>
          entry.bankrProfileId ===
            candidate.bankrProfileId
      );

  if (
    !result ||
    (
      result.status !==
        "probable" &&
      result.status !==
        "review"
    )
  ) {
    return [];
  }

  return result
    .candidates
    .filter(
      (repository) =>
        repository.score >=
          55
    )
    .map(
      (
        repository
      ): AutomaticGitHubCandidate => ({
        owner:
          repository.owner,

        repository:
          repository.repository,

        fullName:
          `${repository.owner}/${repository.repository}`,

        url:
          repository.url,

        scope:
          "primary",

        status:
          "probable",

        source:
          "owner-discovery",

        score:
          repository.score,

        evidence:
          uniqueStrings(
            [
              "Repository was discovered from a GitHub owner linked by official project evidence.",
              ...repository.reasons
            ]
          )
      })
    );
}

function getGlobalScope(
  repository:
    BankrGlobalGitHubRepositoryMatch
):
  | "primary"
  | "component"
  | null {
  if (
    repository.role ===
      "primary-candidate"
  ) {
    return "primary";
  }

  if (
    repository.role ===
      "component"
  ) {
    return "component";
  }

  return null;
}

function collectGlobalCandidates(
  candidate:
    BankrCandidate,

  input:
    AutomaticAgentRegistryInput
): AutomaticGitHubCandidate[] {
  const result =
    input
      .globalGitHubDiscovery
      .results
      .find(
        (entry) =>
          entry.bankrProfileId ===
            candidate.bankrProfileId
      );

  if (!result) {
    return [];
  }

  const candidates:
    AutomaticGitHubCandidate[] =
    [];

  for (
    const repository
    of result.candidates
  ) {
    if (
      repository.status !==
        "probable" &&
      repository.status !==
        "review"
    ) {
      continue;
    }

    const scope =
      getGlobalScope(
        repository
      );

    if (!scope) {
      continue;
    }

    const status =
      repository.status ===
        "probable" &&
      scope ===
        "primary"
        ? "verified"
        : "probable";

    candidates.push(
      {
        owner:
          repository.owner,

        repository:
          repository.repository,

        fullName:
          repository.fullName,

        url:
          repository.url,

        scope,

        status,

        source:
          "global-search",

        score:
          repository.score,

        evidence:
          uniqueStrings(
            [
              "Repository was discovered through global GitHub identity search.",
              ...repository.reasons
            ]
          )
      }
    );
  }

  return candidates;
}

function deduplicateCandidates(
  candidates:
    AutomaticGitHubCandidate[]
): AutomaticGitHubCandidate[] {
  const deduplicated =
    new Map<
      string,
      AutomaticGitHubCandidate
    >();

  for (
    const candidate
    of candidates
  ) {
    const key =
      createRepositoryKey(
        candidate.owner,
        candidate.repository
      );

    const current =
      deduplicated.get(
        key
      );

    if (!current) {
      deduplicated.set(
        key,
        candidate
      );

      continue;
    }

    const ordered =
      [
        current,
        candidate
      ].sort(
        compareGitHubCandidates
      );

    const selected =
      ordered[0];

    if (!selected) {
      continue;
    }

    deduplicated.set(
      key,
      {
        ...selected,

        evidence:
          uniqueStrings(
            [
              ...current.evidence,
              ...candidate.evidence
            ]
          )
      }
    );
  }

  return [
    ...deduplicated.values()
  ].sort(
    compareGitHubCandidates
  );
}

function resolveGitHubIdentity(
  candidate:
    BankrCandidate,

  input:
    AutomaticAgentRegistryInput
): AutomaticAgentIdentity["github"] {
  const candidates =
    deduplicateCandidates(
      [
        ...collectDirectCandidates(
          candidate
        ),

        ...collectOwnerCandidates(
          candidate,
          input
        ),

        ...collectGlobalCandidates(
          candidate,
          input
        )
      ]
    );

  const top =
    candidates[0];

  if (!top) {
    return {
      status:
        "unresolved",

      conflict:
        false,

      selected:
        null,

      candidates:
        []
    };
  }

  const competing =
    candidates.filter(
      (entry) =>
        entry.status ===
          top.status &&
        entry.scope ===
          top.scope &&
        top.score -
          entry.score <=
        10
    );

  if (
    competing.length > 1
  ) {
    return {
      status:
        "unresolved",

      conflict:
        true,

      selected:
        null,

      candidates
    };
  }

  return {
    status:
      top.status,

    conflict:
      false,

    selected:
      top,

    candidates
  };
}

function buildEligibility(
  candidate:
    BankrCandidate,

  github:
    AutomaticAgentIdentity["github"]
): AutomaticAgentIdentity["eligibility"] {
  const reasons:
    string[] =
    [];

  const agentScore =
    github.status ===
      "verified" &&
    github.selected?.scope ===
      "primary";

  if (agentScore) {
    reasons.push(
      "Verified primary GitHub repository is available for engineering evaluation."
    );
  } else if (
    github.conflict
  ) {
    reasons.push(
      "Agent Score is blocked because multiple GitHub repositories have similar identity evidence."
    );
  } else if (
    github.selected?.scope ===
      "component"
  ) {
    reasons.push(
      "Agent Score is blocked because the selected GitHub repository is a component rather than the primary project."
    );
  } else {
    reasons.push(
      "Agent Score is blocked until a primary GitHub repository is verified automatically."
    );
  }

  const tokenScore =
    Boolean(
      candidate.token.chainId
        .trim()
    ) &&
    Boolean(
      candidate.token.address
        .trim()
    );

  if (tokenScore) {
    reasons.push(
      "Token identity is available for onchain enrichment and Token Score."
    );
  } else {
    reasons.push(
      "Token Score is unavailable because the project has no valid token identity."
    );
  }

  return {
    agentScore,
    tokenScore,
    reasons
  };
}

function buildAgentIdentity(
  candidate:
    BankrCandidate,

  input:
    AutomaticAgentRegistryInput
): AutomaticAgentIdentity {
  const github =
    resolveGitHubIdentity(
      candidate,
      input
    );

  const twitterUsername =
    candidate
      .twitterUsername
      ?.replace(
        /^@/u,
        ""
      ) ??
    null;

  const aliases =
    uniqueStrings(
      [
        candidate.bankrSlug,
        candidate.name,
        twitterUsername,
        twitterUsername
          ? `@${twitterUsername}`
          : null
      ]
    );

  return {
    source:
      "bankr",

    bankrProfileId:
      candidate.bankrProfileId,

    slug:
      candidate.bankrSlug,

    name:
      candidate.name,

    aliases,

    description:
      candidate.description,

    website:
      candidate.website,

    twitterUsername,

    token: {
      ...candidate.token
    },

    market: {
      marketCapUsd:
        candidate.marketCapUsd,

      weeklyRevenueWeth:
        candidate.weeklyRevenueWeth
    },

    github,

    eligibility:
      buildEligibility(
        candidate,
        github
      ),

    warnings:
      [
        ...candidate.warnings
      ],

    createdAt:
      candidate.createdAt
  };
}

export function buildAutomaticAgentRegistry(
  input:
    AutomaticAgentRegistryInput
): AutomaticAgentRegistry {
  const agents =
    input
      .candidates
      .map(
        (candidate) =>
          buildAgentIdentity(
            candidate,
            input
          )
      )
      .sort(
        (
          left,
          right
        ) =>
          left.slug.localeCompare(
            right.slug
          )
      );

  const registry = {
    schemaVersion:
      "1.0" as const,

    source:
      "bankr" as const,

    generatedAt:
      input.generatedAt,

    summary: {
      total:
        agents.length,

      githubVerified:
        agents.filter(
          (agent) =>
            agent.github.status ===
              "verified"
        ).length,

      githubProbable:
        agents.filter(
          (agent) =>
            agent.github.status ===
              "probable"
        ).length,

      githubUnresolved:
        agents.filter(
          (agent) =>
            agent.github.status ===
              "unresolved"
        ).length,

      agentScoreEligible:
        agents.filter(
          (agent) =>
            agent.eligibility.agentScore
        ).length,

      tokenScoreEligible:
        agents.filter(
          (agent) =>
            agent.eligibility.tokenScore
        ).length
    },

    agents
  };

  return AutomaticAgentRegistrySchema.parse(
    registry
  );
}

export function getAutomaticAgentRegistryPath():
string {
  return (
    process.env
      .CLARITY_AUTOMATIC_AGENT_REGISTRY_PATH ??
    "data/registry/bankr-agents.json"
  );
}

export async function saveAutomaticAgentRegistry(
  registry:
    AutomaticAgentRegistry,

  outputPath =
    getAutomaticAgentRegistryPath()
): Promise<string> {
  const validated =
    AutomaticAgentRegistrySchema.parse(
      registry
    );

  await mkdir(
    dirname(
      outputPath
    ),
    {
      recursive:
        true
    }
  );

  const temporaryPath =
    `${outputPath}.${randomUUID()}.tmp`;

  try {
    await writeFile(
      temporaryPath,

      JSON.stringify(
        validated,
        null,
        2
      ) + "\n",

      "utf8"
    );

    await rename(
      temporaryPath,
      outputPath
    );
  } catch (error) {
    await unlink(
      temporaryPath
    ).catch(
      () => undefined
    );

    throw error;
  }

  return outputPath;
}

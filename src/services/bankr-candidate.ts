import type {
  BankrAgentProfileDetail
} from "./bankr-client.js";

import {
  classifyBankrGitHubEvidence
} from "./bankr-github-evidence.js";

import type {
  BankrGitHubEvidenceClassification,
  BankrGitHubEvidenceConfidence,
  BankrGitHubRelationship
} from "./bankr-github-evidence.js";

export type BankrGitHubEvidenceSource =
  | "description"
  | "website"
  | "team-member-link"
  | "product-url"
  | "product-description"
  | "project-update";

export type BankrGitHubRepository = {
  owner: string;
  repository: string;
  url: string;
  sources: BankrGitHubEvidenceSource[];

  relationship:
    BankrGitHubRelationship;

  confidence:
    BankrGitHubEvidenceConfidence;

  reasons:
    string[];
};

export type BankrCandidateWarning =
  | "missing-description"
  | "missing-website"
  | "missing-twitter"
  | "no-github-repository"
  | "unapproved-profile"
  | "shared-token-identity";

export type BankrCandidate = {
  source: "bankr";

  bankrProfileId: string;
  bankrSlug: string;

  name: string;
  description: string | null;

  token: {
    chainId: string;
    address: string;
    identity: string;
    symbol: string;
    name: string;
  };

  twitterUsername: string | null;
  website: string | null;

  marketCapUsd: number;
  weeklyRevenueWeth: string | null;
  createdAt: string;

  githubRepositories:
    BankrGitHubRepository[];

  warnings:
    BankrCandidateWarning[];
};

export type BankrCandidateConflictGroup = {
  key: string;
  profileIds: string[];
  slugs: string[];
};

export type BankrCandidateReport = {
  generatedAt: string;
  profilesReceived: number;
  candidates: BankrCandidate[];

  conflicts: {
    profileIds:
      BankrCandidateConflictGroup[];

    slugs:
      BankrCandidateConflictGroup[];

    tokenIdentities:
      BankrCandidateConflictGroup[];
  };
};

type TextEvidence = {
  source:
    BankrGitHubEvidenceSource;

  text: string;
};

const
GITHUB_REPOSITORY_URL_PATTERN =
  /\b(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[^\s<>"')\]}]*)?/gi;

const RESERVED_GITHUB_OWNERS =
  new Set(
    [
      "about",
      "collections",
      "customer-stories",
      "enterprise",
      "events",
      "explore",
      "features",
      "login",
      "marketplace",
      "notifications",
      "organizations",
      "pricing",
      "readme",
      "search",
      "security",
      "settings",
      "signup",
      "site",
      "sponsors",
      "topics"
    ]
  );

const GITHUB_SOURCE_ORDER:
  BankrGitHubEvidenceSource[] =
    [
      "website",
      "product-url",
      "team-member-link",
      "description",
      "product-description",
      "project-update"
    ];

const GITHUB_CONFIDENCE_PRIORITY:
  Record<
    BankrGitHubEvidenceConfidence,
    number
  > = {
    high:
      3,

    medium:
      2,

    low:
      1
  };

function getClassificationPriority(
  classification:
    Pick<
      BankrGitHubEvidenceClassification,
      "relationship" |
      "confidence"
    >
): number {
  const relationshipPriority =
    classification.relationship ===
      "unknown"
      ? 0
      : 10;

  return (
    relationshipPriority +
    GITHUB_CONFIDENCE_PRIORITY[
      classification.confidence
    ]
  );
}

function normalizeOptionalText(
  value:
    string |
    null |
    undefined
): string | null {
  const normalized =
    value?.trim() ?? "";

  return normalized
    ? normalized
    : null;
}

function createTokenIdentity(
  chainId: string,
  address: string
): string {
  return [
    chainId
      .trim()
      .toLowerCase(),

    address
      .trim()
      .toLowerCase()
  ].join(":");
}

function normalizeGitHubRepositoryUrl(
  rawValue: string
): {
  owner: string;
  repository: string;
  url: string;
} | null {
  const cleanedValue =
    rawValue
      .trim()
      .replace(
        /[.,;:!?]+$/u,
        ""
      );

  const valueWithProtocol =
    /^https?:\/\//i.test(
      cleanedValue
    )
      ? cleanedValue
      : `https://${cleanedValue}`;

  let parsedUrl: URL;

  try {
    parsedUrl =
      new URL(
        valueWithProtocol
      );
  } catch {
    return null;
  }

  const hostname =
    parsedUrl
      .hostname
      .toLowerCase();

  if (
    hostname !== "github.com" &&
    hostname !== "www.github.com"
  ) {
    return null;
  }

  const pathParts =
    parsedUrl
      .pathname
      .split("/")
      .filter(Boolean);

  const rawOwner =
    pathParts[0];

  const rawRepository =
    pathParts[1];

  if (
    !rawOwner ||
    !rawRepository
  ) {
    return null;
  }

  const owner =
    rawOwner.trim();

  const repository =
    rawRepository
      .trim()
      .replace(
        /\.git$/i,
        ""
      );

  if (
    !owner ||
    !repository
  ) {
    return null;
  }

  if (
    RESERVED_GITHUB_OWNERS.has(
      owner.toLowerCase()
    )
  ) {
    return null;
  }

  return {
    owner,
    repository,
    url:
      `https://github.com/${owner}/${repository}`
  };
}

function collectTextEvidence(
  profile:
    BankrAgentProfileDetail
): TextEvidence[] {
  const evidence:
    TextEvidence[] =
    [];

  const description =
    normalizeOptionalText(
      profile.description
    );

  if (description) {
    evidence.push(
      {
        source:
          "description",

        text:
          description
      }
    );
  }

  const website =
    normalizeOptionalText(
      profile.website
    );

  if (website) {
    evidence.push(
      {
        source:
          "website",

        text:
          website
      }
    );
  }

  for (
    const teamMember
    of profile.teamMembers
  ) {
    for (
      const link
      of teamMember.links
    ) {
      evidence.push(
        {
          source:
            "team-member-link",

          text:
            link.url
        }
      );
    }
  }

  for (
    const product
    of profile.products
  ) {
    if (product.url) {
      evidence.push(
        {
          source:
            "product-url",

          text:
            product.url
        }
      );
    }

    if (
      product
        .description
        .trim()
    ) {
      evidence.push(
        {
          source:
            "product-description",

          text:
            product.description
        }
      );
    }
  }

  for (
    const projectUpdate
    of profile.projectUpdates
  ) {
    const updateText =
      [
        projectUpdate.title,
        projectUpdate.content
      ]
        .filter(Boolean)
        .join("\n");

    if (
      updateText.trim()
    ) {
      evidence.push(
        {
          source:
            "project-update",

          text:
            updateText
        }
      );
    }
  }

  return evidence;
}

export function
extractBankrGitHubRepositories(
  profile:
    BankrAgentProfileDetail
): BankrGitHubRepository[] {
  const repositories =
    new Map<
      string,
      BankrGitHubRepository
    >();

  const textEvidence =
    collectTextEvidence(
      profile
    );

  for (
    const evidence
    of textEvidence
  ) {
    const matches =
      [
        ...evidence
          .text
          .matchAll(
            GITHUB_REPOSITORY_URL_PATTERN
          )
      ];

    for (
      const match
      of matches
    ) {
      const matchedUrl =
        match[0];

      const parsed =
        normalizeGitHubRepositoryUrl(
          matchedUrl
        );

      if (!parsed) {
        continue;
      }

      const matchIndex =
        match.index ?? 0;

      const contextStart =
        Math.max(
          0,
          matchIndex - 120
        );

      const contextEnd =
        Math.min(
          evidence.text.length,
          matchIndex +
          matchedUrl.length +
          120
        );

      const context =
        evidence
          .text
          .slice(
            contextStart,
            contextEnd
          );

      const classification =
        classifyBankrGitHubEvidence(
          {
            source:
              evidence.source,

            text:
              context,

            repositoryUrl:
              parsed.url
          }
        );

      const key =
        [
          parsed
            .owner
            .toLowerCase(),

          parsed
            .repository
            .toLowerCase()
        ].join("/");

      const existing =
        repositories.get(
          key
        );

      if (existing) {
        if (
          !existing
            .sources
            .includes(
              evidence.source
            )
        ) {
          existing
            .sources
            .push(
              evidence.source
            );
        }

        if (
          getClassificationPriority(
            classification
          ) >
          getClassificationPriority(
            existing
          )
        ) {
          existing.relationship =
            classification.relationship;

          existing.confidence =
            classification.confidence;

          existing.reasons =
            classification.reasons;
        }

        continue;
      }

      repositories.set(
        key,
        {
          ...parsed,

          sources: [
            evidence.source
          ],

          relationship:
            classification.relationship,

          confidence:
            classification.confidence,

          reasons:
            classification.reasons
        }
      );
    }
  }

  return [
    ...repositories.values()
  ]
    .map(
      (repository) => ({
        ...repository,

        sources:
          [
            ...repository.sources
          ].sort(
            (
              left,
              right
            ) =>
              GITHUB_SOURCE_ORDER
                .indexOf(left) -
              GITHUB_SOURCE_ORDER
                .indexOf(right)
          )
      })
    )
    .sort(
      (
        left,
        right
      ) =>
        left.url.localeCompare(
          right.url,
          "en",
          {
            sensitivity:
              "base"
          }
        )
    );
}

export function createBankrCandidate(
  profile:
    BankrAgentProfileDetail
): BankrCandidate {
  const description =
    normalizeOptionalText(
      profile.description
    );

  const website =
    normalizeOptionalText(
      profile.website
    );

  const twitterUsername =
    normalizeOptionalText(
      profile.twitterUsername
    );

  const chainId =
    profile
      .tokenChainId
      .trim()
      .toLowerCase();

  const address =
    profile
      .tokenAddress
      .trim()
      .toLowerCase();

  const githubRepositories =
    extractBankrGitHubRepositories(
      profile
    );

  const warnings:
    BankrCandidateWarning[] =
    [];

  if (!description) {
    warnings.push(
      "missing-description"
    );
  }

  if (!website) {
    warnings.push(
      "missing-website"
    );
  }

  if (!twitterUsername) {
    warnings.push(
      "missing-twitter"
    );
  }

  if (
    githubRepositories.length ===
    0
  ) {
    warnings.push(
      "no-github-repository"
    );
  }

  if (!profile.approved) {
    warnings.push(
      "unapproved-profile"
    );
  }

  return {
    source:
      "bankr",

    bankrProfileId:
      profile.id,

    bankrSlug:
      profile.slug,

    name:
      profile.projectName,

    description,

    token: {
      chainId,
      address,

      identity:
        createTokenIdentity(
          chainId,
          address
        ),

      symbol:
        profile.tokenSymbol,

      name:
        profile.tokenName
    },

    twitterUsername,
    website,

    marketCapUsd:
      profile.marketCapUsd,

    weeklyRevenueWeth:
      profile.weeklyRevenueWeth ??
      null,

    createdAt:
      profile.createdAt,

    githubRepositories,

    warnings
  };
}

function createConflictGroups(
  candidates:
    BankrCandidate[],
  getKey:
    (
      candidate:
        BankrCandidate
    ) => string
): BankrCandidateConflictGroup[] {
  const groups =
    new Map<
      string,
      BankrCandidate[]
    >();

  for (
    const candidate
    of candidates
  ) {
    const key =
      getKey(
        candidate
      );

    const group =
      groups.get(key) ??
      [];

    group.push(
      candidate
    );

    groups.set(
      key,
      group
    );
  }

  return [
    ...groups.entries()
  ]
    .filter(
      (
        [
          ,
          group
        ]
      ) =>
        group.length > 1
    )
    .map(
      (
        [
          key,
          group
        ]
      ) => ({
        key,

        profileIds:
          group.map(
            (candidate) =>
              candidate
                .bankrProfileId
          ),

        slugs:
          group.map(
            (candidate) =>
              candidate
                .bankrSlug
          )
      })
    )
    .sort(
      (
        left,
        right
      ) =>
        left.key.localeCompare(
          right.key,
          "en",
          {
            sensitivity:
              "base"
          }
        )
    );
}

export function buildBankrCandidateReport(
  profiles:
    BankrAgentProfileDetail[],
  generatedAt =
    new Date().toISOString()
): BankrCandidateReport {
  const initialCandidates =
    profiles.map(
      createBankrCandidate
    );

  const profileIdConflicts =
    createConflictGroups(
      initialCandidates,
      (candidate) =>
        candidate.bankrProfileId
    );

  const slugConflicts =
    createConflictGroups(
      initialCandidates,
      (candidate) =>
        candidate
          .bankrSlug
          .toLowerCase()
    );

  const tokenIdentityConflicts =
    createConflictGroups(
      initialCandidates,
      (candidate) =>
        candidate
          .token
          .identity
    );

  const sharedTokenIdentities =
    new Set(
      tokenIdentityConflicts.map(
        (conflict) =>
          conflict.key
      )
    );

  const candidates:
    BankrCandidate[] =
    initialCandidates.map(
      (candidate):
        BankrCandidate => {
        if (
          !sharedTokenIdentities.has(
            candidate
              .token
              .identity
          )
        ) {
          return candidate;
        }

        return {
          ...candidate,

          warnings: [
            ...candidate.warnings,
            "shared-token-identity"
          ]
        };
      }
    );

  return {
    generatedAt,
    profilesReceived:
      profiles.length,

    candidates,

    conflicts: {
      profileIds:
        profileIdConflicts,

      slugs:
        slugConflicts,

      tokenIdentities:
        tokenIdentityConflicts
    }
  };
}

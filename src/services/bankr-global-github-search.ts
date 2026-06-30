import {
  Octokit
} from "octokit";

import type {
  BankrCandidate
} from "./bankr-candidate.js";

export type BankrGlobalGitHubSearchSource =
  | "project-name"
  | "compact-slug"
  | "official-domain";

export type BankrGlobalGitHubRepositoryRole =
  | "primary-candidate"
  | "component"
  | "documentation"
  | "website"
  | "unknown";

export type BankrGlobalGitHubMatchStatus =
  | "probable"
  | "review"
  | "weak"
  | "unrelated";

export type BankrGlobalGitHubSearchRepository = {
  owner: string;
  repository: string;
  fullName: string;

  url: string;

  description:
    string |
    null;

  homepage:
    string |
    null;

  language:
    string |
    null;

  stars: number;
  forks: number;
  openIssues: number;

  pushedAt:
    string |
    null;

  fork: boolean;
  archived: boolean;
  disabled: boolean;
};

export type BankrGlobalGitHubRepositoryMatch =
  BankrGlobalGitHubSearchRepository & {
    role:
      BankrGlobalGitHubRepositoryRole;

    score:
      number;

    status:
      BankrGlobalGitHubMatchStatus;

    probable:
      boolean;

    matchedBy:
      BankrGlobalGitHubSearchSource[];

    reasons:
      string[];
  };

export type BankrGlobalGitHubQuery = {
  source:
    BankrGlobalGitHubSearchSource;

  query:
    string;
};

export type BankrGlobalGitHubCandidateDiscovery = {
  bankrProfileId: string;
  bankrSlug: string;

  queries:
    BankrGlobalGitHubQuery[];

  repositoriesFound:
    number;

  candidates:
    BankrGlobalGitHubRepositoryMatch[];
};

export type SearchGitHubRepositories = (
  query: string
) => Promise<
  BankrGlobalGitHubSearchRepository[]
>;

type CollectedRepository = {
  repository:
    BankrGlobalGitHubSearchRepository;

  matchedBy:
    Set<
      BankrGlobalGitHubSearchSource
    >;
};

const SEARCH_RESULTS_PER_QUERY =
  10;

const MAX_FINAL_MATCHES =
  12;

const DAY_IN_MS =
  24 * 60 * 60 * 1000;

function normalizeIdentity(
  value:
    string |
    null |
    undefined
): string {
  return (
    value ??
    ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]/gu,
      ""
    );
}

function normalizeText(
  value:
    string |
    null |
    undefined
): string {
  return (
    value ??
    ""
  )
    .trim()
    .toLowerCase();
}

function quoteSearchValue(
  value: string
): string {
  const normalized =
    value
      .replace(
        /["\\]/gu,
        " "
      )
      .replace(
        /\s+/gu,
        " "
      )
      .trim();

  return `"${normalized}"`;
}

function getWebsiteDomain(
  website:
    string |
    null
): string | null {
  if (!website) {
    return null;
  }

  try {
    const parsed =
      new URL(
        website
      );

    const hostname =
      parsed.hostname
        .toLowerCase()
        .replace(
          /^www\./u,
          ""
        );

    if (
      hostname === "github.com" ||
      hostname.endsWith(
        ".github.com"
      )
    ) {
      return null;
    }

    return hostname;
  } catch {
    return null;
  }
}

function getHomepageDomain(
  homepage:
    string |
    null
): string | null {
  if (!homepage) {
    return null;
  }

  try {
    return new URL(
      homepage
    )
      .hostname
      .toLowerCase()
      .replace(
        /^www\./u,
        ""
      );
  } catch {
    return null;
  }
}

function getDaysSincePush(
  pushedAt:
    string |
    null
): number | null {
  if (!pushedAt) {
    return null;
  }

  const timestamp =
    new Date(
      pushedAt
    ).getTime();

  if (
    Number.isNaN(
      timestamp
    )
  ) {
    return null;
  }

  return Math.max(
    0,

    Math.floor(
      (
        Date.now() -
        timestamp
      ) /
      DAY_IN_MS
    )
  );
}

function classifyRepositoryRole(
  candidate:
    Pick<
      BankrCandidate,
      "name" |
      "bankrSlug"
    >,

  repository:
    BankrGlobalGitHubSearchRepository
): BankrGlobalGitHubRepositoryRole {
  const repositoryIdentity =
    normalizeIdentity(
      repository.repository
    );

  const candidateIdentities =
    [
      normalizeIdentity(
        candidate.name
      ),

      normalizeIdentity(
        candidate.bankrSlug
      )
    ]
      .filter(
        (
          value,
          index,
          values
        ) =>
          value.length >= 3 &&
          values.indexOf(
            value
          ) === index
      );

  const text =
    [
      repository.repository,
      repository.description ??
        ""
    ]
      .join(
        " "
      )
      .toLowerCase();

  if (
    text.includes(
      "documentation"
    ) ||
    text.includes(
      " docs"
    ) ||
    repositoryIdentity.endsWith(
      "docs"
    )
  ) {
    return "documentation";
  }

  if (
    text.includes(
      "website"
    ) ||
    text.includes(
      "landing page"
    ) ||
    repositoryIdentity.endsWith(
      "site"
    ) ||
    repositoryIdentity.endsWith(
      "website"
    )
  ) {
    return "website";
  }

  if (
    text.includes(
      " sdk"
    ) ||
    text.includes(
      "sdk "
    ) ||
    text.includes(
      "library"
    ) ||
    text.includes(
      "client"
    ) ||
    text.includes(
      "contracts"
    ) ||
    text.includes(
      "contract"
    ) ||
    text.includes(
      "plugin"
    ) ||
    text.includes(
      "skill"
    ) ||
    text.includes(
      " mcp"
    ) ||
    text.includes(
      "mcp "
    ) ||
    text.includes(
      " cli"
    ) ||
    text.includes(
      "cli "
    ) ||
    text.includes(
      " api"
    ) ||
    text.includes(
      "api "
    )
  ) {
    return "component";
  }

  if (
    candidateIdentities.includes(
      repositoryIdentity
    ) ||
    text.includes(
      "agent framework"
    ) ||
    text.includes(
      "autonomous agent"
    ) ||
    text.includes(
      "ai agent"
    ) ||
    text.includes(
      "operating system"
    ) ||
    text.includes(
      "protocol"
    ) ||
    text.includes(
      "platform"
    )
  ) {
    return "primary-candidate";
  }

  return "unknown";
}

function getMatchStatus(
  score: number
): BankrGlobalGitHubMatchStatus {
  if (
    score >= 80
  ) {
    return "probable";
  }

  if (
    score >= 55
  ) {
    return "review";
  }

  if (
    score >= 30
  ) {
    return "weak";
  }

  return "unrelated";
}

function scoreRepository(
  candidate:
    Pick<
      BankrCandidate,
      "name" |
      "bankrSlug" |
      "website"
    >,

  repository:
    BankrGlobalGitHubSearchRepository,

  matchedBy:
    BankrGlobalGitHubSearchSource[]
): BankrGlobalGitHubRepositoryMatch {
  const reasons:
    string[] =
    [];

  let score =
    0;

  function addEvidence(
    points: number,
    reason: string
  ): void {
    score +=
      points;

    reasons.push(
      `${points >= 0 ? "+" : ""}${points}: ${reason}`
    );
  }

  const repositoryIdentity =
    normalizeIdentity(
      repository.repository
    );

  const ownerIdentity =
    normalizeIdentity(
      repository.owner
    );

  const candidateIdentities =
    [
      normalizeIdentity(
        candidate.name
      ),

      normalizeIdentity(
        candidate.bankrSlug
      )
    ]
      .filter(
        (
          value,
          index,
          values
        ) =>
          value.length >= 3 &&
          values.indexOf(
            value
          ) === index
      );

  const descriptionIdentity =
    normalizeIdentity(
      repository.description
    );

  const exactRepositoryIdentity =
    candidateIdentities.some(
      (identity) =>
        repositoryIdentity ===
          identity
    );

  if (
    exactRepositoryIdentity
  ) {
    addEvidence(
      45,
      "Repository name exactly matches the Bankr project identity."
    );
  } else if (
    candidateIdentities.some(
      (identity) =>
        identity.length >= 4 &&
        repositoryIdentity.includes(
          identity
        )
    )
  ) {
    addEvidence(
      25,
      "Repository name contains the Bankr project identity."
    );
  }

  if (
    candidateIdentities.some(
      (identity) =>
        identity.length >= 4 &&
        descriptionIdentity.includes(
          identity
        )
    )
  ) {
    addEvidence(
      15,
      "Repository description contains the Bankr project identity."
    );
  }

  if (
    candidateIdentities.some(
      (identity) =>
        ownerIdentity ===
          identity
    )
  ) {
    addEvidence(
      20,
      "GitHub owner exactly matches the Bankr project identity."
    );
  } else if (
    candidateIdentities.some(
      (identity) =>
        identity.length >= 4 &&
        (
          ownerIdentity.includes(
            identity
          ) ||
          identity.includes(
            ownerIdentity
          )
        )
    )
  ) {
    addEvidence(
      10,
      "GitHub owner closely matches the Bankr project identity."
    );
  }

  const websiteDomain =
    getWebsiteDomain(
      candidate.website
    );

  const homepageDomain =
    getHomepageDomain(
      repository.homepage
    );

  if (
    websiteDomain &&
    homepageDomain &&
    (
      websiteDomain ===
        homepageDomain ||
      websiteDomain.endsWith(
        `.${homepageDomain}`
      ) ||
      homepageDomain.endsWith(
        `.${websiteDomain}`
      )
    )
  ) {
    addEvidence(
      30,
      "Repository homepage matches the official Bankr website."
    );
  }

  if (
    matchedBy.includes(
      "official-domain"
    )
  ) {
    addEvidence(
      15,
      "Official project domain was found by GitHub repository search."
    );
  }

  if (
    matchedBy.includes(
      "project-name"
    )
  ) {
    addEvidence(
      10,
      "Repository matched the project-name GitHub search."
    );
  }

  const role =
    classifyRepositoryRole(
      candidate,
      repository
    );

  if (
    role ===
      "primary-candidate"
  ) {
    addEvidence(
      10,
      "Repository metadata suggests a primary project repository."
    );
  }

  const daysSincePush =
    getDaysSincePush(
      repository.pushedAt
    );

  if (
    daysSincePush !== null &&
    daysSincePush <= 90
  ) {
    addEvidence(
      5,
      "Repository has recent public activity."
    );
  } else if (
    daysSincePush !== null &&
    daysSincePush > 365
  ) {
    addEvidence(
      -10,
      "Repository has not been updated within the last year."
    );
  }

  if (
    repository.stars >= 5
  ) {
    addEvidence(
      5,
      "Repository has observable public adoption."
    );
  }

  const repositoryName =
    normalizeText(
      repository.repository
    );

  if (
    /(?:^|[-_.])(examples?|demo|template|starter)(?:$|[-_.])/u.test(
      repositoryName
    )
  ) {
    addEvidence(
      -25,
      "Repository name indicates examples, a demo, or a template."
    );
  }

  if (
    role ===
      "component"
  ) {
    addEvidence(
      -15,
      "Repository appears to be a component rather than the primary project."
    );
  }

  if (
    role ===
      "documentation" ||
    role ===
      "website"
  ) {
    addEvidence(
      -35,
      "Repository appears to contain documentation or a website."
    );
  }

  if (
    repository.fork
  ) {
    addEvidence(
      -40,
      "Forked repositories are not treated as primary project evidence."
    );
  }

  if (
    repository.archived ||
    repository.disabled
  ) {
    addEvidence(
      -60,
      "Archived or disabled repositories are not active project anchors."
    );
  }

  const normalizedScore =
    Math.max(
      0,
      Math.min(
        100,
        score
      )
    );

  const status =
    getMatchStatus(
      normalizedScore
    );

  return {
    ...repository,

    role,

    score:
      normalizedScore,

    status,

    probable:
      status ===
        "probable",

    matchedBy:
      [...matchedBy].sort(),

    reasons:
      reasons.length > 0
        ? reasons
        : [
            "No meaningful project identity signals were found."
          ]
  };
}

function sortMatches(
  matches:
    BankrGlobalGitHubRepositoryMatch[]
): BankrGlobalGitHubRepositoryMatch[] {
  return [
    ...matches
  ].sort(
    (
      left,
      right
    ) =>
      right.score -
        left.score ||
      right.stars -
        left.stars ||
      left.fullName.localeCompare(
        right.fullName,
        "en",
        {
          sensitivity:
            "base"
        }
      )
  );
}

export function buildBankrGlobalGitHubQueries(
  candidate:
    Pick<
      BankrCandidate,
      "name" |
      "bankrSlug" |
      "website"
    >
): BankrGlobalGitHubQuery[] {
  const queries:
    BankrGlobalGitHubQuery[] =
    [];

  const projectName =
    candidate.name
      .trim();

  if (
    projectName.length >= 2
  ) {
    queries.push(
      {
        source:
          "project-name",

        query:
          `${quoteSearchValue(projectName)} in:name,description,readme fork:false archived:false`
      }
    );
  }

  const compactSlug =
    normalizeIdentity(
      candidate.bankrSlug
    );

  if (
    compactSlug.length >= 3
  ) {
    queries.push(
      {
        source:
          "compact-slug",

        query:
          `${compactSlug} in:name,description,readme fork:false archived:false`
      }
    );
  }

  const websiteDomain =
    getWebsiteDomain(
      candidate.website
    );

  if (
    websiteDomain
  ) {
    queries.push(
      {
        source:
          "official-domain",

        query:
          `${websiteDomain} in:description,readme fork:false archived:false`
      }
    );
  }

  return queries;
}

export function rankBankrGlobalGitHubRepositories(
  candidate:
    Pick<
      BankrCandidate,
      "name" |
      "bankrSlug" |
      "website"
    >,

  collected:
    Array<{
      repository:
        BankrGlobalGitHubSearchRepository;

      matchedBy:
        BankrGlobalGitHubSearchSource[];
    }>
): BankrGlobalGitHubRepositoryMatch[] {
  return sortMatches(
    collected.map(
      (
        {
          repository,
          matchedBy
        }
      ) =>
        scoreRepository(
          candidate,
          repository,
          matchedBy
        )
    )
  )
    .slice(
      0,
      MAX_FINAL_MATCHES
    );
}

export async function searchGitHubRepositories(
  query: string
): Promise<
  BankrGlobalGitHubSearchRepository[]
> {
  const token =
    process.env
      .GITHUB_TOKEN
      ?.trim();

  const octokit =
    new Octokit(
      token
        ? {
            auth:
              token
          }
        : {}
    );

  const response =
    await octokit
      .rest
      .search
      .repos(
        {
          q:
            query,

          sort:
            "updated",

          order:
            "desc",

          per_page:
            SEARCH_RESULTS_PER_QUERY
        }
      );

  return response
    .data
    .items
    .map(
      (repository) => ({
        owner:
          repository.owner
            ?.login ??
          repository.full_name
            .split(
              "/"
            )[0] ??
          "",

        repository:
          repository.name,

        fullName:
          repository.full_name,

        url:
          repository.html_url,

        description:
          repository.description,

        homepage:
          repository.homepage ??
          null,

        language:
          repository.language ??
          null,

        stars:
          repository
            .stargazers_count ??
          0,

        forks:
          repository
            .forks_count ??
          0,

        openIssues:
          repository
            .open_issues_count ??
          0,

        pushedAt:
          repository.pushed_at ??
          null,

        fork:
          repository.fork,

        archived:
          Boolean(
            repository.archived
          ),

        disabled:
          Boolean(
            repository.disabled
          )
      })
    )
    .filter(
      (repository) =>
        repository.owner &&
        repository.repository
    );
}

export async function discoverBankrCandidateGlobalGitHub(
  candidate:
    Pick<
      BankrCandidate,
      "bankrProfileId" |
      "bankrSlug" |
      "name" |
      "website"
    >,

  searchRepositories:
    SearchGitHubRepositories =
      searchGitHubRepositories
): Promise<
  BankrGlobalGitHubCandidateDiscovery
> {
  const queries =
    buildBankrGlobalGitHubQueries(
      candidate
    );

  const collected =
    new Map<
      string,
      CollectedRepository
    >();

  for (
    const query
    of queries
  ) {
    const repositories =
      await searchRepositories(
        query.query
      );

    for (
      const repository
      of repositories
    ) {
      const key =
        repository
          .fullName
          .trim()
          .toLowerCase();

      const existing =
        collected.get(
          key
        );

      if (
        existing
      ) {
        existing
          .matchedBy
          .add(
            query.source
          );

        continue;
      }

      collected.set(
        key,
        {
          repository,

          matchedBy:
            new Set(
              [
                query.source
              ]
            )
        }
      );
    }
  }

  const candidates =
    rankBankrGlobalGitHubRepositories(
      candidate,

      [
        ...collected
          .values()
      ].map(
        (entry) => ({
          repository:
            entry.repository,

          matchedBy:
            [
              ...entry.matchedBy
            ]
        })
      )
    );

  return {
    bankrProfileId:
      candidate.bankrProfileId,

    bankrSlug:
      candidate.bankrSlug,

    queries,

    repositoriesFound:
      collected.size,

    candidates
  };
}

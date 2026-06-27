import {
  getAgentAliases
} from "../data/agent-aliases.js";

import {
  listRegisteredAgents
} from "../data/agent-registry.js";

import {
  ClarityError
} from "../errors/clarity-error.js";

export type AgentSearchMatchType =
  | "exact-slug"
  | "exact-name"
  | "exact-alias"
  | "prefix"
  | "contains";

export type AgentSearchResult = {
  agent: {
    slug: string;
    name: string;
  };

  github: {
    owner: string;
    repository: string;
    scope: string;
  };

  aliases: readonly string[];

  match: {
    type: AgentSearchMatchType;
    matchedOn: string;
    relevance: number;
  };

  evaluationUrl: string;
};

export type AgentSearchResponse = {
  schemaVersion: "1.0";
  query: string;
  normalizedQuery: string;
  count: number;
  results: AgentSearchResult[];
  generatedAt: string;
};

type SearchCandidate = {
  value: string;
  source:
    | "slug"
    | "name"
    | "alias";
};

type ScoredCandidate = {
  candidate: SearchCandidate;
  type: AgentSearchMatchType;
  relevance: number;
};

export function normalizeAgentSearchValue(
  value: string
): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(
      /[^\p{L}\p{N}]+/gu,
      " "
    )
    .trim()
    .replace(/\s+/g, " ");
}

function compactSearchValue(
  value: string
): string {
  return normalizeAgentSearchValue(
    value
  ).replace(/\s+/g, "");
}

function scoreCandidate(
  query: string,
  candidate: SearchCandidate
): ScoredCandidate | null {
  const normalizedCandidate =
    normalizeAgentSearchValue(
      candidate.value
    );

  const compactQuery =
    compactSearchValue(query);

  const compactCandidate =
    compactSearchValue(
      candidate.value
    );

  const exact =
    normalizedCandidate === query ||
    compactCandidate === compactQuery;

  if (exact) {
    if (candidate.source === "slug") {
      return {
        candidate,
        type: "exact-slug",
        relevance: 100
      };
    }

    if (candidate.source === "name") {
      return {
        candidate,
        type: "exact-name",
        relevance: 98
      };
    }

    return {
      candidate,
      type: "exact-alias",
      relevance: 95
    };
  }

  const prefix =
    normalizedCandidate.startsWith(
      query
    ) ||
    compactCandidate.startsWith(
      compactQuery
    );

  if (prefix) {
    return {
      candidate,
      type: "prefix",
      relevance: 80
    };
  }

  const contains =
    normalizedCandidate.includes(
      query
    ) ||
    compactCandidate.includes(
      compactQuery
    );

  if (contains) {
    return {
      candidate,
      type: "contains",
      relevance: 65
    };
  }

  return null;
}

export function searchRegisteredAgents(
  query: string
): AgentSearchResponse {
  const trimmedQuery =
    query.trim();

  const normalizedQuery =
    normalizeAgentSearchValue(
      trimmedQuery
    );

  const compactQuery =
    compactSearchValue(
      trimmedQuery
    );

  if (compactQuery.length < 2) {
    throw new ClarityError(
      "INVALID_SEARCH_QUERY",
      "Search query must contain at least 2 characters.",
      400
    );
  }

  const results =
    listRegisteredAgents()
      .map(
        (
          agent
        ): AgentSearchResult | null => {
          const aliases =
            getAgentAliases(
              agent.slug
            );

          const candidates:
          SearchCandidate[] = [
            {
              value:
                agent.slug,

              source:
                "slug"
            },

            {
              value:
                agent.name,

              source:
                "name"
            },

            ...aliases.map(
              (alias) => ({
                value:
                  alias,

                source:
                  "alias" as const
              })
            )
          ];

          const bestMatch =
            candidates
              .map(
                (candidate) =>
                  scoreCandidate(
                    normalizedQuery,
                    candidate
                  )
              )
              .filter(
                (
                  match
                ): match is ScoredCandidate =>
                  match !== null
              )
              .sort(
                (left, right) =>
                  right.relevance -
                  left.relevance
              )[0];

          if (!bestMatch) {
            return null;
          }

          return {
            agent: {
              slug:
                agent.slug,

              name:
                agent.name
            },

            github: {
              owner:
                agent.github.owner,

              repository:
                agent.github.repository,

              scope:
                agent.github.scope
            },

            aliases,

            match: {
              type:
                bestMatch.type,

              matchedOn:
                bestMatch
                  .candidate.value,

              relevance:
                bestMatch.relevance
            },

            evaluationUrl:
              `/api/v1/evaluate/${agent.slug}`
          };
        }
      )
      .filter(
        (
          result
        ): result is AgentSearchResult =>
          result !== null
      )
      .sort(
        (left, right) => {
          const relevanceDifference =
            right.match.relevance -
            left.match.relevance;

          if (
            relevanceDifference !== 0
          ) {
            return relevanceDifference;
          }

          return left.agent.name.localeCompare(
            right.agent.name
          );
        }
      );

  return {
    schemaVersion: "1.0",
    query: trimmedQuery,
    normalizedQuery,
    count: results.length,
    results,
    generatedAt:
      new Date().toISOString()
  };
}

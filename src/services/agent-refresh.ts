import {
  listRegisteredAgents,
  type RegisteredAgent
} from "../data/agent-registry.js";

import {
  isClarityError,
  type ClarityErrorCode
} from "../errors/clarity-error.js";

import {
  buildAgentEvaluation,
  type AgentEvaluation
} from "./agent-evaluation.js";

import {
  saveAgentEvaluationSnapshot,
  type AgentEvaluationSnapshot
} from "./evaluation-snapshot.js";

export type AgentRefreshSuccess = {
  agent: {
    slug: string;
    name: string;
  };

  status: "refreshed";
  durationMs: number;
  snapshotSavedAt: string;
};

export type AgentRefreshFailure = {
  agent: {
    slug: string;
    name: string;
  };

  status: "failed";
  durationMs: number;

  error: {
    code: ClarityErrorCode;
    message: string;
    retryable: boolean;
  };
};

export type AgentRefreshResult =
  | AgentRefreshSuccess
  | AgentRefreshFailure;

export type AgentRefreshReport = {
  schemaVersion: "1.0";
  startedAt: string;
  completedAt: string;
  durationMs: number;

  totals: {
    registered: number;
    refreshed: number;
    failed: number;
  };

  results: AgentRefreshResult[];
};

export type AgentRefreshDependencies = {
  listAgents: () => RegisteredAgent[];

  buildLiveEvaluation: (
    agentSlug: string
  ) => Promise<AgentEvaluation>;

  saveSnapshot: (
    evaluation: AgentEvaluation
  ) => Promise<AgentEvaluationSnapshot>;

  now: () => number;
};

const defaultDependencies:
AgentRefreshDependencies = {
  listAgents:
    listRegisteredAgents,

  buildLiveEvaluation:
    buildAgentEvaluation,

  saveSnapshot:
    saveAgentEvaluationSnapshot,

  now:
    () => Date.now()
};

function resolveDependencies(
  overrides:
    Partial<AgentRefreshDependencies>
): AgentRefreshDependencies {
  return {
    ...defaultDependencies,
    ...overrides
  };
}

function getDuration(
  startedAt: number,
  completedAt: number
): number {
  return Math.max(
    0,
    completedAt - startedAt
  );
}

function getRefreshError(
  error: unknown
): AgentRefreshFailure["error"] {
  if (isClarityError(error)) {
    return {
      code:
        error.code,

      message:
        error.message,

      retryable:
        error.retryable
    };
  }

  return {
    code:
      "INTERNAL_SERVER_ERROR",

    message:
      error instanceof Error
        ? error.message
        : "Unknown refresh error.",

    retryable:
      false
  };
}

export async function refreshAllAgentSnapshots(
  dependencyOverrides:
    Partial<AgentRefreshDependencies> = {}
): Promise<AgentRefreshReport> {
  const dependencies =
    resolveDependencies(
      dependencyOverrides
    );

  const agents =
    dependencies.listAgents();

  const startedAtMs =
    dependencies.now();

  const results:
  AgentRefreshResult[] = [];

  for (const agent of agents) {
    const agentStartedAtMs =
      dependencies.now();

    try {
      const evaluation =
        await dependencies
          .buildLiveEvaluation(
            agent.slug
          );

      const snapshot =
        await dependencies
          .saveSnapshot(
            evaluation
          );

      const agentCompletedAtMs =
        dependencies.now();

      results.push({
        agent: {
          slug:
            agent.slug,

          name:
            agent.name
        },

        status:
          "refreshed",

        durationMs:
          getDuration(
            agentStartedAtMs,
            agentCompletedAtMs
          ),

        snapshotSavedAt:
          snapshot.savedAt
      });
    } catch (error) {
      const agentCompletedAtMs =
        dependencies.now();

      results.push({
        agent: {
          slug:
            agent.slug,

          name:
            agent.name
        },

        status:
          "failed",

        durationMs:
          getDuration(
            agentStartedAtMs,
            agentCompletedAtMs
          ),

        error:
          getRefreshError(error)
      });
    }
  }

  const completedAtMs =
    dependencies.now();

  const refreshed =
    results.filter(
      (result) =>
        result.status ===
        "refreshed"
    ).length;

  const failed =
    results.length -
    refreshed;

  return {
    schemaVersion: "1.0",

    startedAt:
      new Date(
        startedAtMs
      ).toISOString(),

    completedAt:
      new Date(
        completedAtMs
      ).toISOString(),

    durationMs:
      getDuration(
        startedAtMs,
        completedAtMs
      ),

    totals: {
      registered:
        agents.length,

      refreshed,
      failed
    },

    results
  };
}

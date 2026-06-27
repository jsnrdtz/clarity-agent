export const openApiDocument = {
  openapi: "3.1.0",

  info: {
    title: "Clarity Agent API",
    version: "1.0.0",

    description:
      "Evidence-aware intelligence API for evaluating and comparing AI agent projects using observable public development data."
  },

  tags: [
    {
      name: "System"
    },
    {
      name: "Agents"
    },
    {
      name: "Evaluation"
    },
    {
      name: "Ranking"
    },
    {
      name: "Comparison"
    }
  ],

  paths: {
    "/health": {
      get: {
        tags: [
          "System"
        ],

        summary:
          "Check API health",

        operationId:
          "getHealth",

        responses: {
          "200": {
            description:
              "API is operational.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/HealthResponse"
                }
              }
            }
          }
        }
      }
    },

    "/openapi.json": {
      get: {
        tags: [
          "System"
        ],

        summary:
          "Get the OpenAPI document",

        operationId:
          "getOpenApiDocument",

        responses: {
          "200": {
            description:
              "OpenAPI 3.1 document."
          }
        }
      }
    },

    "/api/v1/agents": {
      get: {
        tags: [
          "Agents"
        ],

        summary:
          "List registered agents",

        operationId:
          "listAgents",

        responses: {
          "200": {
            description:
              "Registered agent list.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/AgentListResponse"
                }
              }
            }
          }
        }
      }
    },

    "/api/v1/search": {
      get: {
        tags: [
          "Agents"
        ],

        summary:
          "Search registered agents",

        operationId:
          "searchAgents",

        parameters: [
          {
            name: "q",
            in: "query",
            required: true,

            description:
              "Agent name, slug, or alias.",

            schema: {
              type: "string",
              minLength: 2
            }
          }
        ],

        responses: {
          "200": {
            description:
              "Matching registered agents.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/AgentSearchResponse"
                }
              }
            }
          },

          "400": {
            description:
              "Invalid search query.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },

    "/api/v1/evaluate/{agent}": {
      get: {
        tags: [
          "Evaluation"
        ],

        summary:
          "Evaluate an agent",

        operationId:
          "evaluateAgent",

        parameters: [
          {
            name: "agent",
            in: "path",
            required: true,

            description:
              "Registered agent slug.",

            schema: {
              type: "string",

              examples: [
                "aeon",
                "prxvt"
              ]
            }
          }
        ],

        responses: {
          "200": {
            description:
              "Structured agent evaluation.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/AgentEvaluation"
                }
              }
            }
          },

          "404": {
            description:
              "Agent is not registered.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/ErrorResponse"
                }
              }
            }
          },

          "429": {
            description:
              "GitHub API rate limit exceeded.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/ErrorResponse"
                }
              }
            }
          },

          "503": {
            description:
              "GitHub data is temporarily unavailable.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },

    "/api/v1/ranking": {
      get: {
        tags: [
          "Ranking"
        ],

        summary:
          "Get the evidence-aware agent ranking",

        operationId:
          "getAgentRanking",

        responses: {
          "200": {
            description:
              "Eligible agents are ranked while low-confidence agents are returned separately.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/RankingResponse"
                }
              }
            }
          },

          "503": {
            description:
              "Agent data could not be resolved.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },

    "/api/v1/compare/{left}/{right}": {
      get: {
        tags: [
          "Comparison"
        ],

        summary:
          "Compare two agents",

        operationId:
          "compareAgents",

        parameters: [
          {
            name: "left",
            in: "path",
            required: true,

            schema: {
              type: "string"
            }
          },
          {
            name: "right",
            in: "path",
            required: true,

            schema: {
              type: "string"
            }
          }
        ],

        responses: {
          "200": {
            description:
              "Evidence-aware comparison.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/ComparisonResponse"
                }
              }
            }
          },

          "400": {
            description:
              "Invalid comparison request.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/ErrorResponse"
                }
              }
            }
          },

          "404": {
            description:
              "One of the agents is not registered.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    }
  },

  components: {
    schemas: {
      HealthResponse: {
        type: "object",

        required: [
          "status",
          "service",
          "version",
          "timestamp"
        ],

        properties: {
          status: {
            type: "string",
            const: "ok"
          },

          service: {
            type: "string",
            const:
              "clarity-agent-api"
          },

          version: {
            type: "string"
          },

          timestamp: {
            type: "string",
            format: "date-time"
          }
        }
      },

      AgentReference: {
        type: "object",

        required: [
          "slug",
          "name"
        ],

        properties: {
          slug: {
            type: "string"
          },

          name: {
            type: "string"
          }
        }
      },

      AgentListItem: {
        type: "object",

        required: [
          "slug",
          "name",
          "github",
          "evaluationUrl"
        ],

        properties: {
          slug: {
            type: "string"
          },

          name: {
            type: "string"
          },

          github: {
            type: "object",

            required: [
              "owner",
              "repository",
              "scope"
            ],

            properties: {
              owner: {
                type: "string"
              },

              repository: {
                type: "string"
              },

              scope: {
                type: "string",

                enum: [
                  "primary",
                  "component"
                ]
              }
            }
          },

          evaluationUrl: {
            type: "string"
          }
        }
      },

      AgentListResponse: {
        type: "object",

        required: [
          "schemaVersion",
          "count",
          "agents"
        ],

        properties: {
          schemaVersion: {
            type: "string",
            const: "1.0"
          },

          count: {
            type: "integer",
            minimum: 0
          },

          agents: {
            type: "array",

            items: {
              $ref:
                "#/components/schemas/AgentListItem"
            }
          }
        }
      },

      GitHubScore: {
        type: "object",

        required: [
          "overall",
          "activity",
          "collaboration",
          "adoption",
          "releases",
          "dataCoverage"
        ],

        properties: {
          overall: {
            type: "integer",
            minimum: 0,
            maximum: 100
          },

          activity: {
            type: "integer",
            minimum: 0,
            maximum: 100
          },

          collaboration: {
            type: "integer",
            minimum: 0,
            maximum: 100
          },

          adoption: {
            type: "integer",
            minimum: 0,
            maximum: 100
          },

          releases: {
            type: "integer",
            minimum: 0,
            maximum: 100
          },

          dataCoverage: {
            type: "integer",
            minimum: 0,
            maximum: 100
          }
        }
      },

      PublicEvidence: {
        type: "object",

        required: [
          "coverage",
          "confidence",
          "detectedVisibility",
          "interpretation",
          "signals",
          "limitations"
        ],

        properties: {
          coverage: {
            type: "integer",
            minimum: 0,
            maximum: 100
          },

          confidence: {
            type: "string",

            enum: [
              "high",
              "medium",
              "low"
            ]
          },

          detectedVisibility: {
            type: "string",

            enum: [
              "public-heavy",
              "partial",
              "unknown"
            ]
          },

          interpretation: {
            type: "string"
          },

          signals: {
            type: "array",

            items: {
              type: "string"
            }
          },

          limitations: {
            type: "array",

            items: {
              type: "string"
            }
          }
        }
      },

      DeliveryMetadata: {
        type: "object",

        required: [
          "source",
          "stale",
          "snapshotSavedAt",
          "liveError"
        ],

        properties: {
          source: {
            type: "string",

            enum: [
              "live",
              "snapshot"
            ]
          },

          stale: {
            type: "boolean"
          },

          snapshotSavedAt: {
            anyOf: [
              {
                type: "string",
                format: "date-time"
              },
              {
                type: "null"
              }
            ]
          },

          liveError: {
            anyOf: [
              {
                type: "string"
              },
              {
                type: "null"
              }
            ]
          }
        }
      },

      AgentSearchResult: {
        type: "object",

        required: [
          "agent",
          "github",
          "aliases",
          "match",
          "evaluationUrl"
        ],

        properties: {
          agent: {
            $ref:
              "#/components/schemas/AgentReference"
          },

          github: {
            type: "object",
            additionalProperties: true
          },

          aliases: {
            type: "array",

            items: {
              type: "string"
            }
          },

          match: {
            type: "object",

            required: [
              "type",
              "matchedOn",
              "relevance"
            ],

            properties: {
              type: {
                type: "string",

                enum: [
                  "exact-slug",
                  "exact-name",
                  "exact-alias",
                  "prefix",
                  "contains"
                ]
              },

              matchedOn: {
                type: "string"
              },

              relevance: {
                type: "integer",
                minimum: 0,
                maximum: 100
              }
            }
          },

          evaluationUrl: {
            type: "string"
          }
        }
      },

      AgentSearchResponse: {
        type: "object",

        required: [
          "schemaVersion",
          "query",
          "normalizedQuery",
          "count",
          "results",
          "generatedAt"
        ],

        properties: {
          schemaVersion: {
            type: "string",
            const: "1.0"
          },

          query: {
            type: "string"
          },

          normalizedQuery: {
            type: "string"
          },

          count: {
            type: "integer",
            minimum: 0
          },

          results: {
            type: "array",

            items: {
              $ref:
                "#/components/schemas/AgentSearchResult"
            }
          },

          generatedAt: {
            type: "string",
            format: "date-time"
          }
        }
      },

      AgentEvaluation: {
        type: "object",

        required: [
          "schemaVersion",
          "agent",
          "github",
          "scores",
          "repositories",
          "summary",
          "eligibility",
          "context",
          "sourceCollectedAt",
          "collectedAt",
          "delivery"
        ],

        properties: {
          schemaVersion: {
            type: "string",
            const: "1.0"
          },

          agent: {
            $ref:
              "#/components/schemas/AgentReference"
          },

          github: {
            type: "object",
            additionalProperties: true
          },

          scores: {
            type: "object",

            required: [
              "github",
              "publicEvidence"
            ],

            properties: {
              github: {
                $ref:
                  "#/components/schemas/GitHubScore"
              },

              publicEvidence: {
                $ref:
                  "#/components/schemas/PublicEvidence"
              }
            }
          },

          repositories: {
            type: "object",
            additionalProperties: true
          },

          summary: {
            type: "object",
            additionalProperties: true
          },

          eligibility: {
            type: "object",
            additionalProperties: true
          },

          context: {
            type: "object",
            additionalProperties: true
          },

          sourceCollectedAt: {
            type: "string",
            format: "date-time"
          },

          collectedAt: {
            type: "string",
            format: "date-time"
          },

          delivery: {
            $ref:
              "#/components/schemas/DeliveryMetadata"
          }
        }
      },

      RankingEntry: {
        type: "object",

        required: [
          "agent",
          "githubScore",
          "evidenceCoverage",
          "confidence"
        ],

        properties: {
          rank: {
            type: "integer",
            minimum: 1
          },

          agent: {
            $ref:
              "#/components/schemas/AgentReference"
          },

          githubScore: {
            type: "integer",
            minimum: 0,
            maximum: 100
          },

          evidenceCoverage: {
            type: "integer",
            minimum: 0,
            maximum: 100
          },

          confidence: {
            type: "string",

            enum: [
              "high",
              "medium",
              "low"
            ]
          },

          reason: {
            type: "string"
          },

          evaluationUrl: {
            type: "string"
          }
        },

        additionalProperties: true
      },

      RankingResponse: {
        type: "object",

        required: [
          "schemaVersion",
          "methodology",
          "ranked",
          "unranked",
          "totals",
          "generatedAt"
        ],

        properties: {
          schemaVersion: {
            type: "string",
            const: "1.0"
          },

          methodology: {
            type: "object",
            additionalProperties: true
          },

          ranked: {
            type: "array",

            items: {
              $ref:
                "#/components/schemas/RankingEntry"
            }
          },

          unranked: {
            type: "array",

            items: {
              $ref:
                "#/components/schemas/RankingEntry"
            }
          },

          totals: {
            type: "object",

            required: [
              "registered",
              "ranked",
              "unranked"
            ],

            properties: {
              registered: {
                type: "integer"
              },

              ranked: {
                type: "integer"
              },

              unranked: {
                type: "integer"
              }
            }
          },

          generatedAt: {
            type: "string",
            format: "date-time"
          }
        }
      },

      ComparisonResponse: {
        type: "object",

        required: [
          "schemaVersion",
          "status",
          "outcome",
          "agents",
          "leader",
          "differences",
          "reason",
          "generatedAt"
        ],

        properties: {
          schemaVersion: {
            type: "string",
            const: "1.0"
          },

          status: {
            type: "string",

            enum: [
              "comparable",
              "limited"
            ]
          },

          outcome: {
            type: "string",

            enum: [
              "left",
              "right",
              "tie",
              "undetermined"
            ]
          },

          agents: {
            type: "object",
            additionalProperties: true
          },

          leader: {
            anyOf: [
              {
                $ref:
                  "#/components/schemas/AgentReference"
              },
              {
                type: "null"
              }
            ]
          },

          differences: {
            type: "object",

            required: [
              "githubScore",
              "evidenceCoverage"
            ],

            properties: {
              githubScore: {
                type: "number"
              },

              evidenceCoverage: {
                type: "number"
              }
            }
          },

          reason: {
            type: "string"
          },

          generatedAt: {
            type: "string",
            format: "date-time"
          }
        }
      },

      ErrorResponse: {
        type: "object",

        required: [
          "error"
        ],

        properties: {
          error: {
            type: "object",

            required: [
              "code",
              "message",
              "retryable"
            ],

            properties: {
              code: {
                type: "string",

                enum: [
                  "AGENT_NOT_FOUND",
                  "INVALID_COMPARISON",
                  "INVALID_SEARCH_QUERY",
                  "GITHUB_OWNER_NOT_FOUND",
                  "GITHUB_REPOSITORY_NOT_FOUND",
                  "GITHUB_RATE_LIMITED",
                  "GITHUB_AUTHENTICATION_FAILED",
                  "GITHUB_ACCESS_DENIED",
                  "GITHUB_UNAVAILABLE",
                  "INTERNAL_SERVER_ERROR"
                ]
              },

              message: {
                type: "string"
              },

              retryable: {
                type: "boolean"
              },

              details: {
                type: "object",
                additionalProperties: true
              }
            }
          }
        }
      }
    }
  }
} as const;

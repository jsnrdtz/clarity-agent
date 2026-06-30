const rateLimitResponseHeaders = {
  "X-RateLimit-Limit": {
    description:
      "Maximum requests allowed in the current window.",

    schema: {
      type: "integer",
      minimum: 1
    }
  },

  "X-RateLimit-Remaining": {
    description:
      "Requests remaining in the current window.",

    schema: {
      type: "integer",
      minimum: 0
    }
  },

  "X-RateLimit-Reset": {
    description:
      "Unix timestamp in seconds when the current window resets.",

    schema: {
      type: "integer",
      minimum: 0
    }
  }
} as const;

const rateLimitExceededResponseHeaders = {
  ...rateLimitResponseHeaders,

  "Retry-After": {
    description:
      "Seconds until another request may be attempted.",

    schema: {
      type: "integer",
      minimum: 1
    }
  }
} as const;

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
      name: "Candidate Review"
    },
    {
      name: "Evaluation"
    },
    {
      name: "Ranking"
    },
    {
      name: "Comparison"
    },
    {
      name: "Administration"
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

            headers:
              rateLimitResponseHeaders,

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
              "Clarity request limit or upstream GitHub API limit exceeded.",

            headers:
              rateLimitExceededResponseHeaders,

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

    "/api/v1/candidates/bankr": {
      get: {
        tags: [
          "Candidate Review"
        ],

        summary:
          "Get the latest published Bankr candidate report",

        operationId:
          "getBankrCandidateReport",

        responses: {
          "200": {
            description:
              "Latest validated Bankr candidate report.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/BankrCandidateReport"
                }
              }
            }
          },

          "404": {
            description:
              "No candidate report has been published.",

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

    "/api/v1/candidates/bankr/reviews": {
      get: {
        tags: [
          "Candidate Review"
        ],

        summary:
          "Get public candidate review statuses",

        operationId:
          "getPublicCandidateReviews",

        responses: {
          "200": {
            description:
              "Review statuses with private notes and registry proposals removed.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/CandidateReviewView"
                }
              }
            }
          },

          "404": {
            description:
              "No published candidate report is available.",

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

    "/api/v1/admin/candidates/bankr/reviews/batch": {
      post: {
        tags: [
          "Administration"
        ],

        summary:
          "Apply multiple candidate review decisions atomically",

        operationId:
          "updateCandidateReviewsBatch",

        security: [
          {
            candidateReviewBearer:
              []
          }
        ],

        requestBody: {
          required:
            true,

          content: {
            "application/json": {
              schema: {
                type:
                  "object",

                required: [
                  "reviews"
                ],

                additionalProperties:
                  false,

                properties: {
                  reviews: {
                    type:
                      "array",

                    minItems:
                      1,

                    maxItems:
                      100,

                    items: {
                      $ref:
                        "#/components/schemas/CandidateReviewRequest"
                    }
                  }
                }
              }
            }
          }
        },

        responses: {
          "200": {
            description:
              "All review decisions were validated and saved atomically.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/CandidateReviewView"
                }
              }
            }
          },

          "400": {
            description:
              "The batch request is invalid or contains duplicate targets.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/ErrorResponse"
                }
              }
            }
          },

          "401": {
            description:
              "Review Bearer authentication failed.",

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
              "At least one repository is not present in the current report.",

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

    "/api/v1/admin/candidates/bankr/reviews": {
      get: {
        tags: [
          "Administration"
        ],

        summary:
          "Get the complete administrative review queue",

        operationId:
          "getCandidateReviewQueue",

        security: [
          {
            candidateReviewBearer:
              []
          }
        ],

        responses: {
          "200": {
            description:
              "Complete review queue including private notes and registry proposals.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/CandidateReviewView"
                }
              }
            }
          },

          "401": {
            description:
              "Review Bearer authentication failed.",

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
      },

      post: {
        tags: [
          "Administration"
        ],

        summary:
          "Approve, reject, or reset a candidate repository",

        operationId:
          "updateCandidateReview",

        security: [
          {
            candidateReviewBearer:
              []
          }
        ],

        requestBody: {
          required:
            true,

          content: {
            "application/json": {
              schema: {
                $ref:
                  "#/components/schemas/CandidateReviewRequest"
              }
            }
          }
        },

        responses: {
          "200": {
            description:
              "Review decision was saved.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/CandidateReviewView"
                }
              }
            }
          },

          "400": {
            description:
              "Invalid review request.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/ErrorResponse"
                }
              }
            }
          },

          "401": {
            description:
              "Review Bearer authentication failed.",

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
              "Candidate repository is not in the current report.",

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

    "/api/v1/admin/candidates/bankr": {
      post: {
        tags: [
          "Administration"
        ],

        summary:
          "Publish a validated Bankr candidate report",

        operationId:
          "publishBankrCandidateReport",

        security: [
          {
            candidateUploadBearer: []
          }
        ],

        requestBody: {
          required: true,

          content: {
            "application/json": {
              schema: {
                $ref:
                  "#/components/schemas/BankrCandidateReport"
              }
            }
          }
        },

        responses: {
          "200": {
            description:
              "Candidate report was validated and stored.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/CandidateUploadResponse"
                }
              }
            }
          },

          "400": {
            description:
              "Candidate report failed validation.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/ErrorResponse"
                }
              }
            }
          },

          "401": {
            description:
              "Bearer authentication failed.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/ErrorResponse"
                }
              }
            }
          },

          "413": {
            description:
              "Candidate report exceeds the upload limit.",

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
              "Candidate upload is not configured.",

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

    "/api/v1/admin/refresh": {
      post: {
        tags: [
          "Administration"
        ],

        summary:
          "Refresh all production snapshots",

        operationId:
          "refreshAgentSnapshots",

        security: [
          {
            adminBearer: []
          }
        ],

        responses: {
          "200": {
            description:
              "Snapshot refresh completed.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/AgentRefreshReport"
                }
              }
            }
          },

          "401": {
            description:
              "Bearer authentication failed.",

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/ErrorResponse"
                }
              }
            }
          },

          "409": {
            description:
              "Another refresh is already running.",

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
              "Administrative refresh is not configured.",

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

            headers:
              rateLimitResponseHeaders,

            content: {
              "application/json": {
                schema: {
                  $ref:
                    "#/components/schemas/RankingResponse"
                }
              }
            }
          },

          "429": {
            description:
              "Ranking request limit exceeded.",

            headers:
              rateLimitExceededResponseHeaders,

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

            headers:
              rateLimitResponseHeaders,

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
          },

          "429": {
            description:
              "Comparison request limit exceeded.",

            headers:
              rateLimitExceededResponseHeaders,

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
    securitySchemes: {
      adminBearer: {
        type: "http",
        scheme: "bearer",

        description:
          "Administrative refresh token."
      },

      candidateUploadBearer: {
        type: "http",
        scheme: "bearer",

        description:
          "Administrative candidate report upload token."
      },

      candidateReviewBearer: {
        type: "http",
        scheme: "bearer",

        description:
          "Administrative candidate review token."
      }
    },

    schemas: {
      BankrCandidateReport: {
        type: "object",

        required: [
          "schemaVersion",
          "source",
          "generatedAt",
          "profilesListed",
          "detailsLoaded",
          "failures",
          "candidates",
          "websiteDiscovery",
          "ownerDiscovery",
          "globalGitHubDiscovery",
          "githubEvidence"
        ],

        additionalProperties:
          true
      },

      CandidateReviewRequest: {
        type: "object",

        required: [
          "bankrProfileId",
          "repositoryUrl",
          "decision"
        ],

        additionalProperties:
          false,

        properties: {
          bankrProfileId: {
            type: "string",
            minLength: 1
          },

          repositoryUrl: {
            type: "string",
            format: "uri"
          },

          decision: {
            type: "string",
            enum: [
              "approve",
              "reject",
              "reset"
            ]
          },

          note: {
            type: [
              "string",
              "null"
            ],

            maxLength:
              500
          }
        }
      },

      CandidateReviewView: {
        type: "object",

        required: [
          "schemaVersion",
          "reportGeneratedAt",
          "reviewUpdatedAt",
          "counts",
          "items",
          "proposals"
        ],

        additionalProperties:
          true
      },

      CandidateUploadResponse: {
        type: "object",

        required: [
          "schemaVersion",
          "stored",
          "generatedAt",
          "candidates",
          "outputPath"
        ],

        properties: {
          schemaVersion: {
            type: "string",
            const: "1.0"
          },

          stored: {
            type: "boolean",
            const: true
          },

          generatedAt: {
            type: "string",
            format: "date-time"
          },

          candidates: {
            type: "integer",
            minimum: 0
          },

          outputPath: {
            type: "string"
          }
        }
      },

      AgentRefreshReport: {
        type: "object",

        required: [
          "schemaVersion",
          "startedAt",
          "completedAt",
          "durationMs",
          "totals",
          "results"
        ],

        properties: {
          schemaVersion: {
            type: "string",
            const: "1.0"
          },

          startedAt: {
            type: "string",
            format: "date-time"
          },

          completedAt: {
            type: "string",
            format: "date-time"
          },

          durationMs: {
            type: "integer",
            minimum: 0
          },

          totals: {
            type: "object",

            required: [
              "registered",
              "refreshed",
              "failed"
            ],

            properties: {
              registered: {
                type: "integer",
                minimum: 0
              },

              refreshed: {
                type: "integer",
                minimum: 0
              },

              failed: {
                type: "integer",
                minimum: 0
              }
            }
          },

          results: {
            type: "array",

            items: {
              type: "object"
            }
          }
        }
      },

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
          "sourceCollectedAt",
          "evaluationCollectedAt",
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

          sourceCollectedAt: {
            type: "string",
            format: "date-time"
          },

          evaluationCollectedAt: {
            type: "string",
            format: "date-time"
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
                  "REFRESH_AUTHENTICATION_FAILED",
                  "REFRESH_NOT_CONFIGURED",
                  "REFRESH_ALREADY_RUNNING",
                  "RATE_LIMIT_EXCEEDED",
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

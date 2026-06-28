import assert from "node:assert/strict";
import test from "node:test";

import {
  BankrClientError,
  getBankrAgentProfile,
  listApprovedBankrProfiles
} from "./bankr-client.js";

type MockFetchCall = {
  url: string;
  init: RequestInit | undefined;
};

function createJsonResponse(
  body: unknown,
  status = 200
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        "Content-Type":
          "application/json"
      }
    }
  );
}

function createMockFetch(
  responses: Response[]
): {
  fetcher: typeof fetch;
  calls: MockFetchCall[];
} {
  const queue =
    [
      ...responses
    ];

  const calls:
  MockFetchCall[] =
    [];

  const fetcher =
    (
      async (
        input:
          string |
          URL |
          Request,
        init?: RequestInit
      ) => {
        calls.push(
          {
            url:
              String(input),

            init
          }
        );

        const response =
          queue.shift();

        if (!response) {
          throw new Error(
            "Unexpected mock Bankr request."
          );
        }

        return response;
      }
    ) as typeof fetch;

  return {
    fetcher,
    calls
  };
}

function createTokenAddress(
  index: number
): string {
  return (
    `0x${index
      .toString(16)
      .padStart(
        40,
        "0"
      )}`
  );
}

function createSummary(
  index = 1,
  overrides:
    Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id:
      `profile-${index}`,

    slug:
      `agent-${index}`,

    projectName:
      `Agent ${index}`,

    description:
      `Description ${index}`,

    profileImageUrl:
      `https://example.com/${index}.png`,

    projectImages:
      [],

    tokenAddress:
      createTokenAddress(
        index
      ),

    tokenChainId:
      "base",

    tokenSymbol:
      `AG${index}`,

    tokenName:
      `Agent Token ${index}`,

    marketCapUsd:
      1_000 + index,

    weeklyRevenueWeth:
      "0.125",

    twitterUsername:
      null,

    website:
      `https://agent-${index}.example`,

    productsCount:
      0,

    createdAt:
      "2026-06-28T00:00:00.000Z",

    ...overrides
  };
}

test(
  "lists profiles and normalizes EVM token addresses",
  async () => {
    const uppercaseAddress =
      `0x${"AB".repeat(20)}`;

    const mock =
      createMockFetch(
        [
          createJsonResponse(
            {
              profiles: [
                createSummary(
                  1,
                  {
                    tokenAddress:
                      uppercaseAddress,

                    futureField:
                      "preserved"
                  }
                )
              ],

              total: 1,
              limit: 100,
              offset: 0
            }
          )
        ]
      );

    const profiles =
      await listApprovedBankrProfiles(
        {
          fetch:
            mock.fetcher,

          baseUrl:
            "https://bankr.test",

          sort:
            "newest"
        }
      );

    assert.equal(
      profiles.length,
      1
    );

    assert.equal(
      profiles[0]
        ?.tokenAddress,
      uppercaseAddress
        .toLowerCase()
    );

    assert.equal(
      profiles[0]
        ?.twitterUsername,
      null
    );

    assert.equal(
      (
        profiles[0] as
          Record<
            string,
            unknown
          >
      ).futureField,
      "preserved"
    );

    const requestUrl =
      new URL(
        mock.calls[0]?.url ??
        ""
      );

    assert.equal(
      requestUrl.pathname,
      "/agent-profiles"
    );

    assert.equal(
      requestUrl.searchParams.get(
        "sort"
      ),
      "newest"
    );

    assert.equal(
      requestUrl.searchParams.get(
        "limit"
      ),
      "100"
    );

    assert.equal(
      requestUrl.searchParams.get(
        "offset"
      ),
      "0"
    );
  }
);

test(
  "loads every page of approved profiles",
  async () => {
    const firstPage =
      Array.from(
        {
          length: 100
        },
        (
          _,
          index
        ) =>
          createSummary(
            index + 1
          )
      );

    const finalProfile =
      createSummary(
        101
      );

    const mock =
      createMockFetch(
        [
          createJsonResponse(
            {
              profiles:
                firstPage,

              total: 101,
              limit: 100,
              offset: 0
            }
          ),

          createJsonResponse(
            {
              profiles: [
                finalProfile
              ],

              total: 101,
              limit: 100,
              offset: 100
            }
          )
        ]
      );

    const profiles =
      await listApprovedBankrProfiles(
        {
          fetch:
            mock.fetcher
        }
      );

    assert.equal(
      profiles.length,
      101
    );

    assert.equal(
      mock.calls.length,
      2
    );

    const secondRequest =
      new URL(
        mock.calls[1]?.url ??
        ""
      );

    assert.equal(
      secondRequest
        .searchParams
        .get(
          "offset"
        ),
      "100"
    );
  }
);

test(
  "loads and validates a detailed Bankr profile",
  async () => {
    const detail = {
      ...createSummary(
        1,
        {
          productsCount: 2
        }
      ),

      teamMembers: [
        {
          name:
            "Builder",

          role:
            "Creator",

          links: [
            {
              type:
                "github",

              url:
                "https://github.com/example/project"
            }
          ]
        }
      ],

      products: [
        {
          name:
            "Product without URL",

          description:
            "A product URL is optional."
        },

        {
          name:
            "GitHub product",

          description:
            "Open-source product.",

          url:
            "https://github.com/example/project"
        }
      ],

      revenueSources: [
        {
          name:
            "API fees",

          description:
            "Pay-per-call revenue."
        }
      ],

      projectUpdates: [
        {
          title:
            "Product launched",

          content:
            "The product is now live.",

          createdAt:
            "2026-06-28T01:00:00.000Z"
        }
      ],

      approved:
        true,

      futureDetailField:
        42
    };

    const mock =
      createMockFetch(
        [
          createJsonResponse(
            detail
          )
        ]
      );

    const profile =
      await getBankrAgentProfile(
        "agent one",
        {
          fetch:
            mock.fetcher,

          baseUrl:
            "https://bankr.test"
        }
      );

    assert.equal(
      profile.approved,
      true
    );

    assert.equal(
      profile.teamMembers[0]
        ?.links[0]
        ?.type,
      "github"
    );

    assert.equal(
      profile.products[0]
        ?.url,
      undefined
    );

    assert.equal(
      profile.products[1]
        ?.url,
      "https://github.com/example/project"
    );

    assert.equal(
      profile.projectUpdates[0]
        ?.title,
      "Product launched"
    );

    assert.equal(
      (
        profile as Record<
          string,
          unknown
        >
      ).futureDetailField,
      42
    );

    assert.match(
      mock.calls[0]?.url ??
      "",
      /\/agent-profiles\/agent%20one$/
    );
  }
);

test(
  "preserves separate profiles that share one token identity",
  async () => {
    const sharedTokenAddress =
      createTokenAddress(
        500
      );

    const mock =
      createMockFetch(
        [
          createJsonResponse(
            {
              profiles: [
                createSummary(
                  1,
                  {
                    id:
                      "profile-one",

                    slug:
                      "shared-token-one",

                    tokenAddress:
                      sharedTokenAddress
                  }
                ),

                createSummary(
                  2,
                  {
                    id:
                      "profile-two",

                    slug:
                      "shared-token-two",

                    tokenAddress:
                      sharedTokenAddress
                  }
                )
              ],

              total: 2,
              limit: 100,
              offset: 0
            }
          )
        ]
      );

    const profiles =
      await listApprovedBankrProfiles(
        {
          fetch:
            mock.fetcher
        }
      );

    assert.equal(
      profiles.length,
      2
    );

    assert.deepEqual(
      profiles.map(
        (profile) =>
          profile.id
      ),

      [
        "profile-one",
        "profile-two"
      ]
    );

    assert.equal(
      new Set(
        profiles.map(
          (profile) =>
            [
              profile.tokenChainId,
              profile.tokenAddress
            ].join(":")
        )
      ).size,
      1
    );
  }
);

test(
  "rejects an invalid Base token address",
  async () => {
    const mock =
      createMockFetch(
        [
          createJsonResponse(
            {
              profiles: [
                createSummary(
                  1,
                  {
                    tokenAddress:
                      "not-an-address"
                  }
                )
              ],

              total: 1,
              limit: 100,
              offset: 0
            }
          )
        ]
      );

    await assert.rejects(
      () =>
        listApprovedBankrProfiles(
          {
            fetch:
              mock.fetcher
          }
        ),

      (
        error: unknown
      ) => {
        assert.ok(
          error instanceof
          BankrClientError
        );

        assert.equal(
          error.code,
          "BANKR_INVALID_RESPONSE"
        );

        assert.match(
          JSON.stringify(
            error.details
          ),
          /tokenAddress/
        );

        return true;
      }
    );
  }
);

test(
  "rejects invalid JSON returned by Bankr",
  async () => {
    const mock =
      createMockFetch(
        [
          new Response(
            "{invalid-json",
            {
              status: 200
            }
          )
        ]
      );

    await assert.rejects(
      () =>
        listApprovedBankrProfiles(
          {
            fetch:
              mock.fetcher
          }
        ),

      (
        error: unknown
      ) => {
        assert.ok(
          error instanceof
          BankrClientError
        );

        assert.equal(
          error.code,
          "BANKR_INVALID_RESPONSE"
        );

        assert.match(
          error.message,
          /invalid JSON/
        );

        return true;
      }
    );
  }
);

test(
  "maps retryable Bankr HTTP failures",
  async () => {
    const mock =
      createMockFetch(
        [
          createJsonResponse(
            {
              error:
                "Too many requests"
            },
            429
          )
        ]
      );

    await assert.rejects(
      () =>
        getBankrAgentProfile(
          "agent-one",
          {
            fetch:
              mock.fetcher
          }
        ),

      (
        error: unknown
      ) => {
        assert.ok(
          error instanceof
          BankrClientError
        );

        assert.equal(
          error.code,
          "BANKR_HTTP_ERROR"
        );

        assert.equal(
          error.upstreamStatus,
          429
        );

        assert.equal(
          error.retryable,
          true
        );

        return true;
      }
    );
  }
);

test(
  "maps network failures before a response is received",
  async () => {
    const fetcher =
      (
        async () => {
          throw new TypeError(
            "Network unavailable."
          );
        }
      ) as typeof fetch;

    await assert.rejects(
      () =>
        listApprovedBankrProfiles(
          {
            fetch:
              fetcher
          }
        ),

      (
        error: unknown
      ) => {
        assert.ok(
          error instanceof
          BankrClientError
        );

        assert.equal(
          error.code,
          "BANKR_REQUEST_FAILED"
        );

        assert.equal(
          error.retryable,
          true
        );

        return true;
      }
    );
  }
);

test(
  "rejects an empty Bankr profile identifier",
  async () => {
    await assert.rejects(
      () =>
        getBankrAgentProfile(
          "   "
        ),

      (
        error: unknown
      ) => {
        assert.ok(
          error instanceof
          BankrClientError
        );

        assert.equal(
          error.code,
          "BANKR_INVALID_ARGUMENT"
        );

        return true;
      }
    );
  }
);

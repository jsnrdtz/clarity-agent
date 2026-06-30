import assert from "node:assert/strict";
import test from "node:test";

import {
  BankrWebsiteDiscoveryError,
  discoverBankrWebsiteGitHub
} from "./bankr-website-github.js";

const publicLookup =
  async () => [
    {
      address:
        "93.184.216.34"
    }
  ];

test(
  "extracts GitHub repositories and owner pages from an official website",
  async () => {
    const result =
      await discoverBankrWebsiteGitHub(
        "https://example.com",
        {
          lookupHost:
            publicLookup,

          fetchWebsite:
            async () =>
              new Response(
                [
                  "<html>",
                  '<a href="https://github.com/ExampleOrg/MainAgent">',
                  "Official source code",
                  "</a>",
                  '<a href="https://github.com/ExampleOrg">',
                  "GitHub organization",
                  "</a>",
                  "</html>"
                ].join(""),
                {
                  status:
                    200,

                  headers: {
                    "content-type":
                      "text/html; charset=utf-8"
                  }
                }
              )
        }
      );

    assert.deepEqual(
      result.repositories.map(
        (repository) =>
          repository.url
      ),
      [
        "https://github.com/ExampleOrg/MainAgent"
      ]
    );

    assert.deepEqual(
      result.ownerUrls,
      [
        "https://github.com/ExampleOrg"
      ]
    );

    assert.equal(
      result
        .repositories[0]
        ?.sources[0],
      "website-page"
    );

    assert.equal(
      result
        .repositories[0]
        ?.confidence,
      "high"
    );
  }
);

test(
  "blocks private website addresses before fetching",
  async () => {
    let fetchCalls =
      0;

    await assert.rejects(
      discoverBankrWebsiteGitHub(
        "http://127.0.0.1",
        {
          fetchWebsite:
            async () => {
              fetchCalls +=
                1;

              return new Response(
                "unexpected"
              );
            }
        }
      ),

      (
        error: unknown
      ) =>
        error instanceof
          BankrWebsiteDiscoveryError &&
        error.code ===
          "WEBSITE_BLOCKED_ADDRESS"
    );

    assert.equal(
      fetchCalls,
      0
    );
  }
);

test(
  "blocks redirects to private addresses",
  async () => {
    let fetchCalls =
      0;

    await assert.rejects(
      discoverBankrWebsiteGitHub(
        "https://example.com",
        {
          lookupHost:
            publicLookup,

          fetchWebsite:
            async () => {
              fetchCalls +=
                1;

              return new Response(
                null,
                {
                  status:
                    302,

                  headers: {
                    location:
                      "http://127.0.0.1/private"
                  }
                }
              );
            }
        }
      ),

      (
        error: unknown
      ) =>
        error instanceof
          BankrWebsiteDiscoveryError &&
        error.code ===
          "WEBSITE_BLOCKED_ADDRESS"
    );

    assert.equal(
      fetchCalls,
      1
    );
  }
);

test(
  "rejects website responses larger than the configured limit",
  async () => {
    await assert.rejects(
      discoverBankrWebsiteGitHub(
        "https://example.com",
        {
          lookupHost:
            publicLookup,

          maxBytes:
            10,

          fetchWebsite:
            async () =>
              new Response(
                "01234567890123456789",
                {
                  status:
                    200,

                  headers: {
                    "content-type":
                      "text/html",

                    "content-length":
                      "20"
                  }
                }
              )
        }
      ),

      (
        error: unknown
      ) =>
        error instanceof
          BankrWebsiteDiscoveryError &&
        error.code ===
          "WEBSITE_TOO_LARGE"
    );
  }
);

test(
  "does not treat social profiles as project websites",
  async () => {
    const {
      isBankrProjectWebsiteUrl
    } =
      await import(
        "./bankr-website-github.js"
      );

    assert.equal(
      isBankrProjectWebsiteUrl(
        "https://x.com/example"
      ),
      false
    );

    assert.equal(
      isBankrProjectWebsiteUrl(
        "https://example.com"
      ),
      true
    );
  }
);

test(
  "ignores reserved GitHub navigation routes as owner pages",
  async () => {
    const result =
      await discoverBankrWebsiteGitHub(
        "https://example.com",
        {
          lookupHost:
            publicLookup,

          fetchWebsite:
            async () =>
              new Response(
                [
                  "<html>",
                  '<a href="https://github.com/pulls">Pull requests</a>',
                  '<a href="https://github.com/issues">Issues</a>',
                  '<a href="https://github.com/actions">Actions</a>',
                  "</html>"
                ].join(""),
                {
                  status:
                    200,

                  headers: {
                    "content-type":
                      "text/html"
                  }
                }
              )
        }
      );

    assert.deepEqual(
      result.ownerUrls,
      []
    );

    assert.deepEqual(
      result.repositories,
      []
    );
  }
);

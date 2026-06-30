const state = {
  items: [],
  report: null,
  reviews: null,

  reviewByTarget:
    new Map()
};

const statusElement =
  document.querySelector(
    "#cr-status"
  );

const summaryElement =
  document.querySelector(
    "#cr-summary"
  );

const resultsElement =
  document.querySelector(
    "#cr-results"
  );

const searchElement =
  document.querySelector(
    "#cr-search"
  );

const filterElement =
  document.querySelector(
    "#cr-filter"
  );

function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

function safeUrl(
  value
) {
  try {
    const parsed =
      new URL(
        String(value)
      );

    if (
      parsed.protocol !== "https:" &&
      parsed.protocol !== "http:"
    ) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeRepositoryUrl(
  value
) {
  try {
    const parsed =
      new URL(
        String(value)
      );

    return [
      parsed.hostname.toLowerCase(),
      parsed.pathname
        .replace(
          /\/$/u,
          ""
        )
        .toLowerCase()
    ].join("");
  } catch {
    return String(
      value ??
      ""
    )
      .trim()
      .toLowerCase();
  }
}

function createReviewTargetKey(
  bankrProfileId,
  repositoryUrl
) {
  return [
    String(
      bankrProfileId ??
      ""
    )
      .trim()
      .toLowerCase(),

    normalizeRepositoryUrl(
      repositoryUrl
    )
  ].join("\n");
}

function indexReviewDecisions(
  reviews
) {
  state.reviewByTarget =
    new Map();

  for (
    const item
    of reviews?.items ??
      []
  ) {
    state.reviewByTarget.set(
      createReviewTargetKey(
        item.bankrProfileId,
        item.repositoryUrl
      ),

      item.decision
    );
  }
}

function renderDecisionBadge(
  decision
) {
  if (!decision) {
    return "";
  }

  const label =
    decision.status ===
      "approved"
      ? "APPROVED"
      : "REJECTED";

  return `
    <span class="cr-decision cr-decision-${escapeHtml(decision.status)}">
      ${label}
    </span>
  `;
}

function formatDate(
  value
) {
  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "UNKNOWN";
  }

  return date.toLocaleString(
    undefined,
    {
      dateStyle:
        "medium",

      timeStyle:
        "short"
    }
  );
}

async function requestJson(
  url,
  timeoutMs = 15_000
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      timeoutMs
    );

  try {
    const response =
      await fetch(
        url,
        {
          headers: {
            Accept:
              "application/json"
          },

          signal:
            controller.signal
        }
      );

    let body;

    try {
      body =
        await response.json();
    } catch {
      throw new Error(
        "Clarity returned an invalid response."
      );
    }

    if (!response.ok) {
      throw new Error(
        body?.error?.message ??
        `Request failed with status ${response.status}.`
      );
    }

    return body;
  } catch (error) {
    if (
      error?.name ===
        "AbortError"
    ) {
      throw new Error(
        "Candidate report request timed out."
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout
    );
  }
}

function createSummaryCard(
  label,
  value
) {
  return `
    <article>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function buildItems(
  report
) {
  const items =
    [];

  for (
    const candidate
    of report.candidates ??
      []
  ) {
    if (
      !Array.isArray(
        candidate.githubRepositories
      ) ||
      candidate
        .githubRepositories
        .length === 0
    ) {
      continue;
    }

    items.push(
      {
        type:
          "direct",

        status:
          "direct",

        bankrProfileId:
          candidate.bankrProfileId,

        title:
          candidate.name,

        slug:
          candidate.bankrSlug,

        website:
          candidate.website,

        description:
          candidate.description,

        repositories:
          candidate.githubRepositories,

        warnings:
          candidate.warnings ??
            [],

        searchText:
          [
            candidate.name,
            candidate.bankrSlug,
            candidate.website,
            ...candidate
              .githubRepositories
              .flatMap(
                (repository) => [
                  repository.owner,
                  repository.repository,
                  repository.url
                ]
              )
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
      }
    );
  }

  for (
    const result
    of report
      .ownerDiscovery
      ?.results ??
      []
  ) {
    for (
      const repository
      of result.candidates ??
        []
    ) {
      items.push(
        {
          type:
            "owner",

          bankrProfileId:
            result.bankrProfileId,

          status:
            repository.probable
              ? "probable"
              : "review",

          title:
            result.bankrSlug,

          slug:
            result.bankrSlug,

          owner:
            result.owner,

          ownerStatus:
            result.status,

          repository,

          searchText:
            [
              result.bankrSlug,
              result.owner,
              repository.owner,
              repository.repository,
              repository.url,
              repository.description
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
        }
      );
    }
  }

  return items;
}

function renderDirectItem(
  item
) {
  const websiteUrl =
    safeUrl(
      item.website
    );

  const repositoryRows =
    item.repositories
      .map(
        (repository) => {
          const url =
            safeUrl(
              repository.url
            );

          const decision =
            state.reviewByTarget.get(
              createReviewTargetKey(
                item.bankrProfileId,
                repository.url
              )
            );

          return `
            <li>
              ${
                url
                  ? `
                    <a
                      href="${escapeHtml(url)}"
                      target="_blank"
                      rel="noreferrer"
                    >
                      ${escapeHtml(repository.owner)}/${escapeHtml(repository.repository)}
                    </a>
                  `
                  : `
                    <strong>
                      ${escapeHtml(repository.owner)}/${escapeHtml(repository.repository)}
                    </strong>
                  `
              }

              ${renderDecisionBadge(decision)}

              <div class="cr-repo-meta">
                <span>
                  ${escapeHtml(repository.relationship)}
                </span>

                <span>
                  ${escapeHtml(repository.confidence)} confidence
                </span>

                <span>
                  ${escapeHtml((repository.sources ?? []).join(", "))}
                </span>
              </div>
            </li>
          `;
        }
      )
      .join("");

  return `
    <article class="cr-card">
      <div class="cr-card-head">
        <div>
          <span class="cr-label cr-label-direct">
            DIRECT EVIDENCE
          </span>

          <h2>
            ${escapeHtml(item.title)}
          </h2>

          <p>
            /${escapeHtml(item.slug)}
          </p>
        </div>

        ${
          websiteUrl
            ? `
              <a
                class="cr-link"
                href="${escapeHtml(websiteUrl)}"
                target="_blank"
                rel="noreferrer"
              >
                WEBSITE ↗
              </a>
            `
            : ""
        }
      </div>

      ${
        item.description
          ? `
            <p class="cr-description">
              ${escapeHtml(item.description)}
            </p>
          `
          : ""
      }

      <ul class="cr-repositories">
        ${repositoryRows}
      </ul>
    </article>
  `;
}

function renderOwnerItem(
  item
) {
  const repository =
    item.repository;

  const url =
    safeUrl(
      repository.url
    );

  const decision =
    state.reviewByTarget.get(
      createReviewTargetKey(
        item.bankrProfileId,
        repository.url
      )
    );

  const label =
    item.status ===
      "probable"
      ? "PROBABLE MATCH"
      : "MANUAL REVIEW";

  return `
    <article class="cr-card">
      <div class="cr-card-head">
        <div>
          <span class="cr-label cr-label-${escapeHtml(item.status)}">
            ${label}
          </span>

          <h2>
            ${escapeHtml(item.title)}
          </h2>

          <p>
            GitHub owner:
            ${escapeHtml(item.owner)}
          </p>
        </div>

        <strong class="cr-score">
          ${escapeHtml(repository.score)}
        </strong>
      </div>

      ${renderDecisionBadge(decision)}

      <div class="cr-owner-repository">
        ${
          url
            ? `
              <a
                href="${escapeHtml(url)}"
                target="_blank"
                rel="noreferrer"
              >
                ${escapeHtml(repository.owner)}/${escapeHtml(repository.repository)}
              </a>
            `
            : `
              <strong>
                ${escapeHtml(repository.owner)}/${escapeHtml(repository.repository)}
              </strong>
            `
        }

        <span>
          ${escapeHtml(repository.role ?? "unknown")}
        </span>
      </div>

      ${
        repository.description
          ? `
            <p class="cr-description">
              ${escapeHtml(repository.description)}
            </p>
          `
          : ""
      }

      <ul class="cr-reasons">
        ${
          (
            repository.reasons ??
            []
          )
            .map(
              (reason) => `
                <li>
                  ${escapeHtml(reason)}
                </li>
              `
            )
            .join("")
        }
      </ul>
    </article>
  `;
}

function renderResults() {
  const query =
    searchElement
      .value
      .trim()
      .toLowerCase();

  const filter =
    filterElement.value;

  const visibleItems =
    state.items.filter(
      (item) => {
        const filterMatches =
          filter === "all" ||
          item.status === filter;

        const searchMatches =
          !query ||
          item
            .searchText
            .includes(
              query
            );

        return (
          filterMatches &&
          searchMatches
        );
      }
    );

  if (
    visibleItems.length === 0
  ) {
    resultsElement.innerHTML = `
      <div class="cr-empty">
        NO MATCHING CANDIDATE EVIDENCE
      </div>
    `;

    return;
  }

  resultsElement.innerHTML =
    visibleItems
      .map(
        (item) =>
          item.type ===
            "direct"
            ? renderDirectItem(
                item
              )
            : renderOwnerItem(
                item
              )
      )
      .join("");
}

function renderReport(
  report,
  reviews
) {
  state.report =
    report;

  state.reviews =
    reviews;

  indexReviewDecisions(
    reviews
  );

  state.items =
    buildItems(
      report
    );

  statusElement.textContent =
    `GENERATED ${formatDate(report.generatedAt)}`;

  summaryElement.innerHTML =
    [
      createSummaryCard(
        "PROFILES",
        report.profilesListed
      ),

      createSummaryCard(
        "DIRECT GITHUB",
        report
          .githubEvidence
          .candidatesWithGitHub
      ),

      createSummaryCard(
        "PROBABLE",
        report
          .ownerDiscovery
          .probable
      ),

      createSummaryCard(
        "REVIEW",
        report
          .ownerDiscovery
          .review
      ),

      createSummaryCard(
        "WEBSITE REPOS",
        report
          .websiteDiscovery
          .repositoriesFound
      ),

      createSummaryCard(
        "FAILURES",
        (
          report.failures.length +
          report
            .websiteDiscovery
            .failed +
          report
            .ownerDiscovery
            .failed
        )
      )
    ].join("");

  renderResults();
}

function renderError(
  error
) {
  statusElement.textContent =
    "REPORT UNAVAILABLE";

  summaryElement.innerHTML =
    "";

  resultsElement.innerHTML = `
    <div class="cr-error">
      <strong>
        CANDIDATE REPORT COULD NOT BE LOADED
      </strong>

      <p>
        ${escapeHtml(error.message)}
      </p>
    </div>
  `;
}

searchElement.addEventListener(
  "input",
  renderResults
);

filterElement.addEventListener(
  "change",
  renderResults
);

void Promise.all(
  [
    requestJson(
      "/api/v1/candidates/bankr"
    ),

    requestJson(
      "/api/v1/candidates/bankr/reviews"
    ).catch(
      () => null
    )
  ]
)
  .then(
    (
      [
        report,
        reviews
      ]
    ) => {
      renderReport(
        report,
        reviews
      );
    }
  )
  .catch(
    renderError
  );

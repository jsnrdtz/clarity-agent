const page =
  document.querySelector(
    "#agentPage"
  );

const systemStatus =
  document.querySelector(
    "#agentSystemStatus"
  );

const systemStatusText =
  document.querySelector(
    "#agentSystemStatusText"
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
    const url =
      new URL(
        String(value)
      );

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function clampScore(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      number
    )
  );
}

function formatNumber(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return "—";
  }

  return new Intl
    .NumberFormat("en")
    .format(number);
}

function formatDate(
  value
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown";
  }

  return new Intl
    .DateTimeFormat(
      "en",
      {
        year:
          "numeric",

        month:
          "short",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit"
      }
    )
    .format(date);
}

function formatRelativeTime(
  value
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "unknown";
  }

  const seconds =
    Math.round(
      (
        date.getTime() -
        Date.now()
      ) /
      1000
    );

  const formatter =
    new Intl.RelativeTimeFormat(
      "en",
      {
        numeric:
          "auto"
      }
    );

  if (
    Math.abs(seconds) <
    60
  ) {
    return formatter.format(
      seconds,
      "second"
    );
  }

  const minutes =
    Math.round(
      seconds /
      60
    );

  if (
    Math.abs(minutes) <
    60
  ) {
    return formatter.format(
      minutes,
      "minute"
    );
  }

  const hours =
    Math.round(
      minutes /
      60
    );

  if (
    Math.abs(hours) <
    48
  ) {
    return formatter.format(
      hours,
      "hour"
    );
  }

  return formatter.format(
    Math.round(
      hours /
      24
    ),
    "day"
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
    const errorName =
      (
        typeof error === "object" &&
        error !== null &&
        "name" in error
      )
        ? String(error.name)
        : "";

    if (
      errorName ===
      "AbortError"
    ) {
      throw new Error(
        "The evaluation took too long. Try refreshing the page in a moment."
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout
    );
  }
}

function getAgentSlug() {
  const match =
    window.location.pathname.match(
      /^\/agents\/([^/]+)\/?$/i
    );

  if (!match?.[1]) {
    throw new Error(
      "Agent slug is missing from the URL."
    );
  }

  return decodeURIComponent(
    match[1]
  );
}

function findRankingEntry(
  ranking,
  slug
) {
  const ranked =
    Array.isArray(
      ranking?.ranked
    )
      ? ranking.ranked
      : [];

  const unranked =
    Array.isArray(
      ranking?.unranked
    )
      ? ranking.unranked
      : [];

  const rankedEntry =
    ranked.find(
      (entry) =>
        entry.agent?.slug ===
        slug
    );

  if (rankedEntry) {
    return {
      status:
        "ranked",

      rank:
        rankedEntry.rank,

      reason:
        "Eligible for the public Clarity ranking."
    };
  }

  const unrankedEntry =
    unranked.find(
      (entry) =>
        entry.agent?.slug ===
        slug
    );

  if (unrankedEntry) {
    return {
      status:
        "review",

      rank:
        null,

      reason:
        unrankedEntry.reason
    };
  }

  return {
    status:
      "unknown",

    rank:
      null,

    reason:
      "Ranking status is unavailable."
  };
}

function createMetricCard(
  label,
  value
) {
  const normalized =
    clampScore(
      value
    );

  return `
    <article class="agent-metric-card">
      <div class="agent-metric-header">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(normalized)}</strong>
      </div>

      <progress
        max="100"
        value="${escapeHtml(normalized)}"
        aria-label="${escapeHtml(label)} score"
      ></progress>
    </article>
  `;
}

function createCoreRepositoryCard(
  repository
) {
  const url =
    safeUrl(
      repository.url
    );

  const title =
    escapeHtml(
      repository.fullName
    );

  return `
    <article class="agent-repository-card">
      <div class="repository-card-heading">
        <div>
          <span class="repository-role">
            ${escapeHtml(repository.role)}
          </span>

          <h3>${title}</h3>
        </div>

        ${
          url
            ? `
              <a
                href="${escapeHtml(url)}"
                target="_blank"
                rel="noreferrer"
                aria-label="Open ${title} on GitHub"
              >
                ↗
              </a>
            `
            : ""
        }
      </div>

      <div class="repository-stats">
        <span>
          STARS
          <strong>${formatNumber(repository.stars)}</strong>
        </span>

        <span>
          FORKS
          <strong>${formatNumber(repository.forks)}</strong>
        </span>

        <span>
          COMMITS 30D
          <strong>${formatNumber(repository.commitsLast30Days)}</strong>
        </span>

        <span>
          CONTRIBUTORS
          <strong>${formatNumber(repository.contributors)}</strong>
        </span>

        <span>
          RELEASES 90D
          <strong>${formatNumber(repository.releasesLast90Days)}</strong>
        </span>

        <span>
          RELATION
          <strong>${formatNumber(repository.relationScore)}</strong>
        </span>
      </div>

      ${
        repository.isAnchor
          ? `
            <div class="repository-anchor">
              PRIMARY ANCHOR REPOSITORY
            </div>
          `
          : ""
      }
    </article>
  `;
}

function createRelatedRepositoryCard(
  repository
) {
  const url =
    safeUrl(
      repository.url
    );

  const title =
    escapeHtml(
      repository.fullName
    );

  return `
    <article class="related-repository-card">
      <div>
        <span>
          ${escapeHtml(repository.role)}
          /
          ${escapeHtml(repository.relationStatus)}
        </span>

        <h3>${title}</h3>
      </div>

      <div class="related-repository-meta">
        <span>
          SCORE
          <strong>${formatNumber(repository.relationScore)}</strong>
        </span>

        <span>
          STARS
          <strong>${formatNumber(repository.stars)}</strong>
        </span>

        ${
          url
            ? `
              <a
                href="${escapeHtml(url)}"
                target="_blank"
                rel="noreferrer"
              >
                OPEN ↗
              </a>
            `
            : ""
        }
      </div>
    </article>
  `;
}

function createList(
  values,
  emptyMessage
) {
  if (
    !Array.isArray(values) ||
    values.length === 0
  ) {
    return `
      <li class="agent-list-empty">
        ${escapeHtml(emptyMessage)}
      </li>
    `;
  }

  return values
    .map(
      (value) => `
        <li>${escapeHtml(value)}</li>
      `
    )
    .join("");
}

function renderAgent(
  evaluation,
  rankingState
) {
  const agent =
    evaluation.agent;

  const github =
    evaluation.github;

  const scores =
    evaluation.scores.github;

  const evidence =
    evaluation.scores
      .publicEvidence;

  const eligibility =
    evaluation.eligibility
      .ranking;

  const summary =
    evaluation.summary;

  const delivery =
    evaluation.delivery ?? {};

  const core =
    evaluation.repositories
      .core ?? [];

  const ecosystem =
    evaluation.repositories
      .ecosystem ?? [];

  const review =
    evaluation.repositories
      .review ?? [];

  const anchorUrl =
    safeUrl(
      github.anchorUrl
    );

  const rankingLabel =
    rankingState.status ===
      "ranked"
      ? `RANK #${rankingState.rank}`
      : rankingState.status ===
          "review"
        ? "REVIEW QUEUE"
        : "STATUS UNKNOWN";

  const eligibilityClass =
    eligibility.eligible
      ? "agent-status-positive"
      : "agent-status-review";

  document.title =
    `${agent.name} Intelligence — Clarity`;

  page.innerHTML = `
    <section class="agent-profile-hero">
      <div class="agent-profile-copy">
        <a
          class="agent-back-link"
          href="/#index"
        >
          ← BACK TO INDEX
        </a>

        <p class="eyebrow">
          AGENT INTELLIGENCE
          <span class="eyebrow-separator">/</span>
          ${escapeHtml(rankingLabel)}
        </p>

        <h1>${escapeHtml(agent.name)}</h1>

        <p class="agent-profile-slug">
          /agents/${escapeHtml(agent.slug)}
        </p>

        <p class="agent-profile-description">
          ${escapeHtml(evidence.interpretation)}
        </p>

        <div class="agent-profile-actions">
          ${
            anchorUrl
              ? `
                <a
                  class="button button-primary"
                  href="${escapeHtml(anchorUrl)}"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open GitHub
                  <span>↗</span>
                </a>
              `
              : ""
          }

          <button
            class="button button-secondary"
            id="shareAgentButton"
            type="button"
          >
            Copy agent URL
          </button>
        </div>
      </div>

      <div class="agent-score-board">
        <article class="agent-score-primary">
          <span>GITHUB SCORE</span>

          <strong>
            ${escapeHtml(clampScore(scores.overall))}
            <small>/100</small>
          </strong>

          <p>
            Observable public engineering performance.
          </p>
        </article>

        <article>
          <span>EVIDENCE COVERAGE</span>
          <strong>${escapeHtml(clampScore(evidence.coverage))}/100</strong>
        </article>

        <article>
          <span>CONFIDENCE</span>
          <strong>${escapeHtml(evidence.confidence.toUpperCase())}</strong>
        </article>

        <article>
          <span>VISIBILITY</span>
          <strong>${escapeHtml(evidence.detectedVisibility.toUpperCase())}</strong>
        </article>

        <article>
          <span>DELIVERY</span>
          <strong>${escapeHtml(
            String(
              delivery.source ??
              "unknown"
            ).toUpperCase()
          )}</strong>
        </article>
      </div>
    </section>

    <section class="agent-status-strip">
      <article>
        <span>RANKING STATUS</span>

        <strong class="${eligibilityClass}">
          ${escapeHtml(
            eligibility.eligible
              ? rankingLabel
              : "NOT RANKED"
          )}
        </strong>

        <small>
          ${escapeHtml(eligibility.reason)}
        </small>
      </article>

      <article>
        <span>ANCHOR</span>

        <strong>
          ${escapeHtml(github.anchorFullName)}
        </strong>

        <small>
          ${escapeHtml(github.anchorScope)}
        </small>
      </article>

      <article>
        <span>SOURCE COLLECTED</span>

        <strong>
          ${escapeHtml(
            formatRelativeTime(
              evaluation.sourceCollectedAt
            )
          )}
        </strong>

        <small>
          ${escapeHtml(
            formatDate(
              evaluation.sourceCollectedAt
            )
          )}
        </small>
      </article>

      <article>
        <span>EVALUATED</span>

        <strong>
          ${escapeHtml(
            formatRelativeTime(
              evaluation.collectedAt
            )
          )}
        </strong>

        <small>
          ${escapeHtml(
            formatDate(
              evaluation.collectedAt
            )
          )}
        </small>
      </article>
    </section>

    <section class="agent-profile-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">SCORE BREAKDOWN</p>
          <h2>Visible execution, separated.</h2>
        </div>

        <p>
          The total GitHub Score is deterministic. Each component
          remains visible instead of being hidden behind one number.
        </p>
      </div>

      <div class="agent-breakdown-grid">
        ${createMetricCard("Activity", scores.activity)}
        ${createMetricCard("Collaboration", scores.collaboration)}
        ${createMetricCard("Adoption", scores.adoption)}
        ${createMetricCard("Releases", scores.releases)}
        ${createMetricCard("Data coverage", scores.dataCoverage)}
      </div>
    </section>

    <section class="agent-profile-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">EVIDENCE LAYER</p>
          <h2>Why Clarity trusts this result.</h2>
        </div>

        <p>
          Evidence Confidence evaluates whether the measured public
          activity belongs to the project being ranked.
        </p>
      </div>

      <div class="agent-content-grid">
        <article class="agent-panel">
          <span class="agent-panel-code">SIGNALS</span>
          <h3>Supporting evidence</h3>

          <ul class="agent-list">
            ${createList(
              evidence.signals,
              "No automatic evidence signals were reported."
            )}
          </ul>
        </article>

        <article class="agent-panel">
          <span class="agent-panel-code agent-panel-code-warning">
            LIMITATIONS
          </span>

          <h3>Known uncertainty</h3>

          <ul class="agent-list">
            ${createList(
              evidence.limitations,
              "No automatic limitations were reported."
            )}
          </ul>
        </article>
      </div>
    </section>

    <section class="agent-profile-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">REPOSITORY MAP</p>
          <h2>Core project infrastructure.</h2>
        </div>

        <p>
          Core repositories contribute to the score. Ecosystem and
          review repositories remain visible but are treated separately.
        </p>
      </div>

      <div class="agent-repository-grid">
        ${
          core.length > 0
            ? core
                .map(
                  createCoreRepositoryCard
                )
                .join("")
            : `
              <div class="agent-list-empty">
                No core repositories were identified.
              </div>
            `
        }
      </div>
    </section>

    ${
      ecosystem.length > 0
        ? `
          <section class="agent-profile-section agent-related-section">
            <div class="section-heading">
              <div>
                <p class="eyebrow">ECOSYSTEM</p>
                <h2>Related project repositories.</h2>
              </div>

              <p>
                These repositories are connected to the project but do
                not automatically receive full core-project weight.
              </p>
            </div>

            <div class="related-repository-list">
              ${ecosystem
                .map(
                  createRelatedRepositoryCard
                )
                .join("")}
            </div>
          </section>
        `
        : ""
    }

    ${
      review.length > 0
        ? `
          <section class="agent-profile-section agent-related-section">
            <div class="section-heading">
              <div>
                <p class="eyebrow">MANUAL REVIEW</p>
                <h2>Relationships requiring verification.</h2>
              </div>

              <p>
                Clarity exposes uncertain repository relationships
                instead of silently treating them as core evidence.
              </p>
            </div>

            <div class="related-repository-list">
              ${review
                .map(
                  createRelatedRepositoryCard
                )
                .join("")}
            </div>
          </section>
        `
        : ""
    }

    <section class="agent-profile-section">
      <div class="agent-summary-terminal">
        <div>
          <span>CORE_REPOSITORIES</span>
          <strong>${formatNumber(summary.coreRepositories)}</strong>
        </div>

        <div>
          <span>ECOSYSTEM_REPOSITORIES</span>
          <strong>${formatNumber(summary.ecosystemRepositories)}</strong>
        </div>

        <div>
          <span>REVIEW_REPOSITORIES</span>
          <strong>${formatNumber(summary.reviewRepositories)}</strong>
        </div>

        <div>
          <span>RAW_COMMITS_30D</span>
          <strong>${formatNumber(summary.rawCommitsLast30Days)}</strong>
        </div>

        <div>
          <span>ADJUSTED_ACTIVITY</span>
          <strong>${formatNumber(summary.adjustedActivity)}</strong>
        </div>

        <div>
          <span>UNIQUE_CONTRIBUTORS</span>
          <strong>${formatNumber(summary.uniqueContributors)}</strong>
        </div>
      </div>

      <p class="agent-context-note">
        ${escapeHtml(evaluation.context.registryNote)}
      </p>
    </section>
  `;

  page.setAttribute(
    "aria-busy",
    "false"
  );

  systemStatus.classList.remove(
    "is-error"
  );

  systemStatusText.textContent =
    "AGENT ONLINE";

  const shareButton =
    document.querySelector(
      "#shareAgentButton"
    );

  shareButton?.addEventListener(
    "click",
    async () => {
      try {
        await navigator.clipboard.writeText(
          window.location.href
        );

        shareButton.textContent =
          "URL copied";

        setTimeout(
          () => {
            shareButton.textContent =
              "Copy agent URL";
          },
          1500
        );
      } catch {
        window.prompt(
          "Copy this agent URL:",
          window.location.href
        );
      }
    }
  );
}

function renderError(
  error
) {
  document.title =
    "Agent unavailable — Clarity";

  page.innerHTML = `
    <section class="agent-page-error">
      <a
        class="agent-back-link"
        href="/#index"
      >
        ← BACK TO INDEX
      </a>

      <span class="eyebrow">AGENT INTELLIGENCE ERROR</span>

      <h1>Agent unavailable.</h1>

      <p>${escapeHtml(error.message)}</p>

      <a
        class="button button-primary"
        href="/#index"
      >
        Return to index
      </a>
    </section>
  `;

  page.setAttribute(
    "aria-busy",
    "false"
  );

  systemStatus.classList.add(
    "is-error"
  );

  systemStatusText.textContent =
    "AGENT ERROR";
}

async function loadAgent() {
  try {
    const slug =
      getAgentSlug();

    const [
      evaluation,
      rankingResult
    ] =
      await Promise.all([
        requestJson(
          `/api/v1/evaluate/${encodeURIComponent(
            slug
          )}`
        ),

        requestJson(
          "/api/v1/ranking"
        ).catch(
          () => null
        )
      ]);

    renderAgent(
      evaluation,
      findRankingEntry(
        rankingResult,
        slug
      )
    );
  } catch (error) {
    renderError(
      error instanceof Error
        ? error
        : new Error(
            "Unknown agent evaluation error."
          )
    );
  }
}

void loadAgent();

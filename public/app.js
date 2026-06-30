const elements = {
  systemStatus:
    document.querySelector(
      "#systemStatus"
    ),

  systemStatusText:
    document.querySelector(
      "#systemStatusText"
    ),

  terminalOutput:
    document.querySelector(
      "#terminalOutput"
    ),

  registeredCount:
    document.querySelector(
      "#registeredCount"
    ),

  rankedCount:
    document.querySelector(
      "#rankedCount"
    ),

  reviewCount:
    document.querySelector(
      "#reviewCount"
    ),

  generatedAt:
    document.querySelector(
      "#generatedAt"
    ),

  indexGeneratedLabel:
    document.querySelector(
      "#indexGeneratedLabel"
    ),

  rankingList:
    document.querySelector(
      "#rankingList"
    ),

  unrankedSection:
    document.querySelector(
      "#unrankedSection"
    ),

  unrankedList:
    document.querySelector(
      "#unrankedList"
    ),

  refreshButton:
    document.querySelector(
      "#refreshButton"
    ),

  agentDialog:
    document.querySelector(
      "#agentDialog"
    ),

  dialogTitle:
    document.querySelector(
      "#dialogTitle"
    ),

  dialogContent:
    document.querySelector(
      "#dialogContent"
    ),

  dialogClose:
    document.querySelector(
      "#dialogClose"
    )
};

function escapeHtml(value) {
  return String(value)
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

function clampScore(value) {
  const numeric =
    Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      numeric
    )
  );
}

function formatTimestamp(value) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "unknown";
  }

  return new Intl.DateTimeFormat(
    "en",
    {
      month:
        "short",

      day:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit"
    }
  ).format(date);
}

function formatRelativeTime(value) {
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

  const days =
    Math.round(
      hours /
      24
    );

  return formatter.format(
    days,
    "day"
  );
}

async function requestJson(url) {
  const response =
    await fetch(
      url,
      {
        headers: {
          Accept:
            "application/json"
        }
      }
    );

  let body;

  try {
    body =
      await response.json();
  } catch {
    throw new Error(
      `Invalid response from ${url}.`
    );
  }

  if (!response.ok) {
    throw new Error(
      body?.error?.message ??
      `Request failed with status ${response.status}.`
    );
  }

  return body;
}

function confidenceClass(
  confidence
) {
  if (
    confidence === "high" ||
    confidence === "medium" ||
    confidence === "low"
  ) {
    return `confidence-${confidence}`;
  }

  return "";
}

function createRankedCard(
  entry
) {
  const score =
    clampScore(
      entry.githubScore
    );

  const evidence =
    clampScore(
      entry.evidenceCoverage
    );

  const confidence =
    escapeHtml(
      entry.confidence ??
      "unknown"
    );

  return `
    <article class="agent-card">
      <div class="agent-rank">
        <strong>#${escapeHtml(entry.rank)}</strong>
      </div>

      <div class="agent-identity">
        <h3>${escapeHtml(entry.agent.name)}</h3>

        <span class="agent-slug">
          /${escapeHtml(entry.agent.slug)}
        </span>

        <div class="agent-meta">
          <span class="meta-chip ${confidenceClass(entry.confidence)}">
            ${confidence} evidence
          </span>

          <span class="meta-chip">
            ${escapeHtml(entry.coreRepositories)} core repos
          </span>

          <span class="meta-chip">
            updated ${escapeHtml(formatRelativeTime(entry.evaluationCollectedAt))}
          </span>
        </div>
      </div>

      <div class="evidence-column">
        <div class="evidence-header">
          <span>Evidence confidence</span>
          <strong>${evidence}/100</strong>
        </div>

        <div class="progress-track">
          <div
            class="progress-value"
            style="width: ${evidence}%"
          ></div>
        </div>
      </div>

      <div class="score-column">
        <div>
          <div class="score-header">
            <span>GitHub score</span>
          </div>

          <div class="score-number">
            ${score}<small>/100</small>
          </div>
        </div>

        <button
          class="agent-details-button"
          type="button"
          data-agent-slug="${escapeHtml(entry.agent.slug)}"
          data-agent-name="${escapeHtml(entry.agent.name)}"
          aria-label="View ${escapeHtml(entry.agent.name)} intelligence"
        >
          ↗
        </button>
      </div>
    </article>
  `;
}

function createUnrankedCard(
  entry
) {
  return `
    <article class="unranked-card">
      <div>
        <h4>${escapeHtml(entry.agent.name)}</h4>

        <p class="unranked-reason">
          ${escapeHtml(entry.reason)}
        </p>

        <div class="agent-meta">
          <span class="meta-chip ${confidenceClass(entry.confidence)}">
            ${escapeHtml(entry.confidence)} evidence
          </span>

          <span class="meta-chip">
            evidence ${escapeHtml(entry.evidenceCoverage)}/100
          </span>
        </div>
      </div>

      <div class="unranked-score">
        GitHub Score:
        <strong>${escapeHtml(entry.githubScore)}</strong>

        <button
          class="agent-details-button"
          type="button"
          data-agent-slug="${escapeHtml(entry.agent.slug)}"
          data-agent-name="${escapeHtml(entry.agent.name)}"
          aria-label="View ${escapeHtml(entry.agent.name)} intelligence"
        >
          ↗
        </button>
      </div>
    </article>
  `;
}

function renderRanking(
  ranking
) {
  const ranked =
    Array.isArray(
      ranking.ranked
    )
      ? ranking.ranked
      : [];

  const unranked =
    Array.isArray(
      ranking.unranked
    )
      ? ranking.unranked
      : [];

  elements.rankingList.innerHTML =
    ranked.length > 0
      ? ranked
          .map(
            createRankedCard
          )
          .join("")
      : `
          <div class="empty-state">
            No agents currently meet ranking eligibility.
          </div>
        `;

  elements.rankingList.setAttribute(
    "aria-busy",
    "false"
  );

  elements.unrankedSection.hidden =
    unranked.length === 0;

  elements.unrankedList.innerHTML =
    unranked
      .map(
        createUnrankedCard
      )
      .join("");

  elements.registeredCount.textContent =
    String(
      ranking.totals?.registered ??
      ranked.length +
      unranked.length
    );

  elements.rankedCount.textContent =
    String(
      ranking.totals?.ranked ??
      ranked.length
    );

  elements.reviewCount.textContent =
    String(
      ranking.totals?.unranked ??
      unranked.length
    );

  elements.generatedAt.textContent =
    formatTimestamp(
      ranking.generatedAt
    );

  elements.indexGeneratedLabel.textContent =
    `Generated ${formatRelativeTime(
      ranking.generatedAt
    )}`;

  const leader =
    ranked[0];

  elements.terminalOutput.textContent =
    leader
      ? [
          `LEADER: ${leader.agent.name}`,
          `SCORE: ${leader.githubScore}`,
          `EVIDENCE: ${String(
            leader.confidence
          ).toUpperCase()}`
        ].join("  |  ")
      : "No eligible ranking leader.";

  elements.systemStatus.classList.remove(
    "is-error"
  );

  elements.systemStatusText.textContent =
    "INDEX ONLINE";
}

function renderRankingError(
  error
) {
  elements.rankingList.setAttribute(
    "aria-busy",
    "false"
  );

  elements.rankingList.innerHTML = `
    <div class="error-state">
      <strong>INDEX UNAVAILABLE</strong>
      ${escapeHtml(error.message)}
    </div>
  `;

  elements.systemStatus.classList.add(
    "is-error"
  );

  elements.systemStatusText.textContent =
    "INDEX ERROR";

  elements.terminalOutput.textContent =
    `ERROR: ${error.message}`;
}

async function loadRanking() {
  elements.refreshButton.disabled =
    true;

  elements.systemStatusText.textContent =
    "SYNCING";

  try {
    const ranking =
      await requestJson(
        "/api/v1/ranking"
      );

    renderRanking(
      ranking
    );
  } catch (error) {
    renderRankingError(
      error instanceof Error
        ? error
        : new Error(
            "Unknown ranking error."
          )
    );
  } finally {
    elements.refreshButton.disabled =
      false;
  }
}

function createRepositoryRows(
  repositories
) {
  if (
    !Array.isArray(repositories) ||
    repositories.length === 0
  ) {
    return `
      <li>
        No repositories in this category.
      </li>
    `;
  }

  return repositories
    .map(
      (repository) => `
        <li>
          <a
            href="${escapeHtml(repository.url)}"
            target="_blank"
            rel="noreferrer"
          >
            <span>${escapeHtml(repository.fullName)}</span>
            <span>${escapeHtml(repository.role)}</span>
          </a>
        </li>
      `
    )
    .join("");
}

function renderAgentDetails(
  evaluation
) {
  const github =
    evaluation.scores?.github ??
    {};

  const evidence =
    evaluation.scores
      ?.publicEvidence ??
    {};

  const limitations =
    Array.isArray(
      evidence.limitations
    )
      ? evidence.limitations
      : [];

  const coreRepositories =
    evaluation.repositories?.core ??
    [];

  elements.dialogContent.innerHTML = `
    <div class="dialog-score-grid">
      <article>
        <span>GitHub score</span>
        <strong>${escapeHtml(github.overall ?? "—")}</strong>
      </article>

      <article>
        <span>Evidence coverage</span>
        <strong>${escapeHtml(evidence.coverage ?? "—")}</strong>
      </article>

      <article>
        <span>Confidence</span>
        <strong>${escapeHtml(
          String(
            evidence.confidence ??
            "unknown"
          ).toUpperCase()
        )}</strong>
      </article>
    </div>

    <section class="dialog-section">
      <h3>Score components</h3>

      <div class="dialog-score-grid">
        <article>
          <span>Activity</span>
          <strong>${escapeHtml(github.activity ?? "—")}</strong>
        </article>

        <article>
          <span>Collaboration</span>
          <strong>${escapeHtml(github.collaboration ?? "—")}</strong>
        </article>

        <article>
          <span>Adoption</span>
          <strong>${escapeHtml(github.adoption ?? "—")}</strong>
        </article>

        <article>
          <span>Releases</span>
          <strong>${escapeHtml(github.releases ?? "—")}</strong>
        </article>

        <article>
          <span>Data coverage</span>
          <strong>${escapeHtml(github.dataCoverage ?? "—")}</strong>
        </article>

        <article>
          <span>Core repositories</span>
          <strong>${escapeHtml(coreRepositories.length)}</strong>
        </article>
      </div>
    </section>

    <section class="dialog-section">
      <h3>Core repositories</h3>

      <ul class="repository-list">
        ${createRepositoryRows(coreRepositories)}
      </ul>
    </section>

    <section class="dialog-section">
      <h3>Limitations</h3>

      <ul class="limitation-list">
        ${
          limitations.length > 0
            ? limitations
                .map(
                  (limitation) => `
                    <li>${escapeHtml(limitation)}</li>
                  `
                )
                .join("")
            : "<li>No automatic evidence limitations reported.</li>"
        }
      </ul>
    </section>
  `;
}

async function openAgentDialog(
  slug,
  name
) {
  elements.dialogTitle.textContent =
    name;

  elements.dialogContent.innerHTML = `
    <div class="dialog-loading">
      Loading ${escapeHtml(name)} evaluation...
    </div>
  `;

  if (
    typeof elements.agentDialog.showModal ===
    "function"
  ) {
    elements.agentDialog.showModal();
  } else {
    elements.agentDialog.setAttribute(
      "open",
      ""
    );
  }

  try {
    const evaluation =
      await requestJson(
        `/api/v1/evaluate/${encodeURIComponent(
          slug
        )}`
      );

    renderAgentDetails(
      evaluation
    );
  } catch (error) {
    elements.dialogContent.innerHTML = `
      <div class="error-state">
        <strong>EVALUATION UNAVAILABLE</strong>
        ${escapeHtml(
          error instanceof Error
            ? error.message
            : "Unknown evaluation error."
        )}
      </div>
    `;
  }
}

document.addEventListener(
  "click",
  (event) => {
    const target =
      event.target;

    if (
      !(target instanceof Element)
    ) {
      return;
    }

    const detailsButton =
      target.closest(
        "[data-agent-slug]"
      );

    if (!detailsButton) {
      return;
    }

    const slug =
      detailsButton.getAttribute(
        "data-agent-slug"
      );

    const name =
      detailsButton.getAttribute(
        "data-agent-name"
      );

    if (
      slug &&
      name
    ) {
      void openAgentDialog(
        slug,
        name
      );
    }
  }
);

elements.refreshButton.addEventListener(
  "click",
  () => {
    void loadRanking();
  }
);

elements.dialogClose.addEventListener(
  "click",
  () => {
    elements.agentDialog.close();
  }
);

elements.agentDialog.addEventListener(
  "click",
  (event) => {
    if (
      event.target ===
      elements.agentDialog
    ) {
      elements.agentDialog.close();
    }
  }
);

void loadRanking();

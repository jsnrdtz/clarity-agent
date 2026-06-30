const state = {
  view:
    null,

  token:
    "",

  busyKey:
    null,

  batchBusy:
    false,

  selectedKeys:
    new Set()
};

const tokenElement =
  document.querySelector(
    "#cra-token"
  );

const loadElement =
  document.querySelector(
    "#cra-load"
  );

const forgetElement =
  document.querySelector(
    "#cra-forget"
  );

const statusElement =
  document.querySelector(
    "#cra-status"
  );

const summaryElement =
  document.querySelector(
    "#cra-summary"
  );

const resultsElement =
  document.querySelector(
    "#cra-results"
  );

const searchElement =
  document.querySelector(
    "#cra-search"
  );

const filterElement =
  document.querySelector(
    "#cra-filter"
  );

const proposalCountElement =
  document.querySelector(
    "#cra-proposal-count"
  );

const copyProposalsElement =
  document.querySelector(
    "#cra-copy-proposals"
  );


const selectedCountElement =
  document.querySelector(
    "#cra-selected-count"
  );

const selectVisibleElement =
  document.querySelector(
    "#cra-select-visible"
  );

const clearSelectedElement =
  document.querySelector(
    "#cra-clear-selected"
  );

const approveSelectedElement =
  document.querySelector(
    "#cra-approve-selected"
  );

const rejectSelectedElement =
  document.querySelector(
    "#cra-reject-selected"
  );

const resetSelectedElement =
  document.querySelector(
    "#cra-reset-selected"
  );

function escapeHtml(
  value
) {
  return String(
    value ??
    ""
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

function readStoredToken() {
  try {
    return (
      sessionStorage.getItem(
        "clarityCandidateReviewToken"
      ) ??
      ""
    );
  } catch {
    return "";
  }
}

function storeToken(
  token
) {
  try {
    if (token) {
      sessionStorage.setItem(
        "clarityCandidateReviewToken",
        token
      );
    } else {
      sessionStorage.removeItem(
        "clarityCandidateReviewToken"
      );
    }
  } catch {
    // Session storage may be unavailable.
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

async function requestReview(
  {
    method = "GET",
    body = null,
    path =
      "/api/v1/admin/candidates/bankr/reviews"
  } = {}
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      20_000
    );

  try {
    const response =
      await fetch(
        path,
        {
          method,

          headers: {
            Accept:
              "application/json",

            Authorization:
              `Bearer ${state.token}`,

            ...(body
              ? {
                  "Content-Type":
                    "application/json"
                }
              : {})
          },

          body:
            body
              ? JSON.stringify(
                  body
                )
              : null,

          signal:
            controller.signal
        }
      );

    let payload;

    try {
      payload =
        await response.json();
    } catch {
      throw new Error(
        "Clarity returned invalid JSON."
      );
    }

    if (!response.ok) {
      throw new Error(
        payload?.error?.message ??
        `Request failed with status ${response.status}.`
      );
    }

    return payload;
  } catch (error) {
    if (
      error?.name ===
        "AbortError"
    ) {
      throw new Error(
        "Candidate review request timed out."
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout
    );
  }
}

function getItemStatus(
  item
) {
  return (
    item.decision
      ?.status ??
    "pending"
  );
}

function getSearchText(
  item
) {
  return [
    item.candidateName,
    item.bankrSlug,
    item.githubOwner,
    item.githubRepository,
    item.repositoryUrl,
    item.candidateDescription,
    item.source,
    item.evidence?.relationship,
    item.evidence?.role,
    ...(
      item.evidence?.matchedBy ??
      []
    ),
    ...(
      item.evidence?.queries ??
      []
    ),
    ...(
      item.evidence?.reasons ??
      []
    )
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getVisibleItems() {
  if (!state.view) {
    return [];
  }

  const query =
    searchElement
      .value
      .trim()
      .toLowerCase();

  const filter =
    filterElement.value;

  return state
    .view
    .items
    .filter(
      (item) => {
        const status =
          getItemStatus(
            item
          );

        const matchesFilter =
          filter === "all" ||
          status === filter ||
          (
            filter === "probable" &&
            item.evidence
              ?.probable === true
          );

        return (
          matchesFilter &&
          (
            !query ||
            getSearchText(
              item
            ).includes(
              query
            )
          )
        );
      }
    );
}

function updateBulkControls(
  visibleItems =
    getVisibleItems()
) {
  const selectedCount =
    state.selectedKeys.size;

  const visibleKeys =
    visibleItems.map(
      (item) =>
        item.key
    );

  const allVisibleSelected =
    visibleKeys.length > 0 &&
    visibleKeys.every(
      (key) =>
        state.selectedKeys.has(
          key
        )
    );

  selectedCountElement.textContent =
    `${selectedCount} SELECTED`;

  selectVisibleElement.disabled =
    state.batchBusy ||
    visibleKeys.length === 0 ||
    allVisibleSelected;

  clearSelectedElement.disabled =
    state.batchBusy ||
    selectedCount === 0;

  approveSelectedElement.disabled =
    state.batchBusy ||
    selectedCount === 0;

  rejectSelectedElement.disabled =
    state.batchBusy ||
    selectedCount === 0;

  resetSelectedElement.disabled =
    state.batchBusy ||
    selectedCount === 0;
}

function renderEvidence(
  item
) {
  const evidence =
    item.evidence ??
    {};

  const values =
    [
      evidence.relationship,
      evidence.confidence
        ? `${evidence.confidence} confidence`
        : null,
      evidence.role,
      Number.isFinite(
        evidence.score
      )
        ? `score ${evidence.score}`
        : null,
      evidence.probable ===
        true
        ? "probable"
        : null,
      ...(
        evidence.matchedBy ??
        []
      ).map(
        (source) =>
          `matched ${source}`
      ),
      item.source
    ]
      .filter(Boolean);

  return values
    .map(
      (value) => `
        <span>
          ${escapeHtml(value)}
        </span>
      `
    )
    .join("");
}

function renderReviewItem(
  item
) {
  const status =
    getItemStatus(
      item
    );

  const repositoryUrl =
    safeUrl(
      item.repositoryUrl
    );

  const busy =
    state.batchBusy ||
    state.busyKey ===
      item.key;

  const selected =
    state.selectedKeys.has(
      item.key
    );

  const note =
    item.decision
      ?.note ??
    "";

  const label =
    status === "approved"
      ? "APPROVED"
      : status === "rejected"
        ? "REJECTED"
        : "PENDING";

  return `
    <article
      class="cr-card cra-card"
      data-key="${escapeHtml(item.key)}"
    >
      <div class="cr-card-head">
        <label class="cra-select">
          <input
            type="checkbox"
            data-select-key="${escapeHtml(item.key)}"
            ${selected ? "checked" : ""}
            ${busy ? "disabled" : ""}
          >

          <span>
            SELECT
          </span>
        </label>

        <div class="cra-card-heading">
          <span class="cr-label cra-label-${escapeHtml(status)}">
            ${label}
          </span>

          <h2>
            ${escapeHtml(item.candidateName)}
          </h2>

          <p>
            /${escapeHtml(item.bankrSlug)}
          </p>
        </div>

        ${
          Number.isFinite(
            item.evidence?.score
          )
            ? `
              <strong class="cr-score">
                ${escapeHtml(item.evidence.score)}
              </strong>
            `
            : ""
        }
      </div>

      <div class="cr-owner-repository">
        ${
          repositoryUrl
            ? `
              <a
                href="${escapeHtml(repositoryUrl)}"
                target="_blank"
                rel="noreferrer"
              >
                ${escapeHtml(item.githubOwner)}/${escapeHtml(item.githubRepository)}
              </a>
            `
            : `
              <strong>
                ${escapeHtml(item.githubOwner)}/${escapeHtml(item.githubRepository)}
              </strong>
            `
        }

        <span>
          ${escapeHtml(item.suggestedScope)}
        </span>
      </div>

      <div class="cr-repo-meta">
        ${renderEvidence(item)}
      </div>

      ${
        item.candidateDescription
          ? `
            <p class="cr-description">
              ${escapeHtml(item.candidateDescription)}
            </p>
          `
          : ""
      }

      <ul class="cr-reasons">
        ${
          [
            ...(
              item.evidence?.reasons ??
              []
            ),

            ...(
              item.evidence?.queries ??
              []
            ).map(
              (query) =>
                `SEARCH QUERY: ${query}`
            )
          ]
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

      <label class="cra-note">
        <span>REVIEW NOTE</span>

        <textarea
          data-note-key="${escapeHtml(item.key)}"
          maxlength="500"
          placeholder="Optional verification note"
          ${busy ? "disabled" : ""}
        >${escapeHtml(note)}</textarea>
      </label>

      <div class="cra-actions">
        <button
          type="button"
          data-action="approve"
          data-key="${escapeHtml(item.key)}"
          ${busy ? "disabled" : ""}
        >
          APPROVE
        </button>

        <button
          type="button"
          data-action="reject"
          data-key="${escapeHtml(item.key)}"
          class="cra-reject"
          ${busy ? "disabled" : ""}
        >
          REJECT
        </button>

        <button
          type="button"
          data-action="reset"
          data-key="${escapeHtml(item.key)}"
          class="cra-secondary"
          ${busy || status === "pending" ? "disabled" : ""}
        >
          RESET
        </button>
      </div>
    </article>
  `;
}

function render() {
  if (!state.view) {
    return;
  }

  const currentKeys =
    new Set(
      state.view.items.map(
        (item) =>
          item.key
      )
    );

  for (
    const key
    of state.selectedKeys
  ) {
    if (
      !currentKeys.has(
        key
      )
    ) {
      state.selectedKeys.delete(
        key
      );
    }
  }

  const items =
    getVisibleItems();

  summaryElement.innerHTML =
    [
      createSummaryCard(
        "TOTAL",
        state.view.counts.total
      ),

      createSummaryCard(
        "PENDING",
        state.view.counts.pending
      ),

      createSummaryCard(
        "APPROVED",
        state.view.counts.approved
      ),

      createSummaryCard(
        "REJECTED",
        state.view.counts.rejected
      ),

      createSummaryCard(
        "STALE",
        state.view.counts.staleDecisions
      ),

      createSummaryCard(
        "PROPOSALS",
        state.view.proposals.length
      )
    ].join("");

  proposalCountElement.textContent =
    String(
      state.view.proposals.length
    );

  copyProposalsElement.disabled =
    !state.view.proposals.some(
      (proposal) =>
        proposal.eligible
    );

  updateBulkControls(
    items
  );

  resultsElement.innerHTML =
    items.length > 0
      ? items
          .map(
            renderReviewItem
          )
          .join("")
      : `
          <div class="cr-empty">
            NO MATCHING REVIEW ITEMS
          </div>
        `;
}

async function loadReviewQueue() {
  const token =
    tokenElement
      .value
      .trim();

  if (!token) {
    statusElement.textContent =
      "TOKEN REQUIRED";

    return;
  }

  state.token =
    token;

  storeToken(
    token
  );

  loadElement.disabled =
    true;

  statusElement.textContent =
    "LOADING REVIEW QUEUE…";

  try {
    state.view =
      await requestReview();

    state.selectedKeys.clear();

    statusElement.textContent =
      `LOADED ${state.view.counts.total} REPOSITORIES`;

    render();
  } catch (error) {
    state.view =
      null;

    summaryElement.innerHTML =
      "";

    resultsElement.innerHTML = `
      <div class="cr-error">
        <strong>
          REVIEW QUEUE COULD NOT BE LOADED
        </strong>

        <p>
          ${escapeHtml(error.message)}
        </p>
      </div>
    `;

    statusElement.textContent =
      "AUTHENTICATION OR API ERROR";
  } finally {
    loadElement.disabled =
      false;
  }
}

async function submitDecision(
  key,
  action
) {
  const item =
    state.view
      ?.items
      .find(
        (candidate) =>
          candidate.key === key
      );

  if (!item) {
    return;
  }

  const noteElement =
    document.querySelector(
      `[data-note-key="${CSS.escape(key)}"]`
    );

  state.busyKey =
    key;

  statusElement.textContent =
    `${action.toUpperCase()} IN PROGRESS…`;

  render();

  try {
    state.view =
      await requestReview(
        {
          method:
            "POST",

          body: {
            bankrProfileId:
              item.bankrProfileId,

            repositoryUrl:
              item.repositoryUrl,

            decision:
              action,

            note:
              noteElement
                ?.value
                ?.trim() ||
              null
          }
        }
      );

    statusElement.textContent =
      `${action.toUpperCase()} SAVED`;
  } catch (error) {
    statusElement.textContent =
      error.message;
  } finally {
    state.busyKey =
      null;

    render();
  }
}

async function submitBatchDecision(
  action
) {
  if (
    !state.view ||
    state.selectedKeys.size === 0
  ) {
    return;
  }

  const items =
    state.view.items.filter(
      (item) =>
        state.selectedKeys.has(
          item.key
        )
    );

  if (
    items.length === 0
  ) {
    return;
  }

  const reviews =
    items.map(
      (item) => {
        const noteElement =
          document.querySelector(
            `[data-note-key="${CSS.escape(item.key)}"]`
          );

        return {
          bankrProfileId:
            item.bankrProfileId,

          repositoryUrl:
            item.repositoryUrl,

          decision:
            action,

          note:
            action === "reset"
              ? null
              : noteElement
                  ?.value
                  ?.trim() ||
                item.decision
                  ?.note ||
                null
        };
      }
    );

  state.batchBusy =
    true;

  statusElement.textContent =
    `${action.toUpperCase()} ${reviews.length} SELECTED…`;

  render();

  try {
    state.view =
      await requestReview(
        {
          method:
            "POST",

          path:
            "/api/v1/admin/candidates/bankr/reviews/batch",

          body: {
            reviews
          }
        }
      );

    state.selectedKeys.clear();

    statusElement.textContent =
      `${action.toUpperCase()} SAVED FOR ${reviews.length} REPOSITORIES`;
  } catch (error) {
    statusElement.textContent =
      error.message;
  } finally {
    state.batchBusy =
      false;

    render();
  }
}

loadElement.addEventListener(
  "click",
  () => {
    void loadReviewQueue();
  }
);

forgetElement.addEventListener(
  "click",
  () => {
    state.token =
      "";

    state.view =
      null;

    state.selectedKeys.clear();

    tokenElement.value =
      "";

    storeToken(
      ""
    );

    summaryElement.innerHTML =
      "";

    resultsElement.innerHTML = `
      <div class="cr-empty">
        TOKEN REMOVED FROM THIS TAB
      </div>
    `;

    statusElement.textContent =
      "TOKEN REQUIRED";
  }
);

searchElement.addEventListener(
  "input",
  render
);

filterElement.addEventListener(
  "change",
  render
);

resultsElement.addEventListener(
  "change",
  (event) => {
    const target =
      event.target.closest(
        "[data-select-key]"
      );

    if (!target) {
      return;
    }

    const key =
      target.dataset.selectKey;

    if (
      target.checked
    ) {
      state.selectedKeys.add(
        key
      );
    } else {
      state.selectedKeys.delete(
        key
      );
    }

    updateBulkControls();
  }
);

resultsElement.addEventListener(
  "click",
  (event) => {
    const target =
      event.target.closest(
        "[data-action][data-key]"
      );

    if (!target) {
      return;
    }

    void submitDecision(
      target.dataset.key,
      target.dataset.action
    );
  }
);

selectVisibleElement.addEventListener(
  "click",
  () => {
    for (
      const item
      of getVisibleItems()
    ) {
      state.selectedKeys.add(
        item.key
      );
    }

    for (
      const checkbox
      of resultsElement.querySelectorAll(
        "[data-select-key]"
      )
    ) {
      checkbox.checked =
        true;
    }

    updateBulkControls();
  }
);

clearSelectedElement.addEventListener(
  "click",
  () => {
    state.selectedKeys.clear();

    for (
      const checkbox
      of resultsElement.querySelectorAll(
        "[data-select-key]"
      )
    ) {
      checkbox.checked =
        false;
    }

    updateBulkControls();
  }
);

approveSelectedElement.addEventListener(
  "click",
  () => {
    void submitBatchDecision(
      "approve"
    );
  }
);

rejectSelectedElement.addEventListener(
  "click",
  () => {
    void submitBatchDecision(
      "reject"
    );
  }
);

resetSelectedElement.addEventListener(
  "click",
  () => {
    void submitBatchDecision(
      "reset"
    );
  }
);

copyProposalsElement.addEventListener(
  "click",
  async () => {
    const proposals =
      state.view
        ?.proposals
        .filter(
          (proposal) =>
            proposal.eligible
        ) ??
      [];

    try {
      await navigator
        .clipboard
        .writeText(
          JSON.stringify(
            proposals,
            null,
            2
          )
        );

      statusElement.textContent =
        `COPIED ${proposals.length} ELIGIBLE PROPOSALS`;
    } catch {
      statusElement.textContent =
        "CLIPBOARD ACCESS FAILED";
    }
  }
);

tokenElement.value =
  readStoredToken();

if (
  tokenElement.value
) {
  void loadReviewQueue();
}

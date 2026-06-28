# Clarity
**Intelligence for the AI agent economy.**

Clarity is an open-source intelligence and evaluation backend for AI agents and agent-related projects.

It collects verifiable public data, evaluates engineering activity, measures evidence confidence, discovers related repositories, and exposes structured results through a public HTTP API.

Clarity is developed by **Clarity Labs**.

## Production API

- API: `https://clarity-agent-production.up.railway.app`
- Health: `https://clarity-agent-production.up.railway.app/health`
- OpenAPI: `https://clarity-agent-production.up.railway.app/openapi.json`

## What Clarity does

Clarity currently provides:

- deterministic GitHub-based project scoring;
- automatic repository discovery;
- evidence confidence scoring;
- project evaluation;
- agent comparison;
- public rankings;
- search across registered agents and aliases;
- persistent evaluation snapshots;
- scheduled production refreshes;
- Bankr profile discovery and candidate normalization;
- structured JSON API responses;
- OpenAPI documentation.

Clarity does not use an LLM to generate the core score. The same input data produces the same result.

## Core principles

### Verifiable data

Scores should be based on inspectable public evidence rather than project claims alone.

### Reproducible scoring

The scoring system is deterministic and testable.

### Evidence before ranking

A repository can have strong metrics without being clearly connected to the project being evaluated. Clarity therefore separates project performance from evidence confidence.

### Review before registration

Discovery sources such as Bankr create candidates. They do not automatically promote projects into the trusted registry.

## Current architecture

```text
Registered agents
        |
        v
GitHub discovery
        |
        v
Related repository classification
        |
        v
Project metrics
        |
        +------------------+
        |                  |
        v                  v
GitHub Score        Evidence Confidence
        |                  |
        +--------+---------+
                 |
                 v
          Agent Evaluation
                 |
        +--------+---------+
        |                  |
        v                  v
     Ranking            Compare
        |
        v
Persistent snapshots and public API
````

Candidate discovery follows a separate review-first pipeline:

```text
External source
      |
      v
Discovered profile
      |
      v
Normalized candidate
      |
      v
Conflict and evidence checks
      |
      v
Manual or reviewed verification
      |
      v
Trusted registry
```

## Registered agents

The current trusted registry includes:

| Agent   | GitHub repository                 | Repository scope |
| ------- | --------------------------------- | ---------------- |
| Aeon    | `aaronjmars/aeon`                 | Primary          |
| PRXVT   | `PRXVT/sdk`                       | Component        |
| Gitlawb | `Gitlawb/openclaude`              | Primary          |
| Ethy    | `EthyAI/agent-intelligence-arena` | Primary          |

The registry is intentionally small and manually verified.

## API endpoints

| Method | Endpoint                       | Description                      |
| ------ | ------------------------------ | -------------------------------- |
| `GET`  | `/health`                      | Service health                   |
| `GET`  | `/openapi.json`                | OpenAPI specification            |
| `GET`  | `/api/v1/agents`               | Registered agents                |
| `GET`  | `/api/v1/search?q=`            | Search agents and aliases        |
| `GET`  | `/api/v1/evaluate/:agent`      | Evaluate one registered agent    |
| `GET`  | `/api/v1/ranking`              | Current eligible ranking         |
| `GET`  | `/api/v1/compare/:left/:right` | Compare two agents               |
| `POST` | `/api/v1/admin/refresh`        | Refresh all production snapshots |

### Example requests

```bash
curl \
  "https://clarity-agent-production.up.railway.app/api/v1/agents"
```

```bash
curl \
  "https://clarity-agent-production.up.railway.app/api/v1/evaluate/aeon"
```

```bash
curl \
  "https://clarity-agent-production.up.railway.app/api/v1/compare/aeon/gitlawb"
```

```bash
curl \
  "https://clarity-agent-production.up.railway.app/api/v1/ranking"
```

## Local development

### Requirements

* Node.js 24
* npm 11
* a GitHub token is recommended for higher GitHub API limits

### Install

```bash
git clone https://github.com/jsnrdtz/clarity-agent.git
cd clarity-agent
npm install
```

### Verify the project

```bash
npm run typecheck
npm test
npm run build
```

### Start the API

```bash
PORT=3000 npm run api
```

Then verify it:

```bash
curl http://localhost:3000/health
```

## Environment variables

The application reads its configuration from environment variables.

`.env.example` contains the supported variables and safe placeholder values. Never commit real secrets.

| Variable                              |               Required | Description                                        |
| ------------------------------------- | ---------------------: | -------------------------------------------------- |
| `GITHUB_TOKEN`                        |            Recommended | GitHub API token used to increase request limits   |
| `CLARITY_REFRESH_TOKEN`               | Production admin route | Bearer token protecting production refresh         |
| `CLARITY_TRUST_PROXY`                 |                     No | Trust reverse-proxy client IP headers              |
| `CLARITY_SNAPSHOT_DIR`                |                     No | Evaluation snapshot directory                      |
| `CLARITY_RANKING_SNAPSHOT_MAX_AGE_MS` |                     No | Maximum snapshot age used by ranking and compare   |
| `CLARITY_REFRESH_LOCK_PATH`           |                     No | Refresh lock file path                             |
| `CLARITY_REFRESH_LOCK_STALE_MS`       |                     No | Age after which an abandoned refresh lock is stale |

### `GITHUB_TOKEN`

A token is not committed to the repository.

Set it in the current shell:

```bash
export GITHUB_TOKEN="your-token"
```

### `CLARITY_REFRESH_TOKEN`

Protects:

```text
POST /api/v1/admin/refresh
```

The configured token must contain at least 32 characters.

Example request:

```bash
curl \
  --request POST \
  --header "Authorization: Bearer ${CLARITY_REFRESH_TOKEN}" \
  "http://localhost:3000/api/v1/admin/refresh"
```

Never commit the real token.

### `CLARITY_TRUST_PROXY`

Controls whether Clarity trusts proxy headers when creating per-client rate-limit buckets.

Keep it disabled when the Node.js process is exposed directly:

```bash
export CLARITY_TRUST_PROXY=false
```

Enable it only behind a trusted reverse proxy such as Railway:

```bash
export CLARITY_TRUST_PROXY=true
```

When enabled, Clarity prefers `X-Real-IP` and falls back to the first address in `X-Forwarded-For`.

## Available npm scripts

| Script                       | Purpose                                        |
| ---------------------------- | ---------------------------------------------- |
| `npm run dev`                | Run the TypeScript CLI                         |
| `npm run api`                | Run the TypeScript API server                  |
| `npm run typecheck`          | Run strict TypeScript checks                   |
| `npm test`                   | Run the complete test suite                    |
| `npm run build`              | Build production JavaScript into `dist`        |
| `npm run refresh`            | Refresh all registered agent snapshots locally |
| `npm start`                  | Run the compiled API server                    |
| `npm run start:cli`          | Run the compiled CLI                           |
| `npm run refresh:production` | Run the compiled refresh command               |

## GitHub Score

The GitHub Score measures observable engineering activity.

| Component     | Overall weight |
| ------------- | -------------: |
| Activity      |            40% |
| Collaboration |            20% |
| Adoption      |            25% |
| Releases      |            15% |

### Activity

Activity uses commit volume with a logarithmic target of approximately 30 commits.

### Collaboration

Collaboration uses deduplicated contributor activity with a logarithmic target of approximately 20 contributors.

### Adoption

Adoption combines:

* stars: 70%, with a target of approximately 10,000;
* forks: 30%, with a target of approximately 2,000.

### Releases

Release scoring combines:

* release frequency: 60%, targeting approximately four releases per 90 days;
* release recency: 40%, declining over approximately 180 days.

### Related repositories

The selected anchor repository is counted fully.

Additional repositories classified as core are counted with reduced weight and strict caps. Ecosystem and unrelated repositories do not inflate the core project score.

### Coverage penalty

GitHub pagination is intentionally capped. When important collections reach their configured cap, Clarity records incomplete coverage and applies a score penalty.

## Evidence confidence

GitHub Score and evidence confidence are separate.

Evidence confidence estimates how strongly the discovered public data is connected to the agent being evaluated.

Signals include:

* whether the repository is primary or only a component;
* dedicated brand ownership;
* related core repositories;
* README evidence;
* repository relation confidence;
* public project metadata;
* freshness;
* unresolved review items.

Evidence levels:

| Level  |        Score |
| ------ | -----------: |
| High   | 75 or higher |
| Medium |        45–74 |
| Low    |     Below 45 |

Projects with insufficient evidence may be evaluated but excluded from the public ranking.

## Repository discovery

Clarity starts from an anchor repository and analyzes other repositories associated with its owner.

Repositories can be classified as:

* `anchor`;
* `core`;
* `ecosystem`;
* `review`;
* `unrelated`;
* `profile`.

The discovery system uses observable evidence rather than repository name similarity alone.

## Snapshots

Successful evaluations are written to filesystem snapshots.

Default directory:

```text
data/snapshots
```

Snapshot writes are atomic:

1. write a temporary file;
2. rename it to the final path.

Evaluation delivery metadata records:

* data source;
* stale status;
* snapshot save time;
* live upstream error, when applicable.

When live GitHub data is temporarily unavailable, Clarity can return a previously saved snapshot instead of failing completely.

Ranking and comparison only use snapshots within the configured freshness window.

## Production refresh

Production snapshots are refreshed through:

```text
POST /api/v1/admin/refresh
```

The route:

* requires bearer authentication;
* refreshes the current registry dynamically;
* continues when one agent fails;
* returns a structured report;
* prevents concurrent refresh jobs;
* releases its lock even after failure.

The refresh lock is created atomically and supports stale-lock recovery.

A GitHub Actions workflow currently calls the protected production endpoint every six hours.

## Rate limiting

Expensive public endpoints use per-client fixed-window rate limits.

| Endpoint |                      Limit |
| -------- | -------------------------: |
| Evaluate | 10 requests per 10 minutes |
| Compare  | 30 requests per 10 minutes |
| Ranking  | 60 requests per 10 minutes |

Responses expose:

* `X-RateLimit-Limit`;
* `X-RateLimit-Remaining`;
* `X-RateLimit-Reset`;
* `Retry-After` when the limit is exceeded.

The current limiter is in-memory and process-local. A distributed store such as Redis will be required before horizontally scaling the API across multiple instances.

## Bankr integration

Bankr is treated as a discovery source, not as an authority.

The integration currently supports:

* retrieving approved Bankr profiles;
* pagination;
* detailed profile retrieval by slug;
* Zod validation;
* timeout and upstream error handling;
* token address normalization;
* candidate normalization;
* GitHub URL extraction;
* duplicate profile detection;
* shared token identity detection;
* review warnings.

A Bankr profile ID identifies the Bankr profile.

A token identity is represented as:

```text
chainId:tokenAddress
```

Multiple Bankr profiles may reference the same token. Clarity therefore does not use token identity as the unique project identifier.

Bankr candidates are not automatically added to the trusted registry.

## Errors

API errors use a stable JSON structure:

```json
{
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent \"example\" is not registered.",
    "retryable": false
  }
}
```

Errors may also contain structured `details`.

## Docker

Build the image:

```bash
docker build -t clarity-agent .
```

Run it:

```bash
docker run \
  --rm \
  --publish 3000:3000 \
  --env GITHUB_TOKEN \
  clarity-agent
```

The production container:

* uses Node.js 24;
* runs as a non-root user by default;
* includes a health check;
* supports graceful shutdown;
* runs compiled JavaScript directly.

## Deployment

The current production deployment uses Railway.

Persistent application data is mounted at:

```text
/app/data
```

Production configuration includes:

* GitHub API credentials;
* protected refresh credentials;
* trusted reverse-proxy handling;
* persistent snapshots;
* persistent refresh locking.

## Continuous integration

Every push to the main branch verifies:

* dependency installation;
* strict TypeScript checks;
* all tests;
* production build;
* Docker image build;
* container startup;
* API health;
* public endpoint behavior;
* graceful shutdown.

## Current limitations

Clarity is currently a backend-first MVP.

Not yet implemented:

* public frontend;
* user accounts;
* database-backed registry;
* review interface;
* automatic candidate promotion;
* distributed rate limiting;
* social activity scoring;
* onchain holder analysis;
* liquidity analysis;
* contract ownership verification;
* MCP server;
* OpenClaw integration;
* LLM-generated explanations.

GitHub remains the strongest implemented evaluation source. A low score may indicate limited public evidence rather than a low-quality project.

## Roadmap

Near-term priorities:

1. finish the review-first Bankr candidate importer;
2. classify GitHub repository relationship confidence;
3. persist candidate reports;
4. add a review queue;
5. safely promote verified candidates into the registry;
6. expand the trusted agent registry;
7. build the public ranking and agent profile frontend;
8. add additional product, economic, social, and onchain signals;
9. expose Clarity through MCP and agent integrations.

## License

MIT
EOF
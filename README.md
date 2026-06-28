cd ~/Desktop/clarity-agent

pbpaste > README.md

## Environment variables

The API reads configuration from environment variables. Copy `.env.example` when running it locally.

`CLARITY_TRUST_PROXY` controls whether the API trusts `X-Forwarded-For` and `X-Real-IP` when creating per-client rate-limit buckets.

- Keep it `false` when the Node server is exposed directly.
- Set it to `true` only behind a trusted reverse proxy such as Railway.

The protected administrative refresh route uses `CLARITY_REFRESH_TOKEN`. Never commit the real token.

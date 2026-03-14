# ChapterFlow SiliconX Setup

This repo is the standalone SiliconX copy of ChapterFlow.

## Domains
- `siliconx.ca` for the product home
- `chapterflow.siliconx.ca` for the app host
- `auth.siliconx.ca` for the auth shell
- `login.siliconx.ca` for Cognito Hosted UI if you use a custom domain

## App Runner
Use a dedicated App Runner service for this repo.

Attach these custom domains to that service:
- `siliconx.ca`
- `chapterflow.siliconx.ca`
- `auth.siliconx.ca`

## Cognito
Use the SiliconX Cognito setup for this repo.

Recommended callback URL:
- `https://siliconx.ca/auth/callback`

Optional callback URL:
- `https://auth.siliconx.ca/auth/callback`

Recommended logout URL:
- `https://siliconx.ca/`

Optional logout URL:
- `https://auth.siliconx.ca/`

Do not use `auth.siliconx.ca` as the Cognito Hosted UI domain. Use a separate domain such as `login.siliconx.ca`.

## Required runtime env
```text
CHAPTERFLOW_DEPLOYMENT_MODE=standalone
NEXT_PUBLIC_CHAPTERFLOW_SITE_URL=https://siliconx.ca
NEXT_PUBLIC_CHAPTERFLOW_APP_URL=https://chapterflow.siliconx.ca
NEXT_PUBLIC_CHAPTERFLOW_AUTH_URL=https://auth.siliconx.ca
CHAPTERFLOW_SITE_BASE_URL=https://siliconx.ca
CHAPTERFLOW_APP_BASE_URL=https://chapterflow.siliconx.ca
CHAPTERFLOW_AUTH_BASE_URL=https://auth.siliconx.ca
AUTH_COOKIE_DOMAIN=.siliconx.ca
CHAPTERFLOW_COOKIE_DOMAIN=.siliconx.ca
COGNITO_DOMAIN=https://login.siliconx.ca
COGNITO_CUSTOM_DOMAIN=https://login.siliconx.ca
COGNITO_REDIRECT_URI=https://siliconx.ca/auth/callback
COGNITO_LOGOUT_REDIRECT_URI=https://siliconx.ca/
```

## Local development
```bash
npm install
npm run dev
```

Open:
- `http://localhost:3000`

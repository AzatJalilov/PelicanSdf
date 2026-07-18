# Deploy: pelican.vibe-overflow.com

The public bundle is built into an ARM64 Caddy image and deployed beside the
existing Vibe Overflow stack. The public repository never contains deployment
credentials: GitHub Actions supplies them at runtime and the registry token is
short-lived.

## GitHub configuration

Configure these Actions secrets in the PelicanSdf repository:

- `DEPLOY_HOST` — production SSH hostname
- `DEPLOY_USER` — restricted Docker deployment user
- `DEPLOY_SSH_KEY` — dedicated private SSH key

Pushes to `main` run repository tests, scan the repository and generated public
bundle for secrets, publish SHA-tagged images, and deploy automatically.

## Server layout

The Compose file lives in `/opt/vibe-overflow/pelican-sdf`. The container joins
the external `vibe-overflow-edge` network and publishes no host ports; the main
Vibe Overflow Caddy instance is the only TLS entrypoint.

## Rollback

Set `IMAGE_TAG` in `/opt/vibe-overflow/pelican-sdf/.env` to a previously
published short commit SHA, authenticate to GHCR with a short-lived token, and
run `docker compose pull && docker compose up -d`. Never store a registry token
in `.env` or the Compose file.

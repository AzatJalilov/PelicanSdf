# syntax=docker/dockerfile:1.7
FROM caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648

LABEL org.opencontainers.image.source="https://github.com/AzatJalilov/PelicanSdf"
LABEL org.opencontainers.image.description="Pelican SDF public benchmark website"

RUN setcap -r /usr/bin/caddy
COPY dist/ /srv/
COPY deploy/Caddyfile /etc/caddy/Caddyfile

USER 1000:1000
EXPOSE 8080

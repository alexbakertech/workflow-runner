# syntax=docker/dockerfile:1

# Debian (glibc) rather than Alpine: the Claude Agent SDK and Codex ship prebuilt glibc binaries.

# ---- Build ----
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT_STANDALONE=1
RUN npm run build

# ---- Run ----
FROM node:24-slim AS run
WORKDIR /app

# Agent CLIs, pinned. Bump deliberately; auto-updates are off below.
ARG CODEX_VERSION=0.163.0
ARG PI_VERSION=1.2.0
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git wget \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g --no-fund --no-audit @openai/codex@${CODEX_VERSION} @earendil-works/pi-coding-agent@${PI_VERSION} \
 && npm cache clean --force

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    HOME=/home/node \
    CODEX_HOME=/home/node/.codex \
    DISABLE_AUTOUPDATER=1 \
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1

# Standalone server plus the static assets it doesn't copy itself.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
# Read at runtime via fs, so file tracing can't pick it up.
COPY --from=build --chown=node:node /app/templates ./templates
COPY --from=build --chown=node:node /app/samples ./samples
# The Agent SDK spawns a platform-specific Claude Code binary that file tracing doesn't follow.
COPY --from=build --chown=node:node /app/node_modules/@anthropic-ai ./node_modules/@anthropic-ai

# `claude` on PATH (the SDK's bundled binary) for `claude auth login` / `claude auth status` if ever needed.
RUN set -e; bin=$(ls -d /app/node_modules/@anthropic-ai/claude-agent-sdk-linux-*/claude 2>/dev/null | grep -v musl | head -n1); \
    [ -n "$bin" ] && ln -s "$bin" /usr/local/bin/claude; \
    mkdir -p /app/data /home/node/.codex /home/node/.claude /home/node/.pi/agent; \
    chown -R node:node /app/data /home/node

# Runs and uploaded workflows live in /app/data; sign-ins live under /home/node (see docker-compose.yml).
VOLUME ["/app/data"]

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1
CMD ["node", "server.js"]

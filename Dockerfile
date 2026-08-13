ARG  NODE_VERSION=22
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

# Enable Corepack and install pnpm (Corepack reads packageManager from package.json)
RUN corepack enable && \
    corepack prepare pnpm@11.4.0 --activate && \
    pnpm --version

# Copy package manifests -- the workspace packages' manifests must be present
# for pnpm to resolve the workspace:* dependencies under --frozen-lockfile.
# Scripts are skipped here because the packages' prepare (tsc) builds need
# their sources, which are only copied in the next layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/converter/package.json ./packages/converter/
COPY packages/agent-core/package.json ./packages/agent-core/
COPY packages/chat-ui/package.json ./packages/chat-ui/

# Install dependencies (cached while manifests are unchanged)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build the workspace packages (their prepare scripts), then the app
RUN pnpm -r run prepare && pnpm run build

#FROM nginxinc/nginx-unprivileged:stable-alpine
#COPY --from=builder /app/dist /usr/share/nginx/html

FROM joseluisq/static-web-server:2.42.0
COPY --from=builder /app/dist /public

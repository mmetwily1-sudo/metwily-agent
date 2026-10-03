FROM node:23-slim
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY packages ./packages
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate && pnpm install || npm install
CMD ["node", "packages/cli/src/index.ts"]

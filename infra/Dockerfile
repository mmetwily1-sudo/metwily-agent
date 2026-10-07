# متولي — حاوية النشر: بناء binary السيرفر ثم تشغيله في distroless.
# البناء: docker build -f infra/Dockerfile .   (يحتاج Docker daemon — غير متاح محلياً، يُبنى في CI/Fly)
FROM node:23-slim AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY packages ./packages
RUN corepack enable \
  && pnpm install --frozen-lockfile \
  && npm install --global bun \
  && bun build packages/server/src/serve.ts --compile --target=bun-linux-x64 --outfile /app/metwily-server

FROM gcr.io/distroless/base-debian12
COPY --from=build /app/metwily-server /metwily-server
COPY --from=build /app/packages/web /packages/web
ENV PORT=3000 HOST=0.0.0.0 METWILY_WEB_DIR=/packages/web
EXPOSE 3000
CMD ["/metwily-server"]

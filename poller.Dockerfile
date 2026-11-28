# The poller's image: one published version of kodor, installed from
# npm, and nothing else. The release workflow builds it with VERSION set to
# the version it has just published, and pushes it to GitHub's container
# registry. It runs outside any checkout, so the `kodor` launcher runs
# the installed copy itself.
FROM node:22-slim
ARG VERSION
LABEL org.opencontainers.image.source="https://github.com/kodor-ai/kodor"
WORKDIR /app
RUN npm install --omit=dev --no-audit --no-fund --no-save \
      "@kodor-ai/kodor@${VERSION}"
USER node
CMD ["node", "node_modules/@kodor-ai/kodor/bin/kodor.js", "poller"]

# The poller's image: one published version of the factory, installed from
# npm, and nothing else. The release workflow builds it with VERSION set to
# the version it has just published, and pushes it to GitHub's container
# registry. It runs outside any checkout, so the `factory` launcher runs
# the installed copy itself.
FROM node:22-slim
ARG VERSION
LABEL org.opencontainers.image.source="https://github.com/davidbyoung/software-factory"
WORKDIR /app
RUN npm install --omit=dev --no-audit --no-fund --no-save \
      "@davidbyoung/software-factory@${VERSION}"
USER node
CMD ["node", "node_modules/@davidbyoung/software-factory/bin/factory.js", "poller"]

# The poller's image. It copies only the poller and the modules it imports:
# the shared work-status rules, the GitHub ticket adapter with its `fetch`
# transport, GitHub as the code host, and GitHub Actions as the runner, each
# with the interface it fills. No npm install and no build, so
# the repository's build variables are not needed here, and the `factory`
# launcher is not used. A test fails when the poller imports a file not
# copied below.
FROM node:22-slim
WORKDIR /app
COPY src/poller.mts src/poller.mts
COPY src/lib/work-status.mts src/lib/work-status.mts
COPY src/lib/gh.mts src/lib/gh.mts
COPY src/tickets/types.mts src/tickets/types.mts
COPY src/tickets/transport.mts src/tickets/transport.mts
COPY src/tickets/github.mts src/tickets/github.mts
COPY src/code-host/types.mts src/code-host/types.mts
COPY src/code-host/github.mts src/code-host/github.mts
COPY src/runner/types.mts src/runner/types.mts
COPY src/runner/github-actions.mts src/runner/github-actions.mts
USER node
CMD ["node", "src/poller.mts"]

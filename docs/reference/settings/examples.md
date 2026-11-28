# Example settings files

The skills, agents, and scripts these files name are examples. Yours would
have to exist in your repository for `factory config check` to pass.

## A web application with its own reviewers

An online store with a board, a skill of its own for building new API
endpoints, two reviewers of its own, and the factory's UI reviewer.
Changes to components, styles, docs, and tests merge unread, except
anything touching checkout or consent.

```yaml
# $schema: https://raw.githubusercontent.com/davidbyoung/software-factory/main/settings.schema.json
version: 2
repository: harbor-goods/storefront

tickets:
  board: 1
  columns:
    backlog: Backlog
    refining: In refinement
    ready: Ready
    building: In progress
    review: In review
    done: Done

code-host:
  type: github
  branch-name: "{ticket}"

builds:
  trigger: own-server

specs: openspec

commands:
  build-setup:
    - npx playwright install --with-deps chromium
  before-commit:
    - npm run -s format:check
    - npx tsc --noEmit
    - npm run -s lint
  gate:
    - npm run check
  test-one: npx vitest run $FILE -t "$NAME"

plugins:
  build:
    builders:
      - skill: add-endpoint
        labels:
          - new-endpoint
    reviewers:
      - agent: migration-reviewer
        files:
          - db/migrations/**
      - agent: accessibility-reviewer
        files:
          - src/components/**
      - agent: factory-ui-reviewer
        files:
          - src/components/**
          - src/styles/**

site:
  start: npm run build && npx serve out -p $PORT
  url: http://localhost:$PORT

auto-merge:
  allow:
    - docs/**
    - src/components/**
    - src/styles/**
    - public/**
    - tests/**
  deny:
    - src/components/checkout/**
    - src/components/consent/**
  commands:
    - node scripts/public-api-changed.mjs

pr-review: true
```

## A small website

A marketing site with a board and nothing else changed. Builds start when
someone asks a session, since `builds.trigger` defaults to `manual`.

```yaml
# $schema: https://raw.githubusercontent.com/davidbyoung/software-factory/main/settings.schema.json
version: 2
repository: riverbend-studio/site

tickets:
  board: 4
  columns:
    backlog: Backlog
    refining: In refinement
    ready: Ready
    building: In progress
    review: In review
    done: Done

code-host:
  type: github
  branch-name: "{ticket}"

commands:
  before-commit:
    - npm run lint
  gate:
    - npm run lint
    - npm run typecheck
    - npm test
```

## A project that isn't JavaScript

A PHP library. Its commands are Composer's and PHPUnit's, and a session in
the cloud copies the dependencies installed before it started, as its
`CLAUDE.md` says. Docs merge unread, and one reviewer of its own reads
changes to its public API.

```yaml
# $schema: https://raw.githubusercontent.com/davidbyoung/software-factory/main/settings.schema.json
version: 2
repository: northwind-php/ledger

tickets:
  board: 2
  columns:
    backlog: Backlog
    refining: In refinement
    ready: Ready
    building: In progress
    review: In review
    done: Done

code-host:
  type: github
  branch-name: "{ticket}"

builds:
  hosts:
    - repo.packagist.org

commands:
  build-setup:
    - composer install --no-interaction
  before-commit:
    - composer lint
  gate:
    - composer lint
    - composer analyse
    - composer test
  test-one: vendor/bin/phpunit $FILE ${NAME:+--filter "$NAME"}
  relock: composer update --lock

plugins:
  build:
    reviewers:
      - agent: api-compatibility-reviewer
        files:
          - src/**

auto-merge:
  allow:
    - docs/**
  deny:
    - docs/security/**
```

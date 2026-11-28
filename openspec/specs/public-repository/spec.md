# public-repository Specification

## Purpose

The Actions policy a public repository on GitHub needs before `.github/workflows/lunamill.yml` can run on `pull_request_target`: how `lunamill init` adds it and how `lunamill doctor` checks it.

## Requirements

### Requirement: Init adds the policy

lunamill SHALL behave as this line says: When `lunamill init` runs for a public repository on GitHub with no Actions policy that lets `.github/workflows/lunamill.yml` run on `pull_request_target`, its plan has the `policy` row, reading `Let .github/workflows/lunamill.yml run on pull_request_target, as the policy "lunamill"`, and after "Go ahead?" it adds the policy and prints `✓ Allowed pull_request_target for .github/workflows/lunamill.yml.`

#### Scenario: Init adds the policy

- **WHEN** `lunamill init` runs for a public repository on GitHub with no Actions policy that lets `.github/workflows/lunamill.yml` run on `pull_request_target`
- **THEN** its plan has the `policy` row, reading `Let .github/workflows/lunamill.yml run on pull_request_target, as the policy "lunamill"`, and after "Go ahead?" it adds the policy and prints `✓ Allowed pull_request_target for .github/workflows/lunamill.yml.`

### Requirement: A policy init cannot add

lunamill SHALL behave as this line says: When it cannot add the policy, "Left to do" gains `Let .github/workflows/lunamill.yml run on pull_request_target: your repository's Settings, Actions, Policies`.

#### Scenario: A policy init cannot add

- **WHEN** it cannot add the policy
- **THEN** "Left to do" gains `Let .github/workflows/lunamill.yml run on pull_request_target: your repository's Settings, Actions, Policies`.

### Requirement: Doctor's policy line

lunamill SHALL behave as this line says: When `lunamill doctor` runs for a public repository, it prints the ✓ line or the ✗ line with its fix, as shown there, or `? Could not tell whether pull_request_target is allowed: ` and the reason. For a private one it prints none.

#### Scenario: Doctor's policy line

- **WHEN** `lunamill doctor` runs for a public repository
- **THEN** it prints the ✓ line or the ✗ line with its fix, as shown there, or `? Could not tell whether pull_request_target is allowed: ` and the reason. For a private one it prints none.

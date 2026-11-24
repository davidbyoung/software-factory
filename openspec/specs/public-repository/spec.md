# public-repository Specification

## Purpose

The Actions policy a public repository on GitHub needs before `.github/workflows/factory.yml` can run on `pull_request_target`: how `factory init` adds it and how `factory doctor` checks it.

## Requirements

### Requirement: Init adds the policy

The factory SHALL behave as this line says: When `factory init` runs for a public repository on GitHub with no Actions policy that lets `.github/workflows/factory.yml` run on `pull_request_target`, its plan has the `policy` row, reading `Let .github/workflows/factory.yml run on pull_request_target, as the policy "Software factory"`, and after "Go ahead?" it adds the policy and prints `✓ Allowed pull_request_target for .github/workflows/factory.yml.`

#### Scenario: Init adds the policy

- **WHEN** `factory init` runs for a public repository on GitHub with no Actions policy that lets `.github/workflows/factory.yml` run on `pull_request_target`
- **THEN** its plan has the `policy` row, reading `Let .github/workflows/factory.yml run on pull_request_target, as the policy "Software factory"`, and after "Go ahead?" it adds the policy and prints `✓ Allowed pull_request_target for .github/workflows/factory.yml.`

### Requirement: A policy init cannot add

The factory SHALL behave as this line says: When it cannot add the policy, "Left to do" gains `Let .github/workflows/factory.yml run on pull_request_target: your repository's Settings, Actions, Policies`.

#### Scenario: A policy init cannot add

- **WHEN** it cannot add the policy
- **THEN** "Left to do" gains `Let .github/workflows/factory.yml run on pull_request_target: your repository's Settings, Actions, Policies`.

### Requirement: Doctor's policy line

The factory SHALL behave as this line says: When `factory doctor` runs for a public repository, it prints the ✓ line or the ✗ line with its fix, as shown there, or `? Could not tell whether pull_request_target is allowed: ` and the reason. For a private one it prints none.

#### Scenario: Doctor's policy line

- **WHEN** `factory doctor` runs for a public repository
- **THEN** it prints the ✓ line or the ✗ line with its fix, as shown there, or `? Could not tell whether pull_request_target is allowed: ` and the reason. For a private one it prints none.

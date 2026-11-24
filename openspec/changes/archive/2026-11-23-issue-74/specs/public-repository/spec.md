## MODIFIED Requirements

### Requirement: Init adds the policy

The factory SHALL behave as this line says: When `factory init` runs for a public repository on GitHub with no Actions policy that lets `.github/workflows/factory.yml` run on `pull_request_target`, its plan has the `policy` row, reading `Let .github/workflows/factory.yml run on pull_request_target, as the policy "Software factory"`, and after "Go ahead?" it adds the policy and prints `✓ Allowed pull_request_target for .github/workflows/factory.yml.`

#### Scenario: Init adds the policy

- **WHEN** `factory init` runs for a public repository on GitHub with no Actions policy that lets `.github/workflows/factory.yml` run on `pull_request_target`
- **THEN** its plan has the `policy` row, reading `Let .github/workflows/factory.yml run on pull_request_target, as the policy "Software factory"`, and after "Go ahead?" it adds the policy and prints `✓ Allowed pull_request_target for .github/workflows/factory.yml.`

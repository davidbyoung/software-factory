## MODIFIED Requirements

### Requirement: An approver's override

The factory SHALL behave as this line says: When an approver adds the label `code-host.labels.verdict-override` names (by default `verdict-override`), `factory review verdict` posts `Review verdict` as success with the description `Overridden by an approver`, as the requirement "An approver's override" says today for `verdict: override`.

#### Scenario: An approver's override

- **WHEN** an approver adds the label `code-host.labels.verdict-override` names (by default `verdict-override`)
- **THEN** `factory review verdict` posts `Review verdict` as success with the description `Overridden by an approver`, as the requirement "An approver's override" says today for `verdict: override`.

### Requirement: An override by someone who cannot write

The factory SHALL behave as this line says: When an account that is not an approver adds that label, `factory review verdict` removes it, posts the verdict the review gave, or pending when there is none, and comments ``Removed `NAME`: @LOGIN cannot write to this repository, and only an account that can may pass the verdict.``, where NAME is the configured name.

#### Scenario: An override by someone who cannot write

- **WHEN** an account that is not an approver adds that label
- **THEN** `factory review verdict` removes it, posts the verdict the review gave, or pending when there is none, and comments ``Removed `NAME`: @LOGIN cannot write to this repository, and only an account that can may pass the verdict.``, where NAME is the configured name.

### Requirement: An override that cannot be checked

The factory SHALL behave as this line says: When `factory review verdict` cannot ask whether the account that added that label is an approver, it removes the label, posts the verdict the review gave, comments ``Removed `NAME`: could not check whether @LOGIN can write to this repository. Add the label again to retry.``, and exits 1 with the reason.

#### Scenario: An override that cannot be checked

- **WHEN** `factory review verdict` cannot ask whether the account that added that label is an approver
- **THEN** it removes the label, posts the verdict the review gave, comments ``Removed `NAME`: could not check whether @LOGIN can write to this repository. Add the label again to retry.``, and exits 1 with the reason.

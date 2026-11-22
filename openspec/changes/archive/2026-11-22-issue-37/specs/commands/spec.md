## ADDED Requirements

### Requirement: The spec check with no spec tool

The factory SHALL behave as this line says: When `factory specs check` runs and `specs.type` is `none`, it prints `- No spec tool (specs: none): each ticket holds its own spec.` and exits 0.

#### Scenario: The spec check with no spec tool

- **WHEN** `factory specs check` runs and `specs.type` is `none`
- **THEN** It prints `- No spec tool (specs: none): each ticket holds its own spec.` and exits 0.

## REMOVED Requirements

### Requirement: The spec check with specs off

**Reason**: With no spec tool, every `factory specs` command now prints one line, `- No spec tool (specs: none): each ticket holds its own spec.`, in place of `specs are off`.

**Migration**: None; the check still exits 0.

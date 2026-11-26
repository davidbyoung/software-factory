## MODIFIED Requirements

### Requirement: The gate says it passed

The factory SHALL behave as this line says: When every command of `factory gate` passes, it prints `✓ Every gate command passed.` last, on standard output, or `✓ Every gate command that ran passed: R run, L left out.` when commands were left out.

#### Scenario: The gate says it passed

- **WHEN** When every command of `factory gate` passes
- **THEN** it prints `✓ Every gate command passed.` last, on standard output, or `✓ Every gate command that ran passed: R run, L left out.` when commands were left out.

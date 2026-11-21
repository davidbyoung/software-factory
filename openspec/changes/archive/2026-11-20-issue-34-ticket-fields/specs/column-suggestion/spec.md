## REMOVED Requirements

### Requirement: The agent is not installed

**Reason**: `factory init` now stops before its first question when the coding agent's command isn't installed, so the column step never meets a missing agent.

**Migration**: None; the stop at init's start replaces it.

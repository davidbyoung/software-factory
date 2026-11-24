## MODIFIED Requirements

### Requirement: Work and no token

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Work and no token

- **WHEN** there is work and neither a build token nor the App's key with `FACTORY_APP_CLIENT_ID`, or no Claude credential
- **THEN** a run started by a push, a schedule, or a review someone submitted prints what it found, then `, and no build token is set, so no session ran. Builds in the cloud are off: factory init turns them on.`, with `no Claude credential` for the token when that is what is missing, and passes. What it found is `N pull requests conflict`, `A review on #N waits for an answer`, or `N Dependabot pull requests are open`, each in the singular for one. A run started by hand or by the poller fails with today's message, and so does the automated review.

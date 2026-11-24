## MODIFIED Requirements

### Requirement: The App's client ID and key

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The App's client ID and key

- **WHEN** GitHub hands over the App's client ID and key
- **THEN** It stores the App's client ID as the variable `FACTORY_APP_CLIENT_ID` and its key as the secret `FACTORY_APP_PRIVATE_KEY` for ORG as soon as it has them, each reaching every repository of ORG, as every secret it stores does. It writes the key to no file, then sends the browser to the App's install page.

### Requirement: The coding agent's credential

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The coding agent's credential

- **WHEN** `factory init --org ADDRESS` comes to the coding agent's credential
- **THEN** It runs the coding agent's token step as `factory init` does, stores the result for ORG, as `CLAUDE_CODE_OAUTH_TOKEN` or, for an API key, `ANTHROPIC_API_KEY`, and prints `✓ Stored N secrets and 1 variable for ORG.`, counting what this run stored. A token left empty gets today's line, with `factory init --org ADDRESS` as the command to run again. A pasted value is checked before it is stored: one that does not start `sk-ant-oat` where the token is asked for, or `sk-ant-api` where an API key is, is refused and asked for again. The refusal prints no part of the value. A value of the right shape is then tried before it is stored: it prints `Trying the token...`, or `Trying the API key...`, and asks Claude Code one small thing with the value in the command's environment, never in an argument. One Claude Code refuses is not stored: it prints `Claude Code refused that token: REASON. If it was printed over two lines, copy both, then paste it again.` and asks again. When the try cannot run, as when it takes too long or Claude Code is not installed, the value is stored and it prints `Could not try the token (REASON), so it is stored untried.` It says a value with a `#` is the code the browser gave for `claude setup-token`, and for a token or a key pasted at the other's prompt, which it is and the choice it belongs to.

### Requirement: Run again

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Run again

- **WHEN** `factory init --org ADDRESS` runs again for the same organization
- **THEN** Run again, it prints what it found as "run again" shows, with `on the repositories you chose` for an install on some, does only what is missing, and asks whether to replace the Claude credential. With nothing to do it prints `✓ ORG is set up. Nothing to do.` With the variable set and no installation of that client ID, it prints the line "before it asks" shows, opens that page, waits as line 10 says, and prints `✓ Installed the app.`

# GitHub organizations

What `factory init --org` does on GitHub for an organization, and what to
do when an organization's secrets do not reach a repository.

## What setup adds

What [`factory init --org`](../setup/organization.md#set-an-organization-up-once) adds,
once, for every repository of the organization, here `acme`. No command takes these
out: [Removing it](../maintain/removing.md#taking-an-organizations-setup-out)
lists them in the order to delete them.

| What `factory init --org` adds                                                                                                                                          | Where to find it                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| The GitHub App "Software Factory for acme", registered by the organization and installed on the repositories its owner chose                                            | The organization's Settings, Developer settings, GitHub Apps                          |
| The secret `FACTORY_APP_PRIVATE_KEY`, the variable `FACTORY_APP_CLIENT_ID`, and the secret `CLAUDE_CODE_OAUTH_TOKEN`, or `ANTHROPIC_API_KEY`, each for every repository | The organization's Settings, Secrets and variables, Actions                           |
| The repository `acme/factory-config`, with `factory-preset.yaml`, `.github/workflows/factory-poller.yml`, and a `README.md`                                             | Among the organization's repositories                                                 |
| The property `software-factory`, with the values `on` and `off`, which the first workflow run after a repository's setup merges sets to `on` for it                     | The organization's Settings, Custom properties                                        |
| The rule "Software factory", which requires "Review verdict" before a merge to the default branch of each repository whose property is `on`                             | The organization's Settings, Rules. Not on GitHub's Free plan, which has no such rule |
| A board, or whichever of the factory's columns and fields the board the owner chose still lacked                                                                        | The organization's Projects                                                           |

## On GitHub's Free plan

The `Plan` row, in the list the command prints first, headed `Found`,
says when the organization is on it. Then
`factory-config` is public, so anyone can read the shared settings in
it. What follows differs for the organization's public and private
repositories:

- **A public repository** gets the review and builds in the cloud. There
  is no organization-wide rule, so once its setup merges, an admin of
  that repository runs `factory init` again, which requires "Review
  verdict" there. The command's closing lines list that as a third
  step:

  ```text
    3. Once that pull request merges, an admin of the repository runs factory init there
       again, to require "Review verdict". GitHub Free has no organization-wide rules.
  ```

- **A private repository** can't use a [preset](../customize/presets.md) that turns
  on a board, the review, or builds that start from the board, since the
  plan does not share the organization's secrets with it. `factory init`
  there stops, changes nothing, and names them:

  ```text
  ✗ The presets turn on a board, the review, and builds that start from the board. They need acme's secrets, and GitHub Free does not share them with a private repository.
  ```

  Make the repository public, or move the organization to a paid plan, and
  run `factory init` again. To build only on your machine, run it and leave
  that preset unchecked. The preset `factory init --org` writes turns on
  all three.

  The plan has no branch rules for a private repository either, so "Review
  verdict" cannot be required there. Where such a preset was already
  followed, `factory doctor` shows a line for each:

  ```text
  ✗ CLAUDE_CODE_OAUTH_TOKEN is stored for acme, and GitHub Free does not share it with a private repository: make the repository public, or move acme to a paid plan
  - "Review verdict" cannot be required here: GitHub Free has no branch rules for a private repository
  ```

## When the organization's secrets do not reach you

You need an owner of the organization for this. If init stopped, send them
what it printed, which lists only what your repository lacks:

```text
✗ The presets turn on a board, the review, and builds that start from the board. They need acme's secrets, and those do not reach acme/web.
An owner of acme gives acme/web access to each of these, under "Repository access". Then run factory init again.
  Secrets: FACTORY_APP_PRIVATE_KEY, and CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY
     https://github.com/organizations/acme/settings/secrets/actions
  Variable: FACTORY_APP_CLIENT_ID
     https://github.com/organizations/acme/settings/variables/actions
```

If it went on instead, it listed nothing, and said that the review and
builds in the cloud stay off until the organization's secrets reach your
repository. Send the owner the lines above from "Secrets" on, with your
organization's name in place of `acme` in the two addresses, and your
repository's name.

On those two pages the owner opens each secret and the variable, and under
"Repository access" picks a choice that includes your repository, such as
all repositories. Of the two names for what pays for Claude, only the one
the organization stored is there. If one is missing from the page, the
owner first [sets the organization up](../setup/organization.md#set-an-organization-up-once).

**It worked when** the `Organization` row says the app's key and the
Claude token are stored, once you run `factory init` again.

If the owner keeps the secrets from your repository on purpose, you have
two choices:

- **Build only on your machine.** Run `factory init` and leave the presets
  that turn those parts on unchecked. If `.claude/factory.yaml` lists one
  under [`presets`](../reference/settings/presets.md#presets), take its line out first.
  It worked when init asks "Go ahead?".
- **Store tokens on the repository in place of the organization's
  secrets.** You need two, a GitHub token as `FACTORY_BOARD_TOKEN` and a
  Claude token as `CLAUDE_CODE_OAUTH_TOKEN`, and neither of the App's
  values. [Secrets](../security/credentials.md#secrets) says how to make each, and the
  command that stores it. It worked when `factory init` asks "Go ahead?"
  with the presets checked.

## Replacing the App's key

For an owner of the organization, when the key may have leaked. The
GitHub CLI needs the `admin:org` permission for step 2, which
`gh auth refresh -s admin:org` grants.

1. On GitHub, open the organization's Settings, Developer settings,
   GitHub Apps, then the App's own page, and press "Generate a private
   key". GitHub downloads the key as a `.pem` file.
2. Store it in place of the old one, with your organization's name and
   the file's:

   ```bash
   gh secret set FACTORY_APP_PRIVATE_KEY --org acme --visibility all < FILE.pem
   ```

   If you had narrowed the secret to chosen repositories, write
   `--repos NAME,NAME` in place of `--visibility all`, so it stays
   narrowed.

3. Delete the old key on the App's page, then delete the file.

**It worked when** a build you start with `factory build N`, for a
ticket that is ready, gets past the step "Sign in" of its Prepare job. A
wrong key fails the run at that step.

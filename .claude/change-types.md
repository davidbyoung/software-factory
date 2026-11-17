# Change types

The kinds of change this repository gets, each with a real example. A rule
change that alters what triggers a step is traced through every one of
them before its pull request is marked ready ("Changing the process" in
`.claude/factory/rules.md`, and its section in `CLAUDE.md`). The list
names the kinds and nothing more: each one's path is read from the rules
as they stand, so this file never restates them.

| Kind                                                                   | Example                                                    |
| ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| A command's behavior a factory user sees: output, exit, what it writes | the global `factory` handing off to a repository's copy    |
| A setting: a new key, a default, or what a value means                 | `ci-review` and its `commands`                             |
| A skill, an agent, or the rules: what every repository's sessions do   | `factory-deps` completing a factory update with its sync   |
| A shipped workflow or action: what runs in every repository's CI       | the CI review shipped as `factory-claude-review.yml`       |
| A small bug fix with no change to what a user sees                     | the commit guard passing a repository with no settings     |
| This repository's own CI or release workflow                           | the release waiting on CI for its commit                   |
| Docs only                                                              | the quick start installing the global command              |
| Tests only                                                             | the boundary test reading every file of the package        |
| A dependency bump                                                      | a new `js-yaml`                                            |
| A follow-ups build                                                     | the two lines moved from the first repository's follow-ups |

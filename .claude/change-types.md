# Change types

The kinds of change this repository gets, each with a real example. A rule
change that alters what triggers a step is traced through every one of
them before its pull request is marked ready ("Changing the process" in
`.claude/factory/rules.md`, and its section in `CLAUDE.md`). The list
names the kinds and nothing more: each one's path is read from the rules
as they stand, so this file never restates them.

| Kind                                                                   | Example                                                        |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| A command's behavior a factory user sees: output, exit, what it writes | `factory` running the version a repository's lock names        |
| A setting: a new key, a default, or what a value means                 | `pr-review` and its `commands`                                 |
| A skill, an agent, or the rules: what every repository's sessions do   | `factory-address-review` waiting for no review where it is off |
| A workflow every repository calls: what runs in its CI                 | the review job of `review.yml`, or a job of `run.yml`          |
| A small bug fix with no change to what a user sees                     | the commit guard passing a repository with no settings         |
| This repository's own CI or release workflow                           | the release waiting on CI for its commit                       |
| This repository's own reviewers and settings: what its sessions do     | `docs-reader` listed as a reviewer plugin for the docs         |
| Docs only                                                              | the quick start installing the global command                  |
| Tests only                                                             | the boundary test reading every file of the package            |
| A dependency bump                                                      | a new `js-yaml`                                                |
| A follow-ups build                                                     | the two lines moved from the first repository's follow-ups     |

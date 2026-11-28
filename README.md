# lunamill

For a developer who already asks a coding agent to write code, and wants
it done the same careful way every time. lunamill is a software factory for
your coding agent. You write a ticket. Your agent turns it into a spec,
asking you only the decisions that are yours, builds it with tests, has
it reviewed, answers the review, and hands you a pull request to read.
You decide what merges.

> **Early, and not yet for general use.** This is below 1.0: it changes
> weekly, and any minor version may break what the one before it did,
> without notice. A repository stays on one exact version until you merge
> the pull request that [updates it](https://www.lunamill.ai/maintain/updating).

## Install

You need Node 22.18 or later, a repository on GitHub with the GitHub CLI
signed in, and Claude Code signed in:
[What you need](https://www.lunamill.ai/setup/repository#what-you-need) says how
to check each. Install the `lunamill` command once on your machine:

```bash
npm install -g @lunamill-ai/lunamill
```

**It worked when** `lunamill`, run in any folder, prints the list of its
commands.

## Next

The docs are at [lunamill.ai](https://www.lunamill.ai). Start with the
[quick start](https://www.lunamill.ai/get-started/quick-start), which takes you
from setting your repository up with `lunamill init` to your first built
ticket.

A repository that uses `@davidbyoung/software-factory`, lunamill's old
name, moves over by hand:
[Moving to lunamill](https://www.lunamill.ai/maintain/upgrade-notes#moving-to-lunamill).

Working on lunamill itself: [Developing](docs/developing.md).

## License

MIT.

# Which setup is yours

For anyone about to set the factory up. Find yourself in the table: it
names the page to start on, and what you have once you have followed it.

| Who you are                                             | Page to start on                                                                                                    | What you have at the end                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| One person, with repositories on your own account       | [The quick start](../get-started/quick-start.md)                                                                    | A first ticket built on your machine. The [optional features](../features/README.md) can come later        |
| A developer whose repository belongs to an organization | [Set up a repository](repository.md)                                                                                | A first ticket built on your machine, and the features your organization turned on, with no token to paste |
| An owner of an organization                             | [Set up an organization](organization.md), before any of its repositories turns on a feature that runs in the cloud | An organization whose developers each set a repository up by running `factory init` in it                  |

Building on your machine needs nothing from the organization. Only the
features that run in the cloud do: the automated review, the board, and
builds in the cloud.

**Not sure whether your organization is set up?** With the factory
[installed](../get-started/install.md), run `factory init` in your
repository. It changes nothing until you answer "Go ahead?", and
the list it prints first has a row that says. When the organization is
set up, the row reads:

```text
  Organization     acme, set up: its app's key and its Claude token are stored
```

Any other reading, and what to do about it, is in
[Set up a repository](repository.md#in-an-organization).

## When you already have something

- [Add it to an existing repository](existing-repository.md): your
  repository already has agent instructions, CI workflows, a board, or
  several packages, or is not JavaScript.
- [Work as a team](team.md): someone has set the repository up already,
  and you are joining it, or working from another machine.

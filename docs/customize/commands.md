# Your commands

For someone telling the factory how to check a change in their
repository. At the end a build runs your tests, your linter, and one test
at a time, as you do. Every key is on
[`commands`](../reference/settings/commands.md#commands).

## Optional: tune it

Each is a few lines in `.claude/factory.yaml`, merged like any change.

- **Let a session in the cloud reach your registry.** Its commands reach
  the npm registry and no other host. List any other that your tests or
  your gate download from under
  [`builds.hosts`](../reference/settings/builds.md#builds)
  ([What a session can use](../features/cloud-builds.md#what-a-session-can-use)):

  ```yaml
  builds:
    hosts:
      - pypi.org
      - files.pythonhosted.org
  ```

- **Run a command before every commit a session on your machine makes,**
  such as your linter, under
  [`commands.before-commit`](../reference/settings/commands.md#commandsbefore-commit):

  ```yaml
  commands:
    before-commit:
      - npm run lint
  ```

- **Tell the reviewer what your `CLAUDE.md` does not say** about your
  project, in a file you write, `.github/review-notes.md`. The reviewer
  reads it when it exists.

[Settings](../reference/settings/README.md) has every setting.

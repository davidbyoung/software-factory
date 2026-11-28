# Your commands

For someone telling lunamill how to check a change in their
repository. At the end a build runs your tests, your linter, and one test
at a time, as you do. Every key is on
[`commands`](../reference/settings/commands.md#commands).

## Set your commands

A build needs one command from you: the one that checks a change, under
`gate`. `lunamill init` asks for it. To write it yourself, or to add the
command that runs one test, put them in `.claude/lunamill.yaml`:

```yaml
commands:
  gate:
    - npm run lint
    - npm test
  test-one: npx vitest run $FILE -t "$NAME"
```

Use your project's own commands. A start for each of five languages, to
change to what your project runs ([Any language](any-language.md)):

| Language   | `gate`                          | `test-one`                                  |
| ---------- | ------------------------------- | ------------------------------------------- |
| JavaScript | `npm test`                      | `npx vitest run $FILE -t "$NAME"`           |
| Python     | `pytest`                        | `pytest $FILE -k "$NAME"`                   |
| Go         | `go vet ./... && go test ./...` | `go test ./$(dirname $FILE) -run "$NAME"`   |
| PHP        | `composer test`                 | `vendor/bin/phpunit $FILE --filter "$NAME"` |
| Rust       | `cargo test`                    | `cargo test "$NAME"`                        |

**It worked when** `lunamill gate` runs your commands and passes.

## Optional: tune it

Each is a few lines in `.claude/lunamill.yaml`, merged like any change.

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

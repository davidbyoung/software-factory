## MODIFIED Requirements

### Requirement: The guard refuses the credentials file

The factory SHALL refuse a session's call that reads the credentials file, with the reason `The factory's credentials file is not for sessions to read. Its commands read it themselves: run the factory command you need, such as factory ticket view.`, and let through one that only mentions it. It SHALL do so in every repository `factory sync` writes its hooks into, whatever the ticket system, since the file also holds a person's GitHub token and coding agent's credential.

#### Scenario: The guard refuses the credentials file

- **WHEN** a session's `Bash` command has the file's path as an argument, written after a folder (`~/.config/software-factory/credentials...`, `$XDG_CONFIG_HOME/software-factory/credentials...`, or a full path) or as `software-factory/credentials.yaml`, outside a heredoc body and outside a quoted string with a space in it; or a `Read` or `Grep` call's `file_path` or `path`, or a `Glob` call's `pattern` or `path`, names it the same way
- **THEN** the guard hook refuses it with that reason; a commit message, a comment body, a heredoc, a search for the words, or Grep's pattern that only mentions the path goes through. `factory sync` writes the hook for `Read`, `Grep`, and `Glob` into `.claude/settings.json` with every ticket system, once, in place of one an earlier release wrote. Its command starts the factory only when the call's input holds `software-factory/credentials`, and lets any other call through from the shell; on a machine with no `factory` on its `PATH` it stops the call with the line that says how to install it, as the hook for `Bash` does.

### Requirement: The workflows unchanged with GitHub's tickets

The factory SHALL behave as this line says: With GitHub's tickets, the ticket system adds no line to either workflow file `factory sync` writes, `.github/workflows/factory.yml` and `.github/workflows/factory-review.yml`. `.claude/settings.json` is not held to this: it gains the hook on the credentials file with every ticket system.

#### Scenario: The workflows unchanged with GitHub's tickets

- **WHEN** the ticket system is GitHub's
- **THEN** With GitHub's tickets, the ticket system adds no line to either workflow file `factory sync` writes, `.github/workflows/factory.yml` and `.github/workflows/factory-review.yml`. `.claude/settings.json` is not held to this: it gains the hook on the credentials file with every ticket system.

# pr-uncovered Specification

## Purpose

What `kodor pr uncovered` prints, what it reads, and how it ends.

## Requirements

### Requirement: Lines no test ran print as MISS

kodor SHALL behave as this line says: When `kodor pr uncovered` runs and the coverage report shows lines the branch added or changed that no test ran, it prints `=== PATH` for each such file, files in path order, then one line for each of those lines in line order: `MISS N: TEXT`, where N is the line's number and TEXT is the source line without the whitespace around it, cut to 110 characters.

#### Scenario: Lines no test ran print as MISS

- **WHEN** `kodor pr uncovered` runs and the coverage report shows lines the branch added or changed that no test ran
- **THEN** it prints `=== PATH` for each such file, files in path order, then one line for each of those lines in line order: `MISS N: TEXT`, where N is the line's number and TEXT is the source line without the whitespace around it, cut to 110 characters.

### Requirement: A branch never taken prints as PART

kodor SHALL behave as this line says: When a line the branch added or changed was run but the report shows a branch on it never taken, it prints `PART N: TEXT` for that line, in the same list and order.

#### Scenario: A branch never taken prints as PART

- **WHEN** a line the branch added or changed was run but the report shows a branch on it never taken
- **THEN** it prints `PART N: TEXT` for that line, in the same list and order.

### Requirement: A line that is both prints once

kodor SHALL behave as this line says: When a line was never run and also has a branch never taken, it prints that line once, as `MISS`.

#### Scenario: A line that is both prints once

- **WHEN** a line was never run and also has a branch never taken
- **THEN** it prints that line once, as `MISS`.

### Requirement: A line the branch did not change prints nothing

kodor SHALL behave as this line says: When the report shows an uncovered line the branch did not add or change, it prints nothing for that line.

#### Scenario: A line the branch did not change prints nothing

- **WHEN** the report shows an uncovered line the branch did not add or change
- **THEN** it prints nothing for that line.

### Requirement: A file the report does not hold prints nothing

kodor SHALL behave as this line says: When the branch changed a file the report does not hold, it prints nothing for that file.

#### Scenario: A file the report does not hold prints nothing

- **WHEN** the branch changed a file the report does not hold
- **THEN** it prints nothing for that file.

### Requirement: Nothing uncovered prints nothing

kodor SHALL behave as this line says: When every line the branch added or changed is covered, it prints nothing and exits 0.

#### Scenario: Nothing uncovered prints nothing

- **WHEN** every line the branch added or changed is covered
- **THEN** it prints nothing and exits 0.

### Requirement: Uncovered lines are a report

kodor SHALL behave as this line says: When it prints uncovered lines, it exits 0: the lines are a report, not a failure.

#### Scenario: Uncovered lines are a report

- **WHEN** it prints uncovered lines
- **THEN** it exits 0: the lines are a report, not a failure.

### Requirement: BASE is what the branch is compared with

kodor SHALL behave as this line says: When `BASE` is given, the lines the branch added or changed are those `git diff -U0 BASE...HEAD` shows as added.

#### Scenario: BASE is what the branch is compared with

- **WHEN** `BASE` is given
- **THEN** the lines the branch added or changed are those `git diff -U0 BASE...HEAD` shows as added.

### Requirement: BASE defaults to the default branch

kodor SHALL behave as this line says: When `BASE` is not given, it is the name of the remote whose address is the `repository` line's, then `/`, then the code host's default branch, and `origin/` followed by that branch in a checkout with no `.claude/kodor.yaml`. With no such remote it prints the line `init-repository` gives for that and exits 1.

#### Scenario: BASE defaults to the default branch

- **WHEN** `BASE` is not given
- **THEN** it is the name of the remote whose address is the `repository` line's, then `/`, then the code host's default branch, and `origin/` followed by that branch in a checkout with no `.claude/kodor.yaml`. With no such remote it prints the line `init-repository` gives for that and exits 1.

### Requirement: LCOV is the report's path

kodor SHALL behave as this line says: When `kodor pr uncovered` reads the coverage report, it reads the path given as `LCOV`, and `coverage/lcov.info` when none is given.

#### Scenario: LCOV is the report's path

- **WHEN** `kodor pr uncovered` reads the coverage report
- **THEN** it reads the path given as `LCOV`, and `coverage/lcov.info` when none is given.

### Requirement: A full path in the report still matches

kodor SHALL behave as this line says: When the report names a file by its full path, the file is matched to the branch's by its path from the directory the command runs in.

#### Scenario: A full path in the report still matches

- **WHEN** the report names a file by its full path
- **THEN** the file is matched to the branch's by its path from the directory the command runs in.

### Requirement: A missing report is an error

kodor SHALL behave as this line says: When the coverage report does not exist, it prints `No coverage report at PATH. Run the project's coverage command first.`, with the path it looked for, and exits 1.

#### Scenario: A missing report is an error

- **WHEN** the coverage report does not exist
- **THEN** it prints `No coverage report at PATH. Run the project's coverage command first.`, with the path it looked for, and exits 1.

### Requirement: A failed git diff is an error

kodor SHALL behave as this line says: When `git diff` fails, as it does for a `BASE` that does not exist, it prints git's error and exits 1.

#### Scenario: A failed git diff is an error

- **WHEN** `git diff` fails, as it does for a `BASE` that does not exist
- **THEN** it prints git's error and exits 1.

### Requirement: A source that cannot be read prints no text

kodor SHALL behave as this line says: When an uncovered line's source file cannot be read, it prints the line as `MISS N:` or `PART N:` with no text.

#### Scenario: A source that cannot be read prints no text

- **WHEN** an uncovered line's source file cannot be read
- **THEN** it prints the line as `MISS N:` or `PART N:` with no text.

### Requirement: The command is listed

kodor SHALL behave as this line says: When `kodor` runs with no command, its list holds `kodor pr uncovered [BASE] [LCOV]`.

#### Scenario: The command is listed

- **WHEN** `kodor` runs with no command
- **THEN** its list holds `kodor pr uncovered [BASE] [LCOV]`.

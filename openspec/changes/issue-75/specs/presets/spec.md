## ADDED Requirements

### Requirement: A preset for some folders

The factory SHALL behave as this line says: When a `presets` entry is `name` with `in`, `factory preset add NAME --in IN` writes it, and the preset applies only in those folders. A preset already listed without `in` can be added again with it.

#### Scenario: A preset for some folders

- **WHEN** When a `presets` entry is `name` with `in`
- **THEN** `factory preset add NAME --in IN` writes it, and the preset applies only in those folders. A preset already listed without `in` can be added again with it.

### Requirement: A folder preset's paths

The factory SHALL behave as this line says: When a preset has `in`, each command it gives runs in each of those folders, and each path and pattern it gives, `commands.ignore` included, is read from each folder as if it started with `./`.

#### Scenario: A folder preset's paths

- **WHEN** When a preset has `in`
- **THEN** each command it gives runs in each of those folders, and each path and pattern it gives, `commands.ignore` included, is read from each folder as if it started with `./`.

### Requirement: A folder preset's commands are added

The factory SHALL behave as this line says: When a folder preset sets any key under `commands`, its commands are added after the list that applies without it, which is chosen among the other layers as today; a single map, such as `coverage`, joins as a list of one. In `test-one` and `end-to-end`, text moves last.

#### Scenario: A folder preset's commands are added

- **WHEN** When a folder preset sets any key under `commands`
- **THEN** its commands are added after the list that applies without it, which is chosen among the other layers as today; a single map, such as `coverage`, joins as a list of one. In `test-one` and `end-to-end`, text moves last.

### Requirement: A folder preset's relock

The factory SHALL behave as this line says: When a folder preset sets `relock`, its commands are added to the default `npm install`; only the repository's own `relock` replaces the default.

#### Scenario: A folder preset's relock

- **WHEN** When a folder preset sets `relock`
- **THEN** its commands are added to the default `npm install`; only the repository's own `relock` replaces the default.

### Requirement: A folder preset's sites

The factory SHALL behave as this line says: When a folder preset sets `site`, its sites are added to the others.

#### Scenario: A folder preset's sites

- **WHEN** When a folder preset sets `site`
- **THEN** its sites are added to the others.

### Requirement: A folder preset's reviewers

The factory SHALL behave as this line says: When a folder preset gives a reviewer with no `files`, the reviewer reads changes matching `./**` in each of its folders; when two folder presets give the same reviewer, it is one reviewer reading both presets' folders.

#### Scenario: A folder preset's reviewers

- **WHEN** When a folder preset gives a reviewer with no `files`
- **THEN** the reviewer reads changes matching `./**` in each of its folders; when two folder presets give the same reviewer, it is one reviewer reading both presets' folders.

### Requirement: The same preset for different folders

The factory SHALL behave as this line says: When the same preset is listed twice with different `in`, or once with `in` and once without, both apply, sharing its one pin in `.claude/factory.lock`.

#### Scenario: The same preset for different folders

- **WHEN** When the same preset is listed twice with different `in`
- **THEN** or once with `in` and once without, both apply, sharing its one pin in `.claude/factory.lock`.

### Requirement: What a folder preset can set

The factory SHALL behave as this line says: When a folder preset sets anything but `commands`, `plugins`, or `site`, `factory config check` and `factory sync` fail with `presets[N]: NAME sets KEY, which a preset for some folders can't`.

#### Scenario: What a folder preset can set

- **WHEN** When a folder preset sets anything but `commands`
- **THEN** `plugins`, or `site`, `factory config check` and `factory sync` fail with `presets[N]: NAME sets KEY, which a preset for some folders can't`.

### Requirement: The summary for a folder preset

The factory SHALL behave as this line says: When `factory preset add` shows its summary for a folder preset, each command's row names the folders it runs in.

#### Scenario: The summary for a folder preset

- **WHEN** When `factory preset add` shows its summary for a folder preset
- **THEN** each command's row names the folders it runs in.

## MODIFIED Requirements

### Requirement: A list of commands

The factory SHALL behave as this line says: When two layers set a key under `commands`, a preset for some folders adds its commands after the list that applies without it, and among the other layers `commands.gate`, `commands.before-commit`, and `commands.build-setup` take one layer's whole list, chosen as line 16 chooses a single value.

#### Scenario: A list of commands

- **WHEN** When two layers set a key under `commands`
- **THEN** a preset for some folders adds its commands after the list that applies without it, and among the other layers `commands.gate`, `commands.before-commit`, and `commands.build-setup` take one layer's whole list, chosen as line 16 chooses a single value.

### Requirement: A preset listed twice

The factory SHALL behave as this line says: When `presets` lists the same preset twice with the same `in`, or twice without one, they print `presets: NAME is listed twice`, with ` --in IN` after NAME when it has one.

#### Scenario: A preset listed twice

- **WHEN** When `presets` lists the same preset twice with the same `in`, or twice without one
- **THEN** they print `presets: NAME is listed twice`, with ` --in IN` after NAME when it has one.

### Requirement: A preset already listed

The factory SHALL behave as this line says: When NAME is already in `presets` with the `in` given, or without one when none is given, `preset add` prints `NAME is already in presets`, with ` --in IN` after NAME when one is given, and exits 1.

#### Scenario: A preset already listed

- **WHEN** When NAME is already in `presets` with the `in` given, or without one when none is given
- **THEN** `preset add` prints `NAME is already in presets`, with ` --in IN` after NAME when one is given, and exits 1.

### Requirement: Part of site, or of coverage

The factory SHALL behave as this line says: When a preset writes part of `site` and leaves out `site.start` or `site.url`, or writes one of `commands.coverage.run` and `commands.coverage.report` as a single map, `factory preset check` passes; a coverage item in a list needs `run` and `report`.

#### Scenario: Part of site, or of coverage

- **WHEN** When a preset writes part of `site` and leaves out `site.start` or `site.url`, or writes one of `commands.coverage.run` and `commands.coverage.report` as a single map
- **THEN** `factory preset check` passes; a coverage item in a list needs `run` and `report`.

### Requirement: The summary's runs lines

The factory SHALL behave as this line says: When a command in effect after the add has this preset as its source, After `writes`, the summary has one `runs` line for each command in effect after the add whose source is this preset: the command, a comma, and when it runs: `in the review` for `pr-review.commands`, `at the gate` for `commands.gate`, `before each commit` for `commands.before-commit`, `at the start of a cloud build` for `commands.build-setup`, and `as ` and the setting's key for any other, followed by `, in IN` for a preset for some folders.

#### Scenario: The summary's runs lines

- **WHEN** When a command in effect after the add has this preset as its source
- **THEN** After `writes`, the summary has one `runs` line for each command in effect after the add whose source is this preset: the command, a comma, and when it runs: `in the review` for `pr-review.commands`, `at the gate` for `commands.gate`, `before each commit` for `commands.before-commit`, `at the start of a cloud build` for `commands.build-setup`, and `as ` and the setting's key for any other, followed by `, in IN` for a preset for some folders.

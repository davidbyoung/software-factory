## ADDED Requirements

### Requirement: Init asks for the spec tool

The factory SHALL behave as this line says: When `factory init` runs and the settings in effect, from the file or a preset, have no `specs`, it asks `Which spec tool do you use?` right after the branch-name question, or where that question would be when it is not asked, offering `None: each ticket holds its own spec` first and selected, then `OpenSpec: each ticket holds its spec, and each build also keeps it in openspec/specs/`.

#### Scenario: Init asks for the spec tool

- **WHEN** `factory init` runs and the settings in effect, from the file or a preset, have no `specs`
- **THEN** it asks `Which spec tool do you use?` right after the branch-name question, or where that question would be when it is not asked, offering `None: each ticket holds its own spec` first and selected, then `OpenSpec: each ticket holds its spec, and each build also keeps it in openspec/specs/`.

### Requirement: Init writes no spec tool

The factory SHALL behave as this line says: When the person chooses None, `factory init` writes `specs: none` to `.claude/factory.yaml`.

#### Scenario: Init writes no spec tool

- **WHEN** the person chooses None
- **THEN** `factory init` writes `specs: none` to `.claude/factory.yaml`.

### Requirement: Init writes OpenSpec

The factory SHALL behave as this line says: When the person chooses OpenSpec, `factory init` writes `specs: openspec` to `.claude/factory.yaml`.

#### Scenario: Init writes OpenSpec

- **WHEN** the person chooses OpenSpec
- **THEN** `factory init` writes `specs: openspec` to `.claude/factory.yaml`.

### Requirement: Init keeps a spec tool already set

The factory SHALL behave as this line says: When the settings in effect already have `specs`, `factory init` does not ask line 17's question and leaves `specs` as it is.

#### Scenario: Init keeps a spec tool already set

- **WHEN** the settings in effect already have `specs`
- **THEN** `factory init` does not ask line 17's question and leaves `specs` as it is.

### Requirement: Init plans the spec tool's install

The factory SHALL show an `Install` row last in init's plan, before any `Turn off` row, when the spec tool the settings name is not installed, as the scenario says.

#### Scenario: Init plans the spec tool's install

- **WHEN** the settings in effect, or line 19's answer, name a spec tool that its adapter says is not installed (for OpenSpec: `package.json` lists `@fission-ai/openspec` in neither `dependencies` nor `devDependencies`)
- **THEN** Init's plan has the row `Install`, padded to eight as the plan's other labels are, then the adapter's package and command, for OpenSpec `@fission-ai/openspec, with npm install --save-dev`. The row comes after every other row and before any `Turn off` row.

### Requirement: Init installs the spec tool

The factory SHALL behave as this line says: When the person answers yes to "Go ahead?" with line 21's row in the plan, `factory init` runs the adapter's install command, for OpenSpec `npm install --save-dev @fission-ai/openspec`, from the repository's root, after writing `package.json` when there was none, and prints `Installed ` and the package, for OpenSpec `Installed @fission-ai/openspec.`

#### Scenario: Init installs the spec tool

- **WHEN** the person answers yes to "Go ahead?" with line 21's row in the plan
- **THEN** `factory init` runs the adapter's install command, for OpenSpec `npm install --save-dev @fission-ai/openspec`, from the repository's root, after writing `package.json` when there was none, and prints `Installed ` and the package, for OpenSpec `Installed @fission-ai/openspec.`

### Requirement: Init carries on when the install fails

The factory SHALL, when the spec tool's install fails, print the failure and the last five lines of its standard error, carry on with the rest of init, and put the install first under "Left to do", as the scenario says.

#### Scenario: Init carries on when the install fails

- **WHEN** that install exits non-zero
- **THEN** `factory init` prints `Could not install ` and the package and a colon, for OpenSpec `Could not install @fission-ai/openspec:`, then the last five lines the command printed on standard error, each indented two spaces, carries on with the rest, and lists `Install ` the tool's name `, which a build writes specs with: ` and the command first under "Left to do", for OpenSpec `Install OpenSpec, which a build writes specs with: npm install --save-dev @fission-ai/openspec`.

### Requirement: Init installs nothing when it is not needed

The factory SHALL behave as this line says: When the adapter says its tool is installed, or `specs` is `none`, init's plan has no `Install` row and init installs nothing. Lines 17 to 24 are the only change to what `factory init` prints and asks with today's tools.

#### Scenario: Init installs nothing when it is not needed

- **WHEN** the adapter says its tool is installed, or `specs` is `none`
- **THEN** Init's plan has no `Install` row and init installs nothing. Lines 17 to 24 are the only change to what `factory init` prints and asks with today's tools.

## MODIFIED Requirements

### Requirement: Init is unchanged with today's tools

The factory SHALL behave as this line says: `factory init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, its fixes, as line 25 says, the question that asks for `code-host.branch-name` when the settings in effect have none, and the spec tool's question and install that #37's lines 17 to 24 add.

#### Scenario: Init is unchanged with today's tools

- **WHEN** `factory init` runs with GitHub, GitHub Issues, GitHub Actions, and Claude Code
- **THEN** `factory init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, its fixes, as line 25 says, the question that asks for `code-host.branch-name` when the settings in effect have none, and the spec tool's question and install that #37's lines 17 to 24 add.

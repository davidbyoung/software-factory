## ADDED Requirements

### Requirement: The organization's property is left by hand

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The organization's property is left by hand

- **WHEN** `factory remove` runs in an organization's repository that is set up
- **THEN** `factory remove`, in an organization's repository that is set up, lists `Ask an owner of ORG to set the software-factory property to "off" for REPOSITORY: until then every pull request waits on its "Review verdict" check`.

## MODIFIED Requirements

### Requirement: The code host's leftovers

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The code host's leftovers

- **WHEN** the code host is GitHub
- **THEN** its group holds the ruleset line; one line `Delete the secrets NAMES` for its tokens and `FACTORY_SIGNING_KEY` among those set, ending ` if set` when the secrets cannot be listed, as today; and `Delete whichever of the labels merge: automatic, merge: manual, and verdict: override exist, if you do not want their history: deleting one takes it off every pull request`. Before them comes the line "The organization's property is left by hand" gives, where the repository's `software-factory` property is `on`. After them, where the credentials file holds a token for the repository's owner, comes `Delete HOST/OWNER under github from PATH, unless another repository of OWNER's uses it`, ending `, if it is there` when the file cannot be read.

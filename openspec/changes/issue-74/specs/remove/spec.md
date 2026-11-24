## ADDED Requirements

### Requirement: The organization's property is left by hand

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The organization's property is left by hand

- **WHEN** `factory remove` runs in an organization's repository that is set up
- **THEN** `factory remove`, in an organization's repository that is set up, lists `Ask an owner of ORG to set the software-factory property to "off" for REPOSITORY: until then every pull request waits on its "Review verdict" check`.

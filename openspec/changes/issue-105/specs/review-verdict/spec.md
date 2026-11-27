## MODIFIED Requirements

### Requirement: No comment changes it

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: No comment changes it

- **WHEN** someone comments on the pull request, or adds the override label
- **THEN** No comment changes the verdict, other than the override's record, which only the workflow's own account posts. The override label counts only when the code host says an approver added it, and only for the commit that was the head in the labeled event and still was when its run read the pull request, whatever event is being handled.

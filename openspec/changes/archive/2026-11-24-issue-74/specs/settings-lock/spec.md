## REMOVED Requirements

### Requirement: The review reads the base commit's lock

**Reason**: `factory review tools` goes. The session's sandbox confines a review's commands, and Prepare hands it its tickets.

**Migration**: None: `pr-review.commands` is still read, and limits nothing.

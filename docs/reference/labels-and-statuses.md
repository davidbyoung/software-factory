# Labels, statuses, and checks

Every label and status kodor sets, by its key in the settings,
with who sets it.

## Labels and statuses

| Name                | Kind                     | Set by                                                                                                                                                                                                |
| ------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `merge-automatic`   | Label on a pull request  | The merge policy, when every file is allowed                                                                                                                                                          |
| `merge-manual`      | Label on a pull request  | The merge policy, otherwise                                                                                                                                                                           |
| `verdict-override`  | Label on a pull request  | Only a person: passes the review verdict for one commit. Sessions never add it                                                                                                                        |
| `policy-override`   | Label on a pull request  | Only a person: accepts what an approval policy found, for one commit. Sessions never add it                                                                                                           |
| `spec`              | Label on a ticket        | Refinement, for a change your users will see, when [`specs: openspec`](settings/specs.md#specs)                                                                                                       |
| `kodor`             | Label on a ticket        | kodor, on [each ticket it works on](../workflow/tickets.md#which-tickets-are-kodors)                                                                                                                  |
| Who merges          | Status on a pull request | The merge policy: which way it goes, and why                                                                                                                                                          |
| Automated review    | Status on a pull request | The review's Publish: what the review of that commit concluded, and the run's link. "Review verdict" goes by it                                                                                       |
| Review verdict      | Status on a pull request | The job that records the review's verdict: success when the review said ready, an approver overrode it, or the automated review is off                                                                |
| Merge order         | Status on a pull request | The same job, for a ticket across repositories: what the pull request waits for. "Review verdict" waits with it                                                                                       |
| Approval policies   | Status on a pull request | The approval policies' job: `Nothing to approve`, or what each policy found and that it waits for `policy-override` ([Approval policies](../features/approval-policies.md#when-a-pull-request-waits)) |
| kodor files in step | Check on a pull request  | kodor's review workflow: fails when a kodor file differs from what `kodor sync` writes                                                                                                                |

# Specs

For someone deciding how a change their users will see is specified. At
the end you know when a ticket gets a Spec, and whether your repository
keeps a copy of each.

## A change your users will see

A change that adds or alters behavior someone can see, and is not
[small](../workflow/build.md#sizing-the-work-to-the-change), gets the `spec` label, which
refinement adds and the build reads. Refinement writes three things into
its ticket, after your own text:

- **Spec:** what the change must do, as numbered "When this, then that"
  lines, such as "3. When a visitor sends the form with no email, the
  form still sends." To change one, name it by its number where
  refinement asks you, in the session or in a comment on the ticket,
  such as "3: and when the email is not valid, it says so."
- **Design:** where the change goes and the cases it must handle.
- **Tasks:** the steps to build it, each naming the test that checks it.

The design and tasks sit in a collapsed "For the builder" section, so
you can read the Spec and approve the ticket as you approve any other
([From a ticket to a merge](../workflow/README.md#from-a-ticket-to-a-merge)). The build works
from the ticket alone, and its pull request's description lists the
test that checks each Spec line.

A [spec tool](../reference/settings/specs.md#specs), such as OpenSpec, also keeps the
Spec in your repository.

Every other ticket, such as a bug fix, a copy change, or a small change,
has a list of acceptance criteria instead: what must be true for it to
be done.

## On your tools

- [OpenSpec](../integrations/openspec.md)

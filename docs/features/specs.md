# Specs

For someone deciding how a change their users will see is specified. At
the end you know when a ticket gets a Spec, and whether your repository
keeps a copy of each.

## What you get

Each change your users will see is built from a Spec in its ticket, and
its pull request names the test that checks each Spec line.

## What it needs

Nothing: a spec tool is optional.

## Turn it on

The Spec in the ticket needs nothing turned on: refinement writes one
into each ticket that gets the `spec` label.

To keep a copy of each Spec in your repository too, turn a spec tool on.
`factory init` asks "Which spec tool do you use?" when your settings name
none, and installs the one you choose. To turn one on later, write the
line in [Its settings](#its-settings) and run `factory init` again.
**It worked when** init prints that it installed the spec tool, as
[`specs`](../reference/settings/specs.md#specs) shows, and your
`package.json` lists it.

## How it works

### A change your users will see

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

Every other ticket, such as a bug fix, a copy change, or a small change,
has a list of acceptance criteria instead: what must be true for it to
be done.

## Its settings

The one choice is whether your repository keeps a copy of each Spec. To
keep one, write this line in `.claude/factory.yaml`:

```yaml
specs: openspec # each build also writes its ticket's Spec into openspec/specs/
```

Without it, or with `specs: none`, the default, the ticket is the only
copy. [`specs`](../reference/settings/specs.md#specs) has the rest.

## When something goes wrong

What fails is the spec tool's step: its page says what to do, under
[When something goes wrong](../integrations/openspec.md#when-something-goes-wrong).

## On your tools

- [OpenSpec](../integrations/openspec.md)

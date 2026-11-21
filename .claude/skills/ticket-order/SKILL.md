---
name: ticket-order
description: Keep the open tickets' blocked-by relationships complete, and show the order to work them in, those that unblock the most first. Use when the owner asks what to work on next, what order the tickets go in, or what blocks what, when they invoke `/ticket-order` or `/ticket-order N`, and on a ticket a session has just opened with `factory ticket open`.
---

# The order to work tickets in

`factory ticket claim` stops only on a recorded blocker, so a build order
written only in a ticket's text is one nothing reads. This skill finds the
blockers that are missing, records the ones the owner approves, and shows
which tickets can start now, those that unblock the most first.

Every ticket is read and written through `npx --no-install factory ticket`,
never `gh` or a ticket system's API, so the skill works with any ticket
system the factory has an adapter for. It never reads or writes the
board's Priority field: that is the owner's business priority, not a
build order.

With `/ticket-order N`, the ticket is N, and step 2 looks only at N.

## 0. Can the ticket system record blockers?

```bash
npx --no-install factory ticket supports blockers
```

When it prints `no`, say the ticket system records no blockers, and stop.

## 1. The order as it stands

```bash
node .claude/skills/ticket-order/order.mts
```

It prints "Start now", the open tickets with no open blocker, ordered by
how many open tickets each unblocks through chains; "Waiting", each
ticket with an open blocker and what it waits on; and "Problems", each
cycle and each open blocker that is not an open ticket here. With
`--json` it prints the same as one object with `startNow`, `waiting`, and
`problems`. A failed read exits nonzero with the error: report it and
stop, since an order it could not read is not an order.

## 2. What is missing, and what no longer holds

Read each open ticket's title and body, and its comments where they say
why it waits on another:

```bash
npx --no-install factory ticket list --json
npx --no-install factory ticket view M
```

A ticket waits on another when building it first would break it, or
would mean redoing work, as "Issues that wait on another" in
`.claude/factory/rules.md` says. Touching the same file is not one: that
is a merge conflict, and the conflict sweep resolves those. Read the code
a ticket would change when its text alone does not settle it.

Propose, each with a one-line reason a reader can check:

- each missing link, as "#N waits on #M: reason";
- each recorded link whose reason no longer holds, such as a blocker
  whose ticket was rewritten so it no longer depends on it, as "#N no
  longer waits on #M: reason";
- for each cycle step 1 printed, the link to remove to break it.

With `/ticket-order N`, propose only links that involve N, in both
directions: what N waits on, and which open tickets wait on N.

## 3. Ask, then record

When nothing is proposed, say so, ask nothing, and go to step 4.

Otherwise ask the owner once which proposals to keep: one multi-select
question with `AskUserQuestion` when there are four or fewer, each
option a proposal with its reason as the description, or a numbered list
in a message when there are more, answered with the numbers to keep.

For each kept proposal, record it, then say why on the waiting ticket:

```bash
npx --no-install factory ticket block N --by M     # or: unblock N --by M
npx --no-install factory ticket comment N --body-file reason.md
```

The comment is one line: "Waits on #M: reason." or "No longer waits on
#M: reason." Leave the ticket's body alone; the owner may already have
approved it.

## 4. Report

Run step 1's script again and show its output, then say which links were
recorded and which removed, each on which ticket.

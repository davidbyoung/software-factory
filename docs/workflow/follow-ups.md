# Follow-ups

For someone reading what a session noticed and did not fix. At the end
you know where it lists each one, and how ticking a box turns one into a
ticket.

While a session builds one ticket, it often notices something else. What it
does depends on what it noticed:

| What it noticed                                                                                                                   | What it does                              |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Something small that is part of what it is building, such as a stale sentence on the page it is changing                          | Fixes it in the same pull request         |
| Something else that a user or a maintainer would run into, such as a search test that cannot fail, or a page that is slow to open | Lists it in its pull request: a follow-up |
| Anything else, such as what nobody would notice without measuring it                                                              | Leaves it alone, and doesn't mention it   |

The list is at the end of the pull request's description. It holds three at
most, so a session that found more lists the three that matter most:

```markdown
### Noticed, not fixed

Tick a box, and merging opens a ticket for it. To have one fixed here
instead, say so in a review, such as "fix 1".

1. [ ] **The heading skips a level.** On the About page it goes from level 1
       to level 3. See `src/pages/about.tsx`.
2. [ ] **A search test cannot fail.** It passes even when search returns
       nothing. See `tests/search.spec.ts`.
```

Your code host shows each `[ ]` as a checkbox you can click, on a draft too.
Decide about each one while you review the pull request:

- **To get a ticket for it,** click its checkbox before you merge. You can
  edit its words first: the ticket gets them as they read when you merge.
- **To have it fixed in this pull request,** submit a review, as you would
  for any change you want, and write "fix 1" in it. Leave its checkbox
  empty. In the cloud, that starts
  [an answer](../features/cloud-builds.md#what-a-build-in-the-cloud-does). For a pull request
  built on your computer, the session that built it answers, if it is still
  open. Otherwise start one with `/lunamill-address-review 90`, 90 being the
  pull request's number.
- **To drop it,** leave its checkbox empty. It stays in the description to
  read.

**It worked when** the description says, a few minutes after you merge,
"Opened #101." after each follow-up you ticked. Each new ticket waits in
your backlog until you refine it, with `/lunamill-refine 101`. If one is
missing, open the repository's Actions tab, find the failed run with the job
"Open the ticked tickets", and re-run it. It never opens a ticket twice.

No ticket is opened:

- for a pull request you close without merging, or one
  [that merges itself](merge.md#who-merges) before anyone ticks a box;
- for a pull request from a fork, whose author can edit the description;
- for a box ticked after the merge. Write that ticket yourself.

**Look at the boxes before you merge a pull request built on your
computer.** A session there uses your own account. It is told never to tick
one, but nothing stops it, so clear any box you didn't tick. A session in the
cloud has no account to tick one with.

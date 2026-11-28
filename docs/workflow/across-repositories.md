# A ticket across repositories

For a developer whose ticket needs a change in more than one repository,
such as an API and the website that calls it. At the end, the ticket has
one pull request in each repository, they merge in the order you chose,
and the ticket closes itself when the last one merges.

A ticket that changes only its own repository needs nothing on this page.

The examples are Dev's, at `acme`. Ticket `#12`, "Add gift cards to
checkout", lives in `acme/api`. It also changes the checkout page, which is
in `acme/web`. There are three steps: refine the ticket, build it, and
merge its pull requests.

## What you need

- **Each repository set up** with [`lunamill init`](../get-started/quick-start.md). The
  first step below prints which ones are not, and which are on a version of
  Lunamill too old for this.
- **The same owner for all of them.** A ticket can't span two accounts or
  two organizations.
- **A board or builds in the cloud, set up in each one**
  ([Which setup is yours](../setup/README.md)). Either stores an access token,
  which is how one repository's checks see another's pull requests. Without
  it you still refine and build this way, and you get every pull request.
  But nothing [holds a merge](#merge-them), and you close the ticket
  yourself.
- **Write access to each one,** to make the list, and to build on your
  machine. A build in the
  cloud uses [the account builds act as](../features/cloud-builds.md#what-a-build-in-the-cloud-does)
  in place of yours.

## Refine it

In your coding agent, in a checkout of `acme/api`:

```text
/lunamill-refine 12
```

When the agent finds that the ticket touches another repository, or the
ticket names one, it asks:

```text
Which repositories does #12 touch?
  1. acme/api and acme/web (Recommended): the ticket names the checkout page, which is in acme/web
  2. acme/api only
  Other: name them

Does one have to merge first?
  1. acme/api, then acme/web (Recommended): the checkout page calls the new endpoint
  2. Any order
```

If it doesn't ask, and the ticket does touch another, record the list
yourself with the commands under [Changing the list](#changing-the-list).
Either way, this is printed:

```text
#12 repositories
  ✓ acme/api   set up
  ✗ acme/web   not set up: run lunamill init in acme/web before building
Recorded on #12. acme/web merges after acme/api.
```

A repository on a version of Lunamill too old for this shows its own fix:

```text
  ✗ acme/web   on Lunamill 0.9.0, which can't build a ticket from another repository: run lunamill update in acme/web
```

Refinement goes on past a ✗. A build refuses to start until you have done
what the line says: run the command it names in that repository, and merge
the pull request it opens there. Then run `lunamill ticket repositories 12`
to check again.

**It worked when** every line shows ✓, and the ticket's description has
this section:

```markdown
## Repositories

- acme/api
- acme/web, after acme/api
```

### Changing the list

| What you want to do            | Command                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| See the list                   | `lunamill ticket repositories 12`                                                   |
| Replace the list and its order | `lunamill ticket repositories 12 --set acme/api acme/web --after acme/web=acme/api` |
| Add a repository               | `lunamill ticket repositories 12 --add acme/mobile --after acme/mobile=acme/api`    |

`--after acme/web=acme/api` means that `acme/web` merges after `acme/api`.
Give it once for each pair, or leave it out where the order doesn't matter.
`--add` keeps the order already there, and `--set` replaces it. The list
need not hold the ticket's own repository. When it holds only that one, the
section is taken out of the ticket.

Change the list with these, not by hand. They record that someone who can
write to every repository on the list made it. A list that was edited in
the description, or made by someone who can't write to one of them, stops a
build with this, until someone who can runs the command it names:

```text
✗ #12's repositories were not confirmed by someone who can write to acme/web: run lunamill ticket repositories 12 --set acme/api acme/web --after acme/web=acme/api
```

## Build it on your machine

In your coding agent, in a checkout of a repository the ticket names:

```text
/lunamill-build 12
```

A bare number is always the ticket of the repository you are in. From a
checkout of `acme/web`, write `/lunamill-build acme/api#12`.

It stops before it starts when a repository isn't ready:

```text
✗ #12 names acme/web, which is not set up: run lunamill init in acme/web
```

One session builds every repository, one after another in the order they
merge, whichever one you opened it in. It clones the ones you are not in
under `~/.local/share/lunamill/work/`, and says where. Each gets its
own rules, gate, and reviewers, and its own pull request.

**It worked when** the session's report names a pull request in each
repository, and `lunamill status` lists them all
([When it's done](#when-its-done)).

The session deletes the clones once their pull requests merge or close. It
keeps one with commits that were never pushed. Once the ticket is closed,
`lunamill status` ends with a line for each clone still there:

```text
? acme/web is still cloned for acme/api#12: /home/dev/.local/share/lunamill/work/acme/api-12/web. Run: lunamill workspace acme/api#12 --remove
```

## Build it in the cloud

In a checkout of the ticket's own repository:

```bash
lunamill build 12
```

From a checkout of another of its repositories, run
`lunamill build acme/api#12`. Where
[`builds.trigger`](../reference/settings/builds.md#builds) in the ticket's own repository
is `own-server` or `github-action`, moving the ticket to Ready does the
same. Where it is `manual`, the default, that starts nothing.

The repositories are built one at a time, in the order they merge. Each is
an ordinary [build in the cloud](../features/cloud-builds.md#what-a-build-in-the-cloud-does)
in its own repository, with that repository's secrets and setup. When one
opens its pull request, it starts the next, which is given a copy of the
earlier ones' code to read.

Nothing waits for you until the last one ends. `lunamill status` shows which
is running. **It worked when** the ticket has a comment like this for each
repository but the last, and the last has a pull request:

```text
Built in acme/api: acme/api#88. Starting the build in acme/web.
```

Two things end it early:

- **An earlier pull request has to change.** A session in the cloud changes
  only its own repository. It says on the ticket what has to change, and
  leaves its own pull request a draft. On your code
  host, submit a review of any kind on the earlier pull request that says
  what to change, which starts an answer to it. Once that has been pushed,
  mark the draft ready. Any repository after it is already being built.
- **Some of the repositories are private, and others public.** A session
  that read private code would write in public. The ticket gets this, and
  you build it on your machine, where you see what is pushed:

  ```text
  acme/web is public and acme/api is private, so no build in the cloud reads both: build it on your computer
  ```

## Merge them

Merge each pull request as you would any other. One that waits for another
has two checks that say so. "Merge order" is a status only these pull
requests get, and it says why.
["Review verdict"](../reference/glossary.md#the-words) is the one that stops the merge:

```text
Merge order      Waits for acme/api#88 to merge        pending
Review verdict   Waits for acme/api#88 to merge        pending
```

Within a few minutes of `acme/api#88` merging, both update by themselves,
and "Review verdict" shows what the review found. A push to `acme/web#41`
updates them too.

In a repository with [`pr-review`](../reference/settings/pr-review.md#pr-review) off, "Review
verdict" isn't required, so your code host lets you merge at any time.
"Merge order" then only tells you whether it is time.

A pull request that is part of a ticket across repositories never merges
itself, even where [`auto-merge`](../reference/settings/auto-merge.md#auto-merge) is on and
every file in it is listed there. You merge it.

## When it's done

The ticket is [In review](README.md#the-six-states) once every repository
has a pull request open or merged. It closes when the last one merges.

```console
$ lunamill status
In review  1
  #12  Add gift cards to checkout              2h   $3.10   local 502d66cf
       ↳ Pull request acme/api#88 · ready for review · checks passing · no open threads
       ↳ Pull request acme/web#41 · ready for review · checks pending · no open threads · waits for acme/api#88
```

| Your situation                                          | What to do                                                                                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| You closed one pull request without merging it          | The ticket is back In progress, waiting on you. Build it again: only that repository is built, with a new pull request                                                |
| A repository turns out not to be needed                 | Drop it with `--set`, and close its pull request. The ticket closes when the rest have merged                                                                         |
| You added a repository after the build                  | The ticket is back In progress. Build it again: only the added repository is built                                                                                    |
| You reopened the ticket after it closed                 | Refine it again if its text changed, then build it. Every repository it names is built, since the pull requests that merged before it closed no longer count          |
| `acme/web`'s CI can't pass until `acme/api` is deployed | Merge and deploy `acme/api`, then run the failed checks of `acme/web`'s pull request again. Its build leaves it a draft while they fail. Mark it ready once they pass |

## Who can do what

| What                                                        | Who                                                   |
| ----------------------------------------------------------- | ----------------------------------------------------- |
| Make or change the list of repositories                     | Someone who can write to every repository on it       |
| Answer refinement's questions, and approve or start a build | Anyone who can write to the ticket's own repository   |
| Review and merge a pull request                             | The people of its own repository, as any pull request |

# Features

For someone whose first tickets are built and who wants more from lunamill. Each feature is optional and stands alone. `lunamill init` offers
the first five in the table, from the automated review to pull requests
that merge themselves, as parts you check: run it again and check the ones
you want ([Set up a repository](../setup/repository.md)). When you check
builds that start from the board, it asks whether the poller runs on a
schedule in the cloud or on a server you host. Each other feature's page
says how to turn it on. A [session](../reference/glossary.md#the-words) is
one conversation with your coding agent, and the cloud runner is where
work runs with nobody at the keyboard.

| Feature                                                      | What you get                                                                                                      | What it needs                                                                          | Where it runs                               |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------- |
| [The automated review](automated-review.md)                  | An agent reviews every pull request marked ready, and passes it or asks for changes. A merge waits for its pass   | A cloud runner, and your coding agent's token stored for it                            | In the cloud                                |
| [The board](board.md)                                        | Every ticket's state, the session that has it, and its cost, in one view kept up to date                          | A board, and a token that can write to it                                              | In the cloud, after each change to a ticket |
| [Builds in the cloud](cloud-builds.md)                       | `lunamill build 12` builds ticket 12 with no session open on your machine                                         | A cloud runner, your coding agent's token, and a token for your code host              | In the cloud                                |
| [Builds that start from the board](builds-from-the-board.md) | Moving a ticket to Ready builds it: the poller, a small program, checks the board and starts the build            | The board, and builds in the cloud                                                     | In the cloud, on a schedule                 |
| [Pull requests that merge themselves](auto-merge.md)         | A pull request that changes only files matching patterns you list, such as `docs/**`, merges once its checks pass | The patterns, and a token for your code host                                           | In the cloud                                |
| [Host the poller](hosting-the-poller.md)                     | Builds start within a minute of the move, in place of at the next scheduled pass                                  | Builds that start from the board, and a server you run                                 | On your server                              |
| [Approval policies](approval-policies.md)                    | A pull request waits for a person's yes when a check you wrote finds something in it                              | A cloud runner                                                                         | In the cloud, on every pull request         |
| [The credentials policy](credentials-policy.md)              | A change that adds a credential, or lets a workflow do more, is read by an agent and waits for a person           | A cloud runner. Every repository has the policy, with nothing to write                 | In the cloud, on every pull request         |
| [Specs](specs.md)                                            | Each change your users see is built from a spec, kept in your repository if you choose                            | A spec tool, only to keep specs in your repository                                     | In each build                               |
| [Dependency updates](dependency-updates.md)                  | The pull requests your dependency bot opens are moved along to merged                                             | A cloud runner, and a dependency bot: a tool that opens a pull request for each update | In the cloud, three times a day             |
| [Website review](website-review.md)                          | Pictures of your pages before and after a change, which an agent reviews for usability and design                 | A repository that is a website, and a browser for its tests                            | In your session                             |

Each page ends with a link to the
[integration page](../integrations/README.md) of each tool the feature
uses.

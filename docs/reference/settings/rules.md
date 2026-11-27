# `rules`

Two numbers the factory's rules use, for a repository that wants
different ones. Run `factory sync` after changing one, since it writes the
number into the rules and skills that use it.

```yaml
rules:
  small-change-lines: 30
  review-rounds: 2
```

| Setting              | What it sets                                                                                                                                                                                  | Default |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `small-change-lines` | How many changed lines, outside tests, specs, and content, a change can have and still count as [small](../../workflow/build.md#sizing-the-work-to-the-change), which skips the heavier steps | `30`    |
| `review-rounds`      | How many rounds of review comments are answered, on your machine and in the cloud, before what is left is handed to you                                                                       | `2`     |

Each must be a whole number above zero. Any rule that isn't a number, you
change by saying so in your own instructions for the coding agent, such as
`CLAUDE.md`, which win over the factory's rules.

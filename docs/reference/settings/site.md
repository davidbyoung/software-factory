# `site`

How Lunamill looks at your website, if your repository is one. With
`site` set and `lunamill-ui-reviewer` listed under
[`plugins.build.reviewers`](plugins.md#pluginsbuild), every change that alters how
the site looks is screenshotted before and after, and the difference is
reviewed. The screenshots are taken with Playwright, so install it in
your repository first, with `npm install -D playwright`. Until you do,
`lunamill config check` fails on a file with `site`.

Most sites need only two lines:

```yaml
site:
  start: npm run build && npx serve out -p $PORT
  url: http://localhost:$PORT
```

**It worked when** `lunamill site compare` builds your branch and the
default branch, takes the screenshots, and prints where it saved them.
[`lunamill site`](../../features/website-review.md#lunamill-site) has the details.

Every setting `site` takes:

| Setting         | What it sets                                                                                                      | Default                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `start`         | A command that builds and serves the site, with `$PORT` set for it. Required                                      | none                                                                 |
| `url`           | The address `start` serves the site at. Required                                                                  | none                                                                 |
| `design-guide`  | A file of your own design rules, checked on top of Lunamill's                                                     | none                                                                 |
| `pages`         | A list of paths to look at                                                                                        | The pages in `/sitemap.xml`, or else the ones the home page links to |
| `widths`        | A list of screen widths, in pixels                                                                                | `[390, 1280]`                                                        |
| `hide`          | A list of CSS selectors hidden before each screenshot, for something that floats over the page                    | none                                                                 |
| `checks`        | A list of your own measuring commands, described below                                                            | none                                                                 |
| `max-pages`     | How many changed pages the reviewer reads closely                                                                 | `4`                                                                  |
| `start-minutes` | How long to wait for the site to answer after `start` runs                                                        | `5`                                                                  |
| `accessibility` | The WCAG level changed pages are checked against: `wcag22aa`, `wcag21aa`, `wcag2aa`, or `none`                    | `wcag22aa`                                                           |
| `new-values`    | Whether the review points out font sizes, colors, spacing, and corner radii that the rest of the site doesn't use | `true`                                                               |

**`site` can be a list,** with one site for each web app in the
repository. Give each `in`, its folder, and `files` as for
[commands for some folders](commands.md#commands-for-some-folders). `start` runs in
the site's folder, and `lunamill site compare` takes screenshots of each
site a change touches, one after another:

```yaml
site:
  - start: npm run build && npx serve out -p $PORT
    url: http://localhost:$PORT
    in: [apps/web, apps/admin]
    files: [./**, packages/ui/**]
```

The optional ones that take a list are written like this:

```yaml
site:
  start: npm run build && npx serve out -p $PORT
  url: http://localhost:$PORT
  pages:
    - /
    - /pricing
  hide:
    - .chat-widget
  checks:
    - node scripts/check-tap-targets.mjs
```

**A command under `checks`** is given one JSON object on its standard
input: `before` and `after`, the two sites' addresses; `pages`, the paths
that changed; and `report`, the folder of screenshots. Each line it prints
is reported as a finding. Its exit code is ignored.

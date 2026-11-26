# site-compare Specification

## Purpose

A list of sites under `site`, each with `in` and `files`, and how `factory site compare` chooses and pictures the sites a change touches.

## Requirements

### Requirement: A list of sites

The factory SHALL behave as this line says: When `site` is a list, each entry is a site with today's keys plus `in` and `files`, and an entry with several folders is one site for each.

#### Scenario: A list of sites

- **WHEN** When `site` is a list
- **THEN** each entry is a site with today's keys plus `in` and `files`, and an entry with several folders is one site for each.

### Requirement: A site in a list without in

The factory SHALL behave as this line says: When `site` lists more than one site and one has no `in`, `factory config check` fails naming it.

#### Scenario: A site in a list without in

- **WHEN** When `site` lists more than one site and one has no `in`
- **THEN** `factory config check` fails naming it.

### Requirement: Site compare with several sites

The factory SHALL behave as this line says: When `factory site compare` runs with several sites, it compares each site the change sets off, one after another, after `site: P of S pictured, for the K files changed since origin/DEFAULT` and one row per site with its reason, and saves each site's pictures under `node_modules/.cache/factory/site/TIMESTAMP/FOLDER`.

#### Scenario: Site compare with several sites

- **WHEN** When `factory site compare` runs with several sites
- **THEN** it compares each site the change sets off, one after another, after `site: P of S pictured, for the K files changed since origin/DEFAULT` and one row per site with its reason, and saves each site's pictures under `node_modules/.cache/factory/site/TIMESTAMP/FOLDER`.

### Requirement: Site compare pictures every site

The factory SHALL behave as this line says: When the gate has an item and a file nothing covers or a settings file changed, `factory site compare` pictures every site, after `site: all S pictured, since` and the reason as lines 31 and 32 word it.

#### Scenario: Site compare pictures every site

- **WHEN** When the gate has an item and a file nothing covers or a settings file changed
- **THEN** `factory site compare` pictures every site, after `site: all S pictured, since` and the reason as lines 31 and 32 word it.

### Requirement: A site's folder

The factory SHALL behave as this line says: When a site has `in`, its `start` and `site.checks` run in its folder, and a `design-guide` starting with `./` is read from it.

#### Scenario: A site's folder

- **WHEN** When a site has `in`
- **THEN** its `start` and `site.checks` run in its folder, and a `design-guide` starting with `./` is read from it.

### Requirement: A site new on the branch

The factory SHALL behave as this line says: When `git ls-tree -d origin/DEFAULT FOLDER` lists nothing, the site's pages are pictured on the branch alone, each as a new page.

#### Scenario: A site new on the branch

- **WHEN** When `git ls-tree -d origin/DEFAULT FOLDER` lists nothing
- **THEN** the site's pages are pictured on the branch alone, each as a new page.

### Requirement: Site compare for one site

The factory SHALL behave as this line says: When `factory site compare --site FOLDER` runs, it compares that site whatever changed. With several sites, `--before URL --after URL` or `--keep` without `--site` is refused, naming `--site`.

#### Scenario: Site compare for one site

- **WHEN** When `factory site compare --site FOLDER` runs
- **THEN** it compares that site whatever changed. With several sites, `--before URL --after URL` or `--keep` without `--site` is refused, naming `--site`.

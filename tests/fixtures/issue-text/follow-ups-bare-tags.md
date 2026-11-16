Small problems noticed while doing other work, one checklist line each, built together as one pull request once approved.

- [ ] /recipes/<slug>/ Print: when a recipe has fewer steps than the chosen page count, the dialog still shows "4 pages" selected, and every count prints the same sheet. Found by the UI reviewer while building #41. Decided (owner, 2026-03-02): hide each count at or above the number of pages the recipe fills.
- [ ] /recipes/<slug>/?diet= Print: the dialog never names the diet filter, so a reader can only tell which set they are printing by comparing counts. Found by the UI reviewer while building #41. Decided (owner, 2026-03-02): the dialog reads "Recipes for <code>" above the list.
- [ ] /recipes/<slug>/?diet= Print: pressing Back while the dialog is open changes the address to the whole list while the dialog stays open. Found by a local session while building #41. Decided (owner, 2026-03-02): leaving the filter closes the dialog.

- [x] src/layout.tsx: opening a recipe with `?diet=` under the dev server shows a hydration warning that the static build does not. Found by a local session while building #40. Fixed in #44.
- [ ] src/components/Menu.tsx: on a desktop with a mouse, clicking the chevron beside "Recipes" closes the panel hover just opened. Found by the UI reviewer while building #40. Needs a decision: should a click on the chevron keep the panel open?

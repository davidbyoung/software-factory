// GitHub Actions' part of setting up and checking kodor: whether
// kodor.yml is enabled, since GitHub switches a workflow with a schedule
// off in a public repository after 60 days with no activity, and a poller
// hosted elsewhere, which `remove` cannot reach. An organization's poller,
// in another repository, is `doctor`'s own check.
import { reasonOf } from "../lib/reason.mts";
import type { ToolSetup } from "../setup.mts";
import { KODOR_WORKFLOW } from "./github-actions.mts";
import type { Runner } from "./types.mts";

export const githubActionsSetup: ToolSetup = {
  checks: async (c) => {
    let state: Awaited<ReturnType<Runner["workflowState"]>>;
    try {
      state = await c.opened.runner.workflowState(KODOR_WORKFLOW);
    } catch (e) {
      return [
        {
          state: "unknown",
          text: `Could not tell whether ${KODOR_WORKFLOW} is enabled: ${reasonOf(e)}`,
        },
      ];
    }
    if (state === "active")
      return [{ state: "pass", text: `${KODOR_WORKFLOW} is enabled` }];
    if (state === "missing")
      return [
        {
          state: "off",
          text: `${KODOR_WORKFLOW} is not on the default branch yet`,
        },
      ];
    return [
      {
        state: "fail",
        text: `${KODOR_WORKFLOW} is disabled`,
        fix: `Enable it on the Actions tab, or run: gh workflow enable ${KODOR_WORKFLOW}`,
      },
    ];
  },

  leftovers: (c) =>
    c.settings?.builds.trigger === "own-server" ? ["The poller you host"] : [],
};

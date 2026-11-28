// GitHub Actions' part of setting up and checking lunamill: whether
// lunamill.yml is enabled, since GitHub switches a workflow with a schedule
// off in a public repository after 60 days with no activity, and a poller
// hosted elsewhere, which `remove` cannot reach. An organization's poller,
// in another repository, is `doctor`'s own check.
import { reasonOf } from "../lib/reason.mts";
import type { ToolSetup } from "../setup.mts";
import { LUNAMILL_WORKFLOW } from "./github-actions.mts";
import type { Runner } from "./types.mts";

export const githubActionsSetup: ToolSetup = {
  checks: async (c) => {
    let state: Awaited<ReturnType<Runner["workflowState"]>>;
    try {
      state = await c.opened.runner.workflowState(LUNAMILL_WORKFLOW);
    } catch (e) {
      return [
        {
          state: "unknown",
          text: `Could not tell whether ${LUNAMILL_WORKFLOW} is enabled: ${reasonOf(e)}`,
        },
      ];
    }
    if (state === "active")
      return [{ state: "pass", text: `${LUNAMILL_WORKFLOW} is enabled` }];
    if (state === "missing")
      return [
        {
          state: "off",
          text: `${LUNAMILL_WORKFLOW} is not on the default branch yet`,
        },
      ];
    return [
      {
        state: "fail",
        text: `${LUNAMILL_WORKFLOW} is disabled`,
        fix: `Enable it on the Actions tab, or run: gh workflow enable ${LUNAMILL_WORKFLOW}`,
      },
    ];
  },

  leftovers: (c) =>
    c.settings?.builds.trigger === "own-server" ? ["The poller you host"] : [],
};

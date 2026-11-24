// GitHub Actions' part of setting up and checking the factory: the
// workflow the scheduled poller is a job of, which GitHub switches off in
// a public repository after 60 days with no activity, and a poller hosted
// elsewhere, which `remove` cannot reach. An organization's poller, in
// another repository, is `doctor`'s own check.
import type { ToolSetup } from "../setup.mts";
import { FACTORY_WORKFLOW as POLLER } from "./github-actions.mts";

export const githubActionsSetup: ToolSetup = {
  checks: async (c) => {
    if (
      c.settings?.builds.trigger !== "github-action" ||
      c.settings.builds.pollerIn
    )
      return [];
    const state = await c.opened.runner.workflowState(POLLER);
    if (state === "active")
      return [{ state: "pass", text: `${POLLER} is enabled` }];
    if (state === "missing")
      return [
        { state: "off", text: `${POLLER} is not on the default branch yet` },
      ];
    return [
      {
        state: "fail",
        text: `${POLLER} is disabled`,
        fix: `Enable it on the Actions tab, or run: gh workflow enable ${POLLER}`,
      },
    ];
  },

  leftovers: (c) =>
    c.settings?.builds.trigger === "own-server" ? ["The poller you host"] : [],
};

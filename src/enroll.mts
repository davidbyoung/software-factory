#!/usr/bin/env node
// Makes the review's verdict required on the default branch, from the first
// run after a repository's setup merges.
//
//   factory enroll
//
// With `pr-review` set, it acts as whoever's token the step gives it as
// GH_TOKEN, which the step names: FACTORY_APP_TOKEN_SET is `true` for a
// token of the organization's app, and FACTORY_BUILD_TOKEN_SET for a
// person's build token. As the app it sets the repository's property to
// `on`, which the organization's rule reads. As a person it makes the
// repository's own rule. With neither, or where the code host refuses, it
// says who does it by hand. It prints nothing when the verdict is already
// required, and exits 0 whatever it could do.
import { NoRulesError, type CodeHost } from "./code-host/types.mts";
import { PROPERTY } from "./init-org.mts";
import { CONTEXT } from "./review-verdict.mts";
import { CONTEXT as APPROVAL } from "./approval-policies.mts";
import { RULE } from "./setup.mts";
import { statusOf } from "./tickets/transport.mts";
import * as say from "./lib/output.mts";

export type Enroll = {
  repository: string;
  /** The default branch. */
  branch: string;
  /** Whether `pr-review` is set. */
  reviewOn: boolean;
  /** Whether the settings have an approval policy. */
  policiesOn?: boolean;
  /** Whose token the run holds: the organization's app's, a person's
   * build token, or neither. */
  as: "app" | "person" | null;
  codeHost: Pick<
    CodeHost,
    "requireCheck" | "requiresStatus" | "properties" | "setProperty"
  >;
};

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Whether a refusal to set a property's value means the repository's
 * owner defines no property of that name. A repository's values do not
 * say: one with no value yet is left out of them, as an undefined one is. */
function noSuchProperty(error: unknown): boolean {
  const status = statusOf(error);
  return status === 404 || status === 422;
}

/** Whose token the workflow's step says the run holds. */
export function holds(env: Record<string, string | undefined>): Enroll["as"] {
  if (env.FACTORY_APP_TOKEN_SET === "true") return "app";
  return env.FACTORY_BUILD_TOKEN_SET === "true" ? "person" : null;
}

/** The lines to print, having done what the run's token can: the
 * verdict's, then the approval policies'. */
export async function enroll(o: Enroll): Promise<string[]> {
  return [
    ...(o.reviewOn ? await enrollVerdict(o) : []),
    ...(o.policiesOn ? await enrollPolicies(o) : []),
  ];
}

/** Requires "Approval policies" in the repository's own rule, beside the
 * verdict. Only a person's token can: the organization's app manages no
 * rules. */
async function enrollPolicies(o: Enroll): Promise<string[]> {
  const settled = await o.codeHost
    .requiresStatus(o.branch, APPROVAL)
    .catch((error) => {
      if (error instanceof NoRulesError) return true;
      throw error;
    });
  if (settled) return [];
  const notRequired = `? "${APPROVAL}" is not required before a merge to ${o.branch}, and this run's token cannot require it. An admin of ${o.repository} runs: factory init`;
  if (o.as !== "person") return [notRequired];
  try {
    await o.codeHost.requireCheck(RULE, APPROVAL, "runner");
  } catch {
    return [notRequired];
  }
  return [
    `✓ Required "${APPROVAL}" before a merge to ${o.branch}, as the rule "${RULE}".`,
  ];
}

async function enrollVerdict(o: Enroll): Promise<string[]> {
  const owner = o.repository.slice(0, o.repository.lastIndexOf("/"));
  const notRequired = `? "${CONTEXT}" is not required before a merge to ${o.branch}, and this run's token cannot require it. An admin of ${o.repository} runs: factory init`;

  if (o.as === "app") {
    const properties: Record<string, unknown> = await o.codeHost
      .properties()
      .catch(() => ({}));
    if (properties[PROPERTY] === "on") return [];
    try {
      await o.codeHost.setProperty(PROPERTY, "on");
      return [
        `✓ Set ${PROPERTY} to "on" for ${o.repository}, so ${owner}'s rule requires "${CONTEXT}" here.`,
      ];
    } catch (error) {
      if (!noSuchProperty(error))
        return [
          `? Could not set ${PROPERTY} to "on" for ${o.repository}: ${message(error)}. An owner of ${owner} sets it under the organization's Settings, Custom properties.`,
        ];
    }
  }

  // Where the owner's plan has no branch rules for the repository, none
  // can be made, by this run or by an admin: there is nothing to say.
  const settled = await o.codeHost
    .requiresStatus(o.branch, CONTEXT)
    .catch((error) => {
      if (error instanceof NoRulesError) return true;
      throw error;
    });
  if (settled) return [];
  if (o.as !== "person") return [notRequired];
  try {
    await o.codeHost.requireCheck(RULE, CONTEXT, "runner");
  } catch {
    return [notRequired];
  }
  return [
    `✓ Required "${CONTEXT}" before a merge to ${o.branch}, as the rule "${RULE}".`,
  ];
}

/** `factory enroll`. */
export async function run(): Promise<number> {
  try {
    const { loadSettings, reachOf, repoRoot } = await import("./config.mts");
    const settings = await loadSettings();
    const policiesOn = settings.approvalPolicies.length > 0;
    if (!settings.prReview && !policiesOn) return 0;
    const { openCodeHost } = await import("./code-host/index.mts");
    const { branchDeps, needDefaultBranch } =
      await import("./lib/default-branch.mts");
    const { repository, codeHost } = await reachOf(
      process.env,
      async () => settings,
    );
    const lines = await enroll({
      repository,
      branch: await needDefaultBranch(branchDeps(repoRoot())),
      reviewOn: settings.prReview,
      policiesOn,
      as: holds(process.env),
      codeHost: openCodeHost(repository, codeHost),
    });
    for (const line of lines) say.plain(line);
    return 0;
  } catch (error) {
    say.plainError(message(error));
    return 1;
  }
}

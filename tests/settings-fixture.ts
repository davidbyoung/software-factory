/** The `code-host` block every settings file needs, as init writes it
 * when its question is answered with the pattern it offers. */
export const CODE_HOST = { type: "github", "branch-name": "{ticket}" } as const;

/** The same block as YAML, at the top of a settings file. */
export const CODE_HOST_YAML =
  'code-host:\n  type: github\n  branch-name: "{ticket}"';

/** `policies` with the factory's own `credentials` policy turned off, for
 * a test about something else, which every repository would otherwise
 * have on. */
export const withoutCredentials = (policies: unknown[] = []) =>
  policies.some((p) => (p as { name?: string }).name === "credentials")
    ? policies
    : [...policies, { name: "credentials", off: true }];

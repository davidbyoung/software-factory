/** The `code-host` block every settings file needs, as init writes it
 * when its question is answered with the pattern it offers. */
export const CODE_HOST = { type: "github", "branch-name": "{ticket}" } as const;

/** The same block as YAML, at the top of a settings file. */
export const CODE_HOST_YAML =
  'code-host:\n  type: github\n  branch-name: "{ticket}"';

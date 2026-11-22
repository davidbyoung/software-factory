// Whether an account can write to a GitHub repository: the one lookup both
// GitHub adapters ask when they decide whose words count as instructions.
import { statusOf, type Transport } from "./transport.mts";

/** Whether `login` can write to `repository` (owner/name), counting every
 * grant: repository, team, organization, and enterprise. Rejects when
 * GitHub cannot say, so a failed lookup is never read as "yes". */
export async function writeAccess(
  t: Transport,
  repository: string,
  login: string,
): Promise<boolean> {
  const API = `repos/${repository}`;
  try {
    const answer = await t.rest<{ permission: string }>(
      "GET",
      `${API}/collaborators/${encodeURIComponent(login)}/permission`,
    );
    return answer.permission === "admin" || answer.permission === "write";
  } catch (error) {
    if (statusOf(error) !== 404) throw error;
    // A token that cannot see a private repository gets a 404 for every
    // name, so a 404 means "no such account" only when the repository can
    // be read.
    await t.rest("GET", API);
    return false;
  }
}

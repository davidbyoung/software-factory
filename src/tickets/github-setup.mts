// GitHub Issues as the ticket system: the board check, and the fields
// removing the factory leaves on the board. Its token is the code host's.
import { boardConfigOf, inspectBoard } from "../board.mts";
import { fieldNamesOf } from "../config.mts";
import { listed } from "../lib/listed.mts";
import type { ToolSetup } from "../setup.mts";

const INIT = "Run npx --no-install factory init";

export const githubTicketsSetup: ToolSetup = {
  checks: async (c) => {
    const s = c.settings;
    if (s === null || s.tickets.board === null) return [];
    const number = s.tickets.board;
    try {
      const board = await c.opened.tickets.board!.read();
      const { problems } = inspectBoard(board.fields, boardConfigOf(s));
      return [
        problems.length === 0
          ? {
              state: "pass",
              text: `Board ${number} has every column the settings name`,
            }
          : {
              state: "fail",
              text: `Board ${number}: ${problems.join("; ")}`,
              fix: INIT,
            },
      ];
    } catch (e) {
      return [
        {
          state: "fail",
          text: `Board ${number} can be read`,
          fix: e instanceof Error ? e.message : String(e),
        },
      ];
    }
  },

  leftovers: (c) => {
    const s = c.settings;
    if (s === null || s.tickets.board === null) return [];
    const fields = Object.values(fieldNamesOf(s)).filter(
      (f): f is string => f !== null,
    );
    return fields.length
      ? [
          `Delete the ${listed(fields)} field${fields.length === 1 ? "" : "s"} from board ${s.tickets.board}, if you do not want them`,
        ]
      : [];
  },
};

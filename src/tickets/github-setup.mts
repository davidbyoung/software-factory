// GitHub Issues as the ticket system: the board check, and the fields
// removing the factory leaves on the board. Its token is the code host's.
import { boardConfigOf, inspectBoard } from "../board.mts";
import { fieldNamesOf } from "../config.mts";
import { listed } from "../lib/listed.mts";
import { TICKET_LABELS } from "../labels.mts";
import type { ToolSetup } from "../setup.mts";

const INIT = "Run factory init";

export const githubTicketsSetup: ToolSetup = {
  checks: async (c) => {
    const s = c.settings;
    if (s === null || s.tickets.board === null) return [];
    const number = s.tickets.board;
    try {
      const board = await c.opened.tickets.board!.read();
      const { problems } = inspectBoard(
        board.fields,
        boardConfigOf(s),
        board.columnField,
      );
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
    const labels = s?.tickets.labels ?? TICKET_LABELS;
    const lines = [
      `Delete whichever of the labels ${listed([labels["follow-up"], labels.spec, labels.factory])} exist, if you do not want their history: deleting one takes it off every ticket`,
    ];
    if (s === null || s.tickets.board === null) return lines;
    const fields = Object.values(fieldNamesOf(s)).filter(
      (f): f is string => f !== null,
    );
    if (fields.length)
      lines.push(
        `Delete the ${listed(fields)} field${fields.length === 1 ? "" : "s"} from board ${s.tickets.board}, if you do not want them`,
      );
    return lines;
  },
};

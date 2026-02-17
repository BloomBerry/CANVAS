import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendCommandToFigma } from "../common/websocket.js";
import {
  createErrorResponse,
  createSuccessResponse,
} from "../common/utils.js";

export function registerSlideTools(server: McpServer) {
  // ─── create_slide ───────────────────────────────────────────────────
  server.tool(
    "create_slide",
    "Create a new slide in the presentation. Optionally specify position in the grid (row, column).",
    {
      name: z
        .string()
        .optional()
        .describe("Optional name for the new slide"),
      row: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Row position in the slide grid (0-indexed)"),
      column: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Column position in the slide grid (0-indexed)"),
    },
    async ({ name, row, column }) => {
      try {
        const result = await sendCommandToFigma("create_slide", {
          name,
          row,
          column,
        });
        return createSuccessResponse({
          messages: [
            `Created slide "${result.name}" with ID: ${result.id}`,
          ],
          dataItem: result,
        });
      } catch (error) {
        return createErrorResponse({ error, context: "create_slide" });
      }
    }
  );

  // ─── delete_slide ───────────────────────────────────────────────────
  server.tool(
    "delete_slide",
    "Delete a slide by its ID.",
    {
      slideId: z.string().describe("The ID of the slide to delete"),
    },
    async ({ slideId }) => {
      try {
        const result = await sendCommandToFigma("delete_slide", { slideId });
        return createSuccessResponse({
          messages: [`Deleted slide "${result.name}" (ID: ${result.id})`],
          dataItem: result,
        });
      } catch (error) {
        return createErrorResponse({ error, context: "delete_slide" });
      }
    }
  );

  // ─── clone_slide ────────────────────────────────────────────────────
  server.tool(
    "clone_slide",
    "Clone an existing slide to create a duplicate.",
    {
      slideId: z.string().describe("The ID of the slide to clone"),
    },
    async ({ slideId }) => {
      try {
        const result = await sendCommandToFigma("clone_slide", { slideId });
        return createSuccessResponse({
          messages: [
            `Cloned slide (original: ${result.originalId}) -> new slide "${result.newName}" (ID: ${result.newId})`,
          ],
          dataItem: result,
        });
      } catch (error) {
        return createErrorResponse({ error, context: "clone_slide" });
      }
    }
  );

  // ─── focus_slide ────────────────────────────────────────────────────
  server.tool(
    "focus_slide",
    "Navigate to and focus on a specific slide.",
    {
      slideId: z
        .string()
        .describe("The ID of the slide to navigate to and focus on"),
    },
    async ({ slideId }) => {
      try {
        const result = await sendCommandToFigma("focus_slide", { slideId });
        return createSuccessResponse({
          messages: [
            `Focused on slide "${result.name}" (ID: ${result.id})`,
          ],
          dataItem: result,
        });
      } catch (error) {
        return createErrorResponse({ error, context: "focus_slide" });
      }
    }
  );

  // ─── get_focused_slide ──────────────────────────────────────────────
  server.tool(
    "get_focused_slide",
    "Get information about the currently focused slide.",
    {},
    async () => {
      try {
        const result = await sendCommandToFigma("get_focused_slide", {});
        if (!result) {
          return createSuccessResponse({
            messages: ["No slide is currently focused."],
            dataItem: { focused: false },
          });
        }
        return createSuccessResponse({
          messages: [
            `Currently focused slide: "${result.name}" (ID: ${result.id})`,
          ],
          dataItem: result,
        });
      } catch (error) {
        return createErrorResponse({ error, context: "get_focused_slide" });
      }
    }
  );

  // ─── get_slide_grid ─────────────────────────────────────────────────
  server.tool(
    "get_slide_grid",
    "Get the complete slide grid structure with all slides organized by rows.",
    {},
    async () => {
      try {
        const result = await sendCommandToFigma("get_slide_grid", {});
        return createSuccessResponse({
          messages: [
            `Slide grid: ${result.totalSlides} slides in ${result.rows} rows x ${result.columns} columns`,
          ],
          dataItem: result,
        });
      } catch (error) {
        return createErrorResponse({ error, context: "get_slide_grid" });
      }
    }
  );

  // ─── get_all_slides ─────────────────────────────────────────────────
  server.tool(
    "get_all_slides",
    "Get information about all slides in the presentation.",
    {},
    async () => {
      try {
        const result = await sendCommandToFigma("get_all_slides", {});
        return createSuccessResponse({
          messages: [`Found ${result.count} slides on the current page.`],
          dataItem: result,
        });
      } catch (error) {
        return createErrorResponse({ error, context: "get_all_slides" });
      }
    }
  );

  // ─── set_slide_transition ───────────────────────────────────────────
  server.tool(
    "set_slide_transition",
    "Set transition effect for a slide (NONE, SMART_ANIMATE, DISSOLVE, PUSH, SLIDE_IN, SLIDE_OUT, MOVE_IN, MOVE_OUT) with direction, duration, curve, and timing options.",
    {
      slideId: z
        .string()
        .describe("The ID of the slide to set the transition on"),
      type: z
        .enum([
          "NONE",
          "SMART_ANIMATE",
          "DISSOLVE",
          "PUSH",
          "SLIDE_IN",
          "SLIDE_OUT",
          "MOVE_IN",
          "MOVE_OUT",
        ])
        .describe("Transition type"),
      direction: z
        .enum(["LEFT", "RIGHT", "TOP", "BOTTOM"])
        .optional()
        .describe(
          "Transition direction (required for directional transitions like PUSH, SLIDE_IN, etc.)"
        ),
      duration: z
        .number()
        .min(0)
        .optional()
        .describe("Transition duration in milliseconds (default: 300)"),
      easing: z
        .enum([
          "LINEAR",
          "EASE_IN",
          "EASE_OUT",
          "EASE_IN_AND_OUT",
          "EASE_IN_BACK",
          "EASE_OUT_BACK",
          "EASE_IN_AND_OUT_BACK",
          "CUSTOM_BEZIER",
        ])
        .optional()
        .describe(
          "Easing curve for the transition (default: EASE_IN_AND_OUT)"
        ),
    },
    async ({ slideId, type, direction, duration, easing }) => {
      try {
        const result = await sendCommandToFigma("set_slide_transition", {
          slideId,
          type,
          direction,
          duration,
          easing,
        });
        const transitionDesc =
          type === "NONE"
            ? "removed"
            : `${type}${direction ? ` (${direction})` : ""}, ${duration ?? 300}ms`;
        return createSuccessResponse({
          messages: [
            `Transition on slide "${result.name}": ${transitionDesc}`,
          ],
          dataItem: result,
        });
      } catch (error) {
        return createErrorResponse({
          error,
          context: "set_slide_transition",
        });
      }
    }
  );

  // ─── skip_slide ─────────────────────────────────────────────────────
  server.tool(
    "skip_slide",
    "Set whether a slide should be skipped during presentation mode.",
    {
      slideId: z
        .string()
        .describe("The ID of the slide to skip or unskip"),
      skipped: z
        .boolean()
        .describe(
          "Whether the slide should be skipped during presentation (true = skip, false = include)"
        ),
    },
    async ({ slideId, skipped }) => {
      try {
        const result = await sendCommandToFigma("skip_slide", {
          slideId,
          skipped,
        });
        return createSuccessResponse({
          messages: [
            `Slide "${result.name}" is now ${skipped ? "skipped" : "included"} in presentation.`,
          ],
          dataItem: result,
        });
      } catch (error) {
        return createErrorResponse({ error, context: "skip_slide" });
      }
    }
  );

  // ─── get_slide_properties ───────────────────────────────────────────
  server.tool(
    "get_slide_properties",
    "Get all properties of a slide node, including undocumented ones.",
    {
      slideId: z
        .string()
        .describe("The ID of the slide to get properties of"),
    },
    async ({ slideId }) => {
      try {
        const result = await sendCommandToFigma("get_slide_properties", {
          slideId,
        });
        return createSuccessResponse({
          messages: [
            `Retrieved properties for slide "${result.name}" (ID: ${result.id})`,
          ],
          dataItem: result,
        });
      } catch (error) {
        return createErrorResponse({
          error,
          context: "get_slide_properties",
        });
      }
    }
  );

  // ─── get_slide_speaker_notes (DEPRECATED) ───────────────────────────
  server.tool(
    "get_slide_speaker_notes",
    "⛔ DEPRECATED — Figma Plugin API does not support speaker notes. Do not use.",
    {
      slideId: z.string().describe("The ID of the slide"),
    },
    async ({ slideId }) => {
      return createSuccessResponse({
        messages: [
          "DEPRECATED: get_slide_speaker_notes is no longer supported. " +
            "The Figma Slides Plugin API does not provide access to speaker notes. " +
            "This tool will be removed in a future version.",
        ],
        dataItem: {
          deprecated: true,
          slideId,
          speakerNotes: null,
          warning:
            "Speaker notes are not accessible via the Figma Plugin API.",
        },
      });
    }
  );

  // ─── set_slide_speaker_notes (DEPRECATED) ───────────────────────────
  server.tool(
    "set_slide_speaker_notes",
    "⛔ DEPRECATED — Figma Plugin API does not support speaker notes. Do not use.",
    {
      slideId: z.string().describe("The ID of the slide"),
      notes: z.string().describe("The speaker notes text"),
    },
    async ({ slideId, notes }) => {
      return createSuccessResponse({
        messages: [
          "DEPRECATED: set_slide_speaker_notes is no longer supported. " +
            "The Figma Slides Plugin API does not provide write access to speaker notes. " +
            "This tool will be removed in a future version.",
        ],
        dataItem: {
          deprecated: true,
          slideId,
          applied: false,
          warning:
            "Speaker notes cannot be set via the Figma Plugin API.",
        },
      });
    }
  );
}

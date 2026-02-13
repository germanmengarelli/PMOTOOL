import { z } from "zod";

export const phaseEnumSchema = z.enum(["F0", "F1", "F2", "F3", "F4", "F5", "F6"]);

export const phaseAdvanceInputSchema = z.object({
  projectId: z.string().min(1),
  toPhase: phaseEnumSchema,
});

export type PhaseAdvanceInput = z.infer<typeof phaseAdvanceInputSchema>;
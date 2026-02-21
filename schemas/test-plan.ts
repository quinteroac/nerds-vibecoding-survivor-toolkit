import { z } from "zod";

export const TestPlanSchema = z.object({
  scope: z.array(z.string()),
  automatedTests: z.array(z.string()),
  exploratoryManualTests: z.array(z.string()),
  environmentAndData: z.array(z.string()),
});

export type TestPlan = z.infer<typeof TestPlanSchema>;

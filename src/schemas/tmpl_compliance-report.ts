import { z } from "zod";

/**
 * Assessment value for each FR and US.
 * Equivalent labels in Spanish: cumple / parcialmente cumple / no cumple.
 */
export const ComplianceAssessmentSchema = z.enum([
  "comply",
  "partially_comply",
  "does_not_comply",
]);
export type ComplianceAssessment = z.infer<typeof ComplianceAssessmentSchema>;

const VerificationByFrEntrySchema = z.object({
  frId: z.string().min(1),
  assessment: ComplianceAssessmentSchema,
});

const VerificationByUsEntrySchema = z.object({
  usId: z.string().min(1),
  assessment: ComplianceAssessmentSchema,
});

/**
 * Mandatory structure for the audit compliance report (US-002).
 * The agent must produce a report with these sections so that the user
 * receives a consistent summary and per-FR / per-US verification.
 */
export const ComplianceReportSchema = z.object({
  executiveSummary: z.string(),
  verificationByFr: z.array(VerificationByFrEntrySchema),
  verificationByUs: z.array(VerificationByUsEntrySchema),
  minorObservations: z.array(z.string()),
  conclusionsAndRecommendations: z.string(),
});

export type ComplianceReport = z.infer<typeof ComplianceReportSchema>;

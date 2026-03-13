import { z } from "zod";

import { ComplianceAssessmentSchema } from "./compliance-report";

const VerificationByFrEntrySchema = z.object({
  frId: z.string().min(1),
  assessment: ComplianceAssessmentSchema,
});

const VerificationByUsEntrySchema = z.object({
  usId: z.string().min(1),
  assessment: ComplianceAssessmentSchema,
});

const RefactorPlanItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

const RefactorPlanSchema = z.object({
  mandatoryItems: z.array(RefactorPlanItemSchema),
  optionalItems: z.array(RefactorPlanItemSchema),
});

/**
 * Runtime schema for the JSON audit artifact written as
 * `.agents/flow/it_{iteration}_audit.json`.
 *
 * This mirrors the scaffold schema so that external tooling can
 * validate and consume audit artifacts in a type-safe way.
 */
export const AuditArtifactSchema = z.object({
  iteration: z.string().min(1),
  executiveSummary: z.string(),
  verificationByFR: z.array(VerificationByFrEntrySchema),
  verificationByUS: z.array(VerificationByUsEntrySchema),
  minorObservations: z.array(z.string()),
  conclusionsAndRecommendations: z.string(),
  refactorPlan: RefactorPlanSchema,
});

export type AuditArtifact = z.infer<typeof AuditArtifactSchema>;


import {
  ComplianceReportSchema,
  type ComplianceReport,
} from "./schemas/tmpl_compliance-report";

export { ComplianceReportSchema, type ComplianceReport } from "./schemas/tmpl_compliance-report";
export type { ComplianceAssessment } from "./schemas/tmpl_compliance-report";

/**
 * Validates that data conforms to the mandatory compliance report structure (US-002).
 * Uses safeParse per project conventions.
 */
export function validateComplianceReport(
  data: unknown,
): { success: true; data: ComplianceReport } | { success: false; error: { message: string } } {
  const result = ComplianceReportSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const first = result.error.issues[0];
  const message = first
    ? `${first.path.join(".")}: ${first.message}`
    : result.error.message;
  return { success: false, error: { message } };
}

import { describe, expect, test } from "bun:test";
import {
  ComplianceReportSchema,
  validateComplianceReport,
} from "./compliance-report";

const validReport = {
  executiveSummary: "All requirements verified.",
  verificationByFr: [
    { frId: "FR-1", assessment: "comply" as const },
    { frId: "FR-2", assessment: "partially_comply" as const },
  ],
  verificationByUs: [
    { usId: "US-001", assessment: "comply" as const },
    { usId: "US-002", assessment: "does_not_comply" as const },
  ],
  minorObservations: ["Minor note one."],
  conclusionsAndRecommendations: "Proceed to refactor.",
};

describe("compliance report (US-002)", () => {
  describe("US-002-AC01: report includes mandatory sections", () => {
    test("valid report has executive summary, verification by FR, verification by US, minor observations, conclusions and recommendations", () => {
      const result = validateComplianceReport(validReport);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.executiveSummary).toBe("All requirements verified.");
        expect(result.data.verificationByFr).toHaveLength(2);
        expect(result.data.verificationByUs).toHaveLength(2);
        expect(result.data.minorObservations).toEqual(["Minor note one."]);
        expect(result.data.conclusionsAndRecommendations).toBe(
          "Proceed to refactor.",
        );
      }
    });

    test("rejects when executive summary is missing", () => {
      const { executiveSummary: _, ...rest } = validReport;
      const result = validateComplianceReport(rest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("executiveSummary");
      }
    });

    test("rejects when verificationByFr is missing", () => {
      const { verificationByFr: _, ...rest } = validReport;
      const result = validateComplianceReport(rest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("verificationByFr");
      }
    });

    test("rejects when verificationByUs is missing", () => {
      const { verificationByUs: _, ...rest } = validReport;
      const result = validateComplianceReport(rest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("verificationByUs");
      }
    });

    test("rejects when minorObservations is missing", () => {
      const { minorObservations: _, ...rest } = validReport;
      const result = validateComplianceReport(rest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("minorObservations");
      }
    });

    test("rejects when conclusionsAndRecommendations is missing", () => {
      const { conclusionsAndRecommendations: _, ...rest } = validReport;
      const result = validateComplianceReport(rest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("conclusionsAndRecommendations");
      }
    });
  });

  describe("US-002-AC02: each FR and US explicitly assessed with comply / partially_comply / does_not_comply", () => {
    test("accepts comply, partially_comply, and does_not_comply for FR and US", () => {
      const result = validateComplianceReport(validReport);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.verificationByFr[0].assessment).toBe("comply");
        expect(result.data.verificationByFr[1].assessment).toBe(
          "partially_comply",
        );
        expect(result.data.verificationByUs[0].assessment).toBe("comply");
        expect(result.data.verificationByUs[1].assessment).toBe(
          "does_not_comply",
        );
      }
    });

    test("rejects invalid assessment value for FR", () => {
      const invalid = {
        ...validReport,
        verificationByFr: [{ frId: "FR-1", assessment: "unknown" }],
      };
      const result = validateComplianceReport(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toMatch(/assessment|comply|partially|does_not/);
      }
    });

    test("rejects invalid assessment value for US", () => {
      const invalid = {
        ...validReport,
        verificationByUs: [{ usId: "US-001", assessment: "cumple" }],
      };
      const result = validateComplianceReport(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toMatch(/assessment|comply|partially|does_not/);
      }
    });

    test("schema allows empty verification arrays", () => {
      const minimal = {
        ...validReport,
        verificationByFr: [],
        verificationByUs: [],
        minorObservations: [],
      };
      const result = ComplianceReportSchema.safeParse(minimal);
      expect(result.success).toBe(true);
    });
  });

  describe("US-002-AC03: typecheck / lint", () => {
    test("validateComplianceReport returns typed data on success", () => {
      const result = validateComplianceReport(validReport);
      expect(result.success).toBe(true);
      if (result.success) {
        const _: string = result.data.executiveSummary;
        const __: Array<{ frId: string; assessment: "comply" | "partially_comply" | "does_not_comply" }> =
          result.data.verificationByFr;
        expect(_).toBeDefined();
        expect(__).toBeDefined();
      }
    });
  });
});

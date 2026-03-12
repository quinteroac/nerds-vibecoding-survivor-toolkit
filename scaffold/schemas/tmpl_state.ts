import { z } from "zod";

const iterationId = z.string().regex(/^\d{6}$/);
const phase = z.enum(["define", "prototype", "refactor"]);
const iso8601 = z.string(); // TODO: tighten to ISO 8601 regex if desired

const statusFile = z.object({
  status: z.string(),
  file: z.string().nullable(),
});

const definePhase = z.object({
  requirement_definition: z.object({
    status: z.enum(["pending", "in_progress", "approved"]),
    file: z.string().nullable(),
  }),
  prd_generation: z.object({
    status: z.enum(["pending", "completed"]),
    file: z.string().nullable(),
  }),
});

const prototypePhase = z.object({
  prototype_creation: statusFile.extend({
    status: z.enum(["pending", "in_progress", "completed"]),
  }).optional(),
  prototype_audit: statusFile.extend({
    status: z.enum(["pending", "in_progress", "completed", "failed"]),
  }).optional(),
  prototype_refactor: statusFile.extend({
    status: z.enum(["pending", "in_progress", "completed"]),
  }).optional(),
  prototype_approval: statusFile.extend({
    status: z.enum(["pending", "approved"]),
  }).optional(),
  // DEPRECATED: kept for backward compatibility with older command flows.
  project_context: statusFile.extend({
    status: z.enum(["pending", "pending_approval", "created"]),
  }).optional(),
  // DEPRECATED: kept for backward compatibility with older command flows.
  test_plan: statusFile.extend({
    status: z.enum(["pending", "pending_approval", "created"]),
  }).optional(),
  // DEPRECATED: kept for backward compatibility with older command flows.
  tp_generation: z.object({
    status: z.enum(["pending", "created"]),
    file: z.string().nullable(),
  }).optional(),
  // DEPRECATED: replaced by prototype_creation.
  prototype_build: statusFile.extend({
    status: z.enum(["pending", "in_progress", "created"]),
  }).optional(),
  // DEPRECATED: kept for backward compatibility with older command flows.
  test_execution: statusFile.extend({
    status: z.enum(["pending", "in_progress", "completed", "failed"]),
  }).optional(),
  // DEPRECATED: replaced by prototype_approval.
  prototype_approved: z.boolean().optional(),
});

// DEPRECATED: legacy phase, kept for backward compatibility with older command flows.
const refactorPhase = z.object({
  evaluation_report: z.object({
    status: z.enum(["pending", "created"]),
    file: z.string().nullable(),
  }).optional(),
  refactor_plan: z.object({
    status: z.enum(["pending", "pending_approval", "approved"]),
    file: z.string().nullable(),
  }).optional(),
  refactor_execution: z.object({
    status: z.enum(["pending", "in_progress", "completed"]),
    file: z.string().nullable(),
  }).optional(),
  changelog: z.object({
    status: z.enum(["pending", "created"]),
    file: z.string().nullable(),
  }).optional(),
});

const historyEntry = z.object({
  iteration: iterationId,
  archived_at: iso8601,
  archived_path: z.string(),
});

export const StateSchema = z.object({
  current_iteration: iterationId,
  current_phase: phase,
  flow_guardrail: z.enum(["strict", "relaxed"]).optional(),
  phases: z.object({
    define: definePhase,
    prototype: prototypePhase,
    refactor: refactorPhase,
  }),
  last_updated: iso8601,
  updated_by: z.string().optional(),
  history: z.array(historyEntry).optional(),
});

export type State = z.infer<typeof StateSchema>;

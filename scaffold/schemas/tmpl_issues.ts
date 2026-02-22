import { z } from "zod";

const IssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["open", "fixed"]),
});

export const IssuesSchema = z.array(IssueSchema).refine(
  (issues) => {
    const ids = issues.map((i) => i.id);
    return new Set(ids).size === ids.length;
  },
  { message: "Issue IDs must be unique" },
);

export type Issue = z.infer<typeof IssueSchema>;
export type Issues = z.infer<typeof IssuesSchema>;

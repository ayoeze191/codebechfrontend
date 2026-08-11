export type SubmissionStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "ERROR";

/** One verdict per test case, as produced by the sandbox executors. */
export type TestCaseResult = {
  id?: string;
  testCase?: number;
  passed: boolean;
  output?: unknown;
  expected?: unknown;
  stdout?: string;
  error?: string;
  executionTime?: number;
};

export type Submission = {
  id: string;
  assessmentId: string;
  questionId: string | null;
  code: string;
  language: string;
  status: SubmissionStatus;
  isFinal: boolean;
  /** An array of verdicts, or `{ error }` when the whole run failed. */
  results?: TestCaseResult[] | { error?: string } | null;
  passed?: number | null;
  failed?: number | null;
  executionTime?: number | null;
  createdAt: string;
  question?: { id: string; title: string; difficulty: string; points: number };
  candidate?: { id: string; name: string; email: string };
};

export type SubmissionStats = {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  averageScore: number;
  passRate: number;
};

import { api } from "$lib/api";
type Question = {
  id?: string;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  points: number;
  testCases: Array<{
    id?: string;
    inputText: string;
    expectedText: string;
    isHidden: boolean;
  }>;
};

type Assessment = {
  id: string;
  title: string;
  description?: string;
  duration: number;
  questions?: Question[];
  _count?: {
    questions: number;
    submissions: number;
    invitations: number;
  };
};
export async function load() {
  try {
    const assessments = await api.get<Assessment[]>("/assessments");
    return { assessments };
  } catch (err) {
  } finally {
  }
}

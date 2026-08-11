import { api } from "./api";

export type Language = {
  id: string;
  label: string;
  editorLanguage: string;
  starterCode: string;
  isDefault?: boolean;
};

/**
 * Used only if the API can't be reached — the server's list is authoritative,
 * since it reflects that deployment's ALLOWED_LANGUAGES.
 */
const FALLBACK: Language[] = [
  {
    id: "javascript",
    label: "JavaScript",
    editorLanguage: "javascript",
    isDefault: true,
    starterCode: `// Export your solution. Arguments arrive in the order the test case lists them.
module.exports = function solve(a, b) {
  return a + b;
};
`,
  },
  {
    id: "python",
    label: "Python",
    editorLanguage: "python",
    starterCode: `# Define a top-level function named solve.
def solve(a, b):
    return a + b
`,
  },
  {
    id: "go",
    label: "Go",
    editorLanguage: "go",
    starterCode: `// Define an exported function named Solve. Do not write func main().
func Solve(a int, b int) int {
\treturn a + b
}
`,
  },
];

export async function loadLanguages(): Promise<Language[]> {
  try {
    const languages = await api.get<Language[]>("/submissions/languages", {
      auth: false,
    });
    return languages.length ? languages : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export const defaultLanguage = (languages: Language[]): Language =>
  languages.find((language) => language.isDefault) ?? languages[0];

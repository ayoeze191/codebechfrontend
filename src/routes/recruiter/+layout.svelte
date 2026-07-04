<script lang="ts">
  import { scale } from "svelte/transition";
  import { auth } from "$lib/auth";
  import { api } from "$lib/api";
  import * as Dialog from "$lib/components/ui/dialog";
  import { parseValue } from "../../utils/parseValue.js";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Textarea } from "$lib/components/ui/textarea";
  import * as Card from "$lib/components/ui/card";
  import * as Select from "$lib/components/ui/select";
  import * as Checkbox from "$lib/components/ui/checkbox";
  import { Separator } from "$lib/components/ui/separator";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

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

  let { data } = $props();

  let assessments = $state<Assessment[]>(data?.assessments || []);
  let showCreateModal = $state(false);
  let isLoading = $state(false);
  let error = $state("");

  type DraftQuestion = {
    title: string;
    description: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    points: number;
    testCases: Array<{
      inputText: string;
      expectedText: string;
      isHidden: boolean;
    }>;
  };

  let newAssessment = $state({
    title: "",
    description: "",
    duration: 60,
    questions: [
      {
        title: "Add two numbers",
        description: "Write a function that adds two numbers.",
        difficulty: "EASY" as const,
        points: 10,
        testCases: [
          { inputText: '{"a":1,"b":2}', expectedText: "3", isHidden: false },
        ],
      },
    ] as DraftQuestion[],
  });

  function addQuestion() {
    newAssessment.questions = [
      ...newAssessment.questions,
      {
        title: "",
        description: "",
        difficulty: "EASY" as const,
        points: 10,
        testCases: [
          {
            inputText: "",
            expectedText: "",
            isHidden: false,
          },
        ],
      },
    ];
  }

  function removeQuestion(index: number) {
    newAssessment.questions = newAssessment.questions.filter(
      (_, i) => i !== index,
    );
  }

  function addTestCase(questionIndex: number) {
    newAssessment.questions[questionIndex].testCases = [
      ...newAssessment.questions[questionIndex].testCases,
      {
        inputText: "",
        expectedText: "",
        isHidden: false,
      },
    ];
  }

  function removeTestCase(questionIndex: number, testIndex: number) {
    newAssessment.questions[questionIndex].testCases = newAssessment.questions[
      questionIndex
    ].testCases.filter((_, i) => i !== testIndex);
  }

  function resetNewAssessment() {
    newAssessment = {
      title: "",
      description: "",
      duration: 60,
      questions: [
        {
          title: "Add two numbers",
          description: "Write a function that adds two numbers.",
          difficulty: "EASY" as const,
          points: 10,
          testCases: [
            {
              inputText: '{"a":1,"b":2}',
              expectedText: "3",
              isHidden: false,
            },
          ],
        },
      ] as DraftQuestion[],
    };
  }

  async function createAssessment(e: Event) {
    e.preventDefault();
    error = "";
    isLoading = true;

    try {
      if (!newAssessment.title.trim()) {
        throw new Error("Assessment title is required");
      }

      for (const question of newAssessment.questions) {
        if (!question.title.trim()) {
          throw new Error("All questions must have a title");
        }
        if (!question.description.trim()) {
          throw new Error("All questions must have a description");
        }
        if (question.testCases.length === 0) {
          throw new Error(
            `Question "${question.title}" must have at least one test case`,
          );
        }
      }

      const payload = {
        ...newAssessment,
        questions: newAssessment.questions.map((question) => ({
          title: question.title,
          description: question.description,
          difficulty: question.difficulty,
          points: Number(question.points),
          testCases: question.testCases.map((testCase, index) => ({
            input: parseValue(testCase.inputText),
            expectedOutput: parseValue(testCase.expectedText),
            isHidden: testCase.isHidden,
            order: index,
          })),
        })),
      };

      const created = await api.post<Assessment>("/assessments", payload);
      assessments = [created, ...assessments];
      showCreateModal = false;
      resetNewAssessment();
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to create assessment";
    } finally {
      isLoading = false;
    }
  }

  async function handleLogout() {
    try {
      await auth.logout();
      goto("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }

  onMount(async () => {
    try {
      await auth.init();
    } catch (err) {
      console.error("Auth initialization failed:", err);
    }
  });
</script>

<div class="min-h-screen bg-slate-50">
  <main class="max-w-7xl mx-auto px-6 py-6">
    <header
      class="flex flex-wrap justify-between items-center gap-4 p-5 bg-white rounded-2xl shadow-sm border border-slate-200/50 backdrop-blur-sm transition-all duration-300 mb-7"
    >
      <div class="flex items-center">
        <div class="flex items-center gap-3.5">
          <div
            class="relative flex items-center justify-center w-11 h-11 bg-gradient-to-br from-emerald-900/10 to-emerald-900/5 rounded-xl transition-all duration-300 hover:scale-105 hover:-rotate-5 hover:from-emerald-900/20 hover:to-emerald-900/10"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="2"
                y="2"
                width="28"
                height="28"
                rx="8"
                stroke="#255f4b"
                stroke-width="2.5"
              />
              <path
                d="M10 16L14 20L22 12"
                stroke="#255f4b"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle
                cx="16"
                cy="16"
                r="14"
                stroke="#255f4b"
                stroke-width="1.5"
                stroke-dasharray="4 4"
                opacity="0.3"
              />
            </svg>
          </div>
          <div class="flex flex-col gap-0.5">
            <h1
              class="m-0 text-2xl font-bold tracking-tight text-slate-900 bg-gradient-to-r from-slate-900 to-emerald-800 bg-clip-text text-transparent"
            >
              Assessments
            </h1>
            <span
              class="text-sm font-medium text-slate-500 before:content-['•'] before:mr-1.5 before:text-emerald-700"
            >
              {assessments.length} total
            </span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-4 flex-wrap">
        <div
          class="relative flex items-center bg-slate-50 rounded-lg px-3 transition-all duration-300 border-2 border-transparent focus-within:bg-white focus-within:border-emerald-700 focus-within:shadow-[0_0_0_4px_rgba(37,95,75,0.08)] min-w-[200px]"
        >
          <span
            class="text-sm opacity-50 transition-opacity duration-300 focus-within:opacity-80"
            >🔍</span
          >
          <input
            type="text"
            placeholder="Search assessments..."
            class="border-none bg-transparent py-2.5 px-2 text-sm text-slate-900 w-full outline-none font-medium placeholder:text-slate-400"
          />
        </div>

        <div class="flex gap-2.5">
          <Dialog.Root bind:open={showCreateModal}>
            <Dialog.Trigger>
              <button
                class="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-lg font-semibold text-sm border-none cursor-pointer transition-all duration-300 bg-gradient-to-br from-emerald-800 to-emerald-700 text-white shadow-[0_2px_8px_rgba(37,95,75,0.25)] hover:-translate-y-0.5 hover:scale-102 hover:shadow-[0_6px_20px_rgba(37,95,75,0.35)] active:translate-y-0 active:scale-98 relative overflow-hidden whitespace-nowrap"
                transition:scale={{ duration: 150 }}
              >
                <span
                  class="text-base transition-transform duration-300 group-hover:scale-110 group-hover:rotate-90"
                  >➕</span
                >
                Create Assessment
              </button>
            </Dialog.Trigger>

            <Dialog.Content class="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
              {#if error}
                <div
                  class="bg-red-50 text-red-600 px-3 py-2.5 rounded-md mb-4"
                  role="alert"
                >
                  {error}
                </div>
              {/if}

              <form onsubmit={createAssessment} class="space-y-8">
                <Card.Root>
                  <Card.Header>
                    <Card.Title>Assessment Details</Card.Title>
                    <Card.Description>
                      Basic information about this assessment.
                    </Card.Description>
                  </Card.Header>

                  <Card.Content class="space-y-5">
                    <div class="grid gap-2">
                      <Label for="title">Title</Label>
                      <Input
                        id="title"
                        bind:value={newAssessment.title}
                        placeholder="Frontend Interview"
                        required
                      />
                    </div>

                    <div class="grid gap-2">
                      <Label for="description">Description</Label>
                      <Textarea
                        id="description"
                        rows={3}
                        bind:value={newAssessment.description}
                        placeholder="Describe this assessment..."
                      />
                    </div>

                    <div class="grid gap-2">
                      <Label for="duration">Duration (minutes)</Label>
                      <Input
                        id="duration"
                        type="number"
                        min="5"
                        bind:value={newAssessment.duration}
                        required
                      />
                    </div>
                  </Card.Content>
                </Card.Root>

                <div class="space-y-6">
                  {#each newAssessment.questions as question, questionIndex}
                    <Card.Root>
                      <Card.Header
                        class="flex flex-row items-center justify-between"
                      >
                        <div>
                          <Card.Title>
                            Question {questionIndex + 1}
                          </Card.Title>
                          <Card.Description>
                            Configure the question and its test cases.
                          </Card.Description>
                        </div>

                        {#if newAssessment.questions.length > 1}
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onclick={() => removeQuestion(questionIndex)}
                          >
                            Remove
                          </Button>
                        {/if}
                      </Card.Header>

                      <Card.Content class="space-y-5">
                        <div class="grid gap-2">
                          <Label>Question Title</Label>
                          <Input bind:value={question.title} required />
                        </div>

                        <div class="grid gap-2">
                          <Label>Description</Label>
                          <Textarea
                            rows={4}
                            bind:value={question.description}
                            required
                          />
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                          <div class="grid gap-2">
                            <Label>Difficulty</Label>
                            <Select.Root
                              type="single"
                              bind:value={question.difficulty}
                            >
                              <Select.Trigger class="w-full">
                                <Select.Value placeholder="Select difficulty" />
                              </Select.Trigger>

                              <Select.Content>
                                <Select.Item value="EASY">Easy</Select.Item>
                                <Select.Item value="MEDIUM">Medium</Select.Item>
                                <Select.Item value="HARD">Hard</Select.Item>
                              </Select.Content>
                            </Select.Root>
                          </div>

                          <div class="grid gap-2">
                            <Label>Points</Label>
                            <Input
                              type="number"
                              min="1"
                              bind:value={question.points}
                              required
                            />
                          </div>
                        </div>

                        <Separator />

                        <div class="space-y-4">
                          <div class="flex items-center justify-between">
                            <h4 class="text-sm font-semibold">Test Cases</h4>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onclick={() => addTestCase(questionIndex)}
                            >
                              Add Test Case
                            </Button>
                          </div>

                          {#each question.testCases as testCase, testIndex}
                            <Card.Root class="border-dashed">
                              <Card.Content class="pt-6 space-y-4">
                                <div class="grid gap-2">
                                  <Label>Input</Label>
                                  <Input bind:value={testCase.inputText} />
                                </div>

                                <div class="grid gap-2">
                                  <Label>Expected Output</Label>
                                  <Input
                                    bind:value={testCase.expectedText}
                                    placeholder="[]"
                                  />
                                </div>

                                <div class="flex items-center justify-between">
                                  <div class="flex items-center gap-3">
                                    <Checkbox.Root
                                      bind:checked={testCase.isHidden}
                                      id={"hidden-" +
                                        questionIndex +
                                        "-" +
                                        testIndex}
                                    />
                                    <Label
                                      for={"hidden-" +
                                        questionIndex +
                                        "-" +
                                        testIndex}
                                    >
                                      Hidden Test Case
                                    </Label>
                                  </div>

                                  {#if question.testCases.length > 1}
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      onclick={() =>
                                        removeTestCase(
                                          questionIndex,
                                          testIndex,
                                        )}
                                    >
                                      Remove
                                    </Button>
                                  {/if}
                                </div>
                              </Card.Content>
                            </Card.Root>
                          {/each}
                        </div>
                      </Card.Content>
                    </Card.Root>
                  {/each}
                </div>

                <div class="flex items-center justify-between pt-2">
                  <Button type="button" variant="outline" onclick={addQuestion}>
                    Add Question
                  </Button>

                  <div class="flex items-center gap-3">
                    <Dialog.Close>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isLoading}
                      >
                        Cancel
                      </Button>
                    </Dialog.Close>

                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Creating..." : "Create Assessment"}
                    </Button>
                  </div>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Root>

          <button
            class="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-lg font-semibold text-sm border border-slate-200 cursor-pointer transition-all duration-300 bg-slate-50 text-slate-900 hover:bg-slate-100 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-slate-300 active:translate-y-0 active:scale-98 relative overflow-hidden whitespace-nowrap"
            onclick={handleLogout}
            transition:scale={{ duration: 150 }}
          >
            <span
              class="text-sm transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-110"
              >🚪</span
            >
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </header>

    <slot />
  </main>
</div>

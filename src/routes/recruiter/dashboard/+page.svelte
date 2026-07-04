<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import { auth } from "$lib/auth";
  import { fade, fly, scale } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { buttonVariants } from "$lib/components/ui/button/index.js";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Textarea } from "$lib/components/ui/textarea";
  import * as Card from "$lib/components/ui/card";
  import * as Select from "$lib/components/ui/select";
  import * as Checkbox from "$lib/components/ui/checkbox";
  import { Separator } from "$lib/components/ui/separator";

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

  let hoveredCardId = $state<string | null>(null);

  let assessments = $state<Assessment[]>([]);
  let isLoading = $state(true);
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let editAssessment = $state<Assessment | null>(null);
  let error = $state("");

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

  onMount(async () => {
    auth.init();
    await loadAssessments();
  });

  async function loadAssessments() {
    isLoading = true;
    error = "";
    try {
      const response = await api.get<Assessment[]>("/assessments");

      assessments = response.assessments;
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to fetch assessments";
    } finally {
      isLoading = false;
    }
  }

  function parseValue(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  function addQuestion() {
    newAssessment.questions = [
      ...newAssessment.questions,
      {
        title: "",
        description: "",
        difficulty: "EASY" as const,
        points: 10,
        testCases: [{ inputText: "", expectedText: "", isHidden: false }],
      },
    ];
  }

  function addTestCase(questionIndex: number) {
    newAssessment.questions[questionIndex].testCases = [
      ...newAssessment.questions[questionIndex].testCases,
      { inputText: "", expectedText: "", isHidden: false },
    ];
  }

  function removeTestCase(questionIndex: number, testIndex: number) {
    newAssessment.questions[questionIndex].testCases = newAssessment.questions[
      questionIndex
    ].testCases.filter((_, i) => i !== testIndex);
  }

  function removeQuestion(questionIndex: number) {
    if (newAssessment.questions.length > 1) {
      newAssessment.questions = newAssessment.questions.filter(
        (_, i) => i !== questionIndex,
      );
    }
  }

  function openEditModal(assessment: Assessment) {
    editAssessment = {
      id: assessment.id,
      title: assessment.title,
      description: assessment.description || "",
      duration: assessment.duration,
      questions:
        assessment.questions?.map((q) => ({
          id: q.id,
          title: q.title,
          description: q.description,
          difficulty: q.difficulty,
          points: q.points,
          testCases: q.testCases.map((tc) => ({
            id: tc.id,
            inputText: tc.inputText,
            expectedText: tc.expectedText,
            isHidden: tc.isHidden,
          })),
        })) || [],
    };
    showEditModal = true;
  }

  function updateEditQuestion(
    questionIndex: number,
    field: string,
    value: any,
  ) {
    if (!editAssessment || !editAssessment.questions) return;

    const updatedQuestions = [...editAssessment.questions];
    updatedQuestions[questionIndex] = {
      ...updatedQuestions[questionIndex],
      [field]: value,
    };
    editAssessment.questions = updatedQuestions;
  }

  function updateEditTestCase(
    questionIndex: number,
    testIndex: number,
    field: string,
    value: any,
  ) {
    if (!editAssessment || !editAssessment.questions) return;

    const updatedQuestions = [...editAssessment.questions];
    const updatedTestCases = [...updatedQuestions[questionIndex].testCases];
    updatedTestCases[testIndex] = {
      ...updatedTestCases[testIndex],
      [field]: value,
    };
    updatedQuestions[questionIndex].testCases = updatedTestCases;
    editAssessment.questions = updatedQuestions;
  }

  function addEditQuestion() {
    if (!editAssessment) return;
    editAssessment.questions = [
      ...(editAssessment.questions || []),
      {
        title: "",
        description: "",
        difficulty: "EASY" as const,
        points: 10,
        testCases: [{ inputText: "", expectedText: "", isHidden: false }],
      },
    ];
  }

  function addEditTestCase(questionIndex: number) {
    if (!editAssessment || !editAssessment.questions) return;

    const updatedQuestions = [...editAssessment.questions];
    updatedQuestions[questionIndex].testCases = [
      ...updatedQuestions[questionIndex].testCases,
      { inputText: "", expectedText: "", isHidden: false },
    ];
    editAssessment.questions = updatedQuestions;
  }

  function removeEditTestCase(questionIndex: number, testIndex: number) {
    if (!editAssessment || !editAssessment.questions) return;

    const updatedQuestions = [...editAssessment.questions];
    updatedQuestions[questionIndex].testCases = updatedQuestions[
      questionIndex
    ].testCases.filter((_, i) => i !== testIndex);
    editAssessment.questions = updatedQuestions;
  }

  function removeEditQuestion(questionIndex: number) {
    if (!editAssessment || !editAssessment.questions) return;

    if (editAssessment.questions.length > 1) {
      editAssessment.questions = editAssessment.questions.filter(
        (_, i) => i !== questionIndex,
      );
    }
  }

  async function createAssessment(e: Event) {
    e.preventDefault();
    error = "";

    try {
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
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to create assessment";
    }
  }

  async function updateAssessment(event: Event) {
    event.preventDefault();
    if (!editAssessment) return;
    error = "";

    try {
      const payload = {
        title: editAssessment.title,
        description: editAssessment.description,
        duration: Number(editAssessment.duration),
        questions: editAssessment.questions?.map((q) => ({
          id: q.id,
          title: q.title,
          description: q.description,
          difficulty: q.difficulty,
          points: Number(q.points),
          testCases: q.testCases.map((tc, index) => ({
            id: tc.id,
            input: parseValue(tc.inputText),
            expectedOutput: parseValue(tc.expectedText),
            isHidden: tc.isHidden,
            order: index,
          })),
        })),
      };

      const updated = await api.put<Assessment>(
        `/assessments/${editAssessment.id}`,
        payload,
      );

      assessments = assessments.map((item) =>
        item.id === updated.id ? updated : item,
      );

      showEditModal = false;
      editAssessment = null;
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to update assessment";
    }
  }

  async function deleteAssessment(id: string) {
    if (!confirm("Are you sure you want to delete this assessment?")) return;

    error = "";
    try {
      await api.delete(`/assessments/${id}`);
      assessments = assessments.filter((item) => item.id !== id);
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to delete assessment";
    }
  }
</script>

<main class="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100/80">
  {#if error}
    <div
      class="bg-red-50 text-red-600 rounded-lg px-4 py-3 mb-6 border border-red-200"
    >
      {error}
    </div>
  {/if}

  {#if isLoading}
    <div class="flex items-center justify-center h-64">
      <div class="flex flex-col items-center gap-4">
        <div
          class="w-12 h-12 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin"
        ></div>
        <p class="text-slate-500 font-medium">Loading assessments...</p>
      </div>
    </div>
  {:else if assessments.length === 0}
    <div
      class="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-slate-300 p-12"
    >
      <div class="text-6xl mb-4">📋</div>
      <h2 class="text-2xl font-semibold text-slate-900 mb-2">
        No assessments yet
      </h2>
      <p class="text-slate-500 mb-6">
        Create your first assessment to get started.
      </p>
      <Button onclick={() => (showCreateModal = true)}>
        Create Assessment
      </Button>
    </div>
  {:else}
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Assessments</h1>
        <p class="text-slate-500 text-sm">
          {assessments.length} assessments available
        </p>
      </div>
      <Button onclick={() => (showCreateModal = true)}>
        <span class="mr-2">+</span> New Assessment
      </Button>
    </div>

    <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
      {#each assessments as assessment (assessment.id)}
        <Card.Root
          class="transition-all w-full  duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer border-slate-200/60 hover:border-emerald-500/50"
          onmouseenter={() => (hoveredCardId = assessment.id)}
          onmouseleave={() => (hoveredCardId = null)}
        >
          {#if hoveredCardId === assessment.id}
            <div
              class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite] rounded-t-2xl"
            ></div>
          {/if}

          <Card.Header class="pb-3">
            <div class="flex items-start justify-between gap-3 w-full">
              <div class="flex-1 min-w-0">
                <Card.Title
                  class="text-lg font-semibold text-slate-900 truncate"
                >
                  {assessment.title}
                  {#if hoveredCardId === assessment.id}
                    <span
                      class="inline-block ml-2 text-emerald-600 animate-[pulse_1.5s_ease-in-out_infinite]"
                      >✦</span
                    >
                  {/if}
                </Card.Title>
                <Card.Description class="text-sm text-slate-500 line-clamp-1">
                  {assessment.description || "No description provided"}
                </Card.Description>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span
                  class="bg-emerald-50 px-3 py-1 rounded-full text-sm font-semibold text-emerald-700 whitespace-nowrap border border-emerald-100"
                >
                  ⏱ {assessment.duration} min
                </span>
              </div>
            </div>
          </Card.Header>

          <Card.Content class="pb-3">
            <div
              class="flex items-center gap-4 py-2.5 border-y border-slate-100"
            >
              <div class="flex items-center gap-2 text-sm text-slate-600">
                <span class="text-base">📝</span>
                <span class="font-medium text-slate-900"
                  >{assessment._count?.questions ?? 0}</span
                >
                <span class="text-slate-400">questions</span>
              </div>
              <div class="w-px h-6 bg-slate-200"></div>
              <div class="flex items-center gap-2 text-sm text-slate-600">
                <span class="text-base">📊</span>
                <span class="font-medium text-slate-900"
                  >{assessment._count?.submissions ?? 0}</span
                >
                <span class="text-slate-400">submissions</span>
              </div>
            </div>
          </Card.Content>

          <Card.Footer class="flex flex-wrap gap-2 pt-3">
            <Button
              onclick={() =>
                goto(`/recruiter/dashboard/${assessment.id}/candidates`)}
              variant="outline"
              size="sm"
              class="flex-1 min-w-[70px]"
            >
              <span class="mr-1.5">📨</span> Invite
            </Button>
            <!-- <AlertDialog.Root>
              <AlertDialog.Trigger asChild>
                <Button variant="outline" size="sm" class="flex-1 min-w-[70px]">
                  <span class="mr-1.5">📨</span> Invite
                </Button>
              </AlertDialog.Trigger>
              <AlertDialog.Content>
                <AlertDialog.Header>
                  <AlertDialog.Title
                    >Send Assessment Invitation?</AlertDialog.Title
                  >
                  <AlertDialog.Description>
                    You're about to send a coding assessment invitation to
                    <strong>candidate.name</strong> (candidate.email). The candidate
                    will receive an email containing a secure link to complete the
                    assessment.
                  </AlertDialog.Description>
                </AlertDialog.Header>
                <AlertDialog.Footer>
                  <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                  <AlertDialog.Action>Send Invitation</AlertDialog.Action>
                </AlertDialog.Footer>
              </AlertDialog.Content>
            </AlertDialog.Root> -->

            <Button
              variant="outline"
              size="sm"
              class="flex-1 min-w-[70px]"
              onclick={() =>
                goto(`/recruiter/assessments/${assessment.id}/results`)}
            >
              <span class="mr-1.5">📈</span> Results
            </Button>

            <Button
              variant="outline"
              size="sm"
              class="flex-1 min-w-[70px]"
              onclick={() => goto(`/recruiter/monitor/${assessment.id}`)}
            >
              <span class="mr-1.5">👁️</span> Monitor
            </Button>

            <Button
              variant="outline"
              size="sm"
              class="flex-1 min-w-[70px]"
              onclick={() => openEditModal(assessment)}
            >
              <span class="mr-1.5">✏️</span> Edit
            </Button>

            <Button
              variant="destructive"
              size="sm"
              class="flex-1 min-w-[70px]"
              onclick={() => deleteAssessment(assessment.id)}
            >
              <span class="mr-1.5">🗑️</span> Delete
            </Button>
          </Card.Footer>
        </Card.Root>
      {/each}
    </section>
  {/if}

  <!-- Edit Modal -->
  <Dialog.Root bind:open={showEditModal}>
    <Dialog.Content class="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
      {#if editAssessment}
        <form onsubmit={updateAssessment} class="space-y-6">
          <div class="flex items-center justify-between pb-4 border-b">
            <div>
              <Dialog.Title class="text-2xl font-bold"
                >Edit Assessment</Dialog.Title
              >
              <Dialog.Description
                >Update the assessment details and questions.</Dialog.Description
              >
            </div>
          </div>

          <Card.Root>
            <Card.Header>
              <Card.Title>Assessment Details</Card.Title>
              <Card.Description>Update the basic information.</Card.Description>
            </Card.Header>
            <Card.Content class="space-y-4">
              <div class="grid gap-2">
                <Label for="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  bind:value={editAssessment.title}
                  placeholder="Frontend Interview"
                  required
                />
              </div>
              <div class="grid gap-2">
                <Label for="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  rows={3}
                  bind:value={editAssessment.description}
                  placeholder="Describe this assessment..."
                />
              </div>
              <div class="grid gap-2">
                <Label for="edit-duration">Duration (minutes)</Label>
                <Input
                  id="edit-duration"
                  type="number"
                  min="5"
                  bind:value={editAssessment.duration}
                  required
                />
              </div>
            </Card.Content>
          </Card.Root>

          <div class="space-y-4">
            {#each editAssessment.questions || [] as question, questionIndex}
              <Card.Root>
                <Card.Header class="flex flex-row items-center justify-between">
                  <div>
                    <Card.Title>Question {questionIndex + 1}</Card.Title>
                    <Card.Description
                      >Configure the question and its test cases.</Card.Description
                    >
                  </div>
                  {#if (editAssessment.questions?.length || 0) > 1}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onclick={() => removeEditQuestion(questionIndex)}
                      >Remove</Button
                    >
                  {/if}
                </Card.Header>
                <Card.Content class="space-y-4">
                  <div class="grid gap-2">
                    <Label>Question Title</Label>
                    <Input
                      value={question.title}
                      oninput={(e) =>
                        updateEditQuestion(
                          questionIndex,
                          "title",
                          e.currentTarget.value,
                        )}
                      required
                    />
                  </div>
                  <div class="grid gap-2">
                    <Label>Description</Label>
                    <Textarea
                      rows={4}
                      value={question.description}
                      oninput={(e) =>
                        updateEditQuestion(
                          questionIndex,
                          "description",
                          e.currentTarget.value,
                        )}
                      required
                    />
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div class="grid gap-2">
                      <Label>Difficulty</Label>
                      <Select.Root
                        type="single"
                        value={question.difficulty}
                        onValueChange={(value) =>
                          updateEditQuestion(
                            questionIndex,
                            "difficulty",
                            value,
                          )}
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
                        value={question.points}
                        oninput={(e) =>
                          updateEditQuestion(
                            questionIndex,
                            "points",
                            Number(e.currentTarget.value),
                          )}
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
                        onclick={() => addEditTestCase(questionIndex)}
                        >Add Test Case</Button
                      >
                    </div>
                    {#each question.testCases as testCase, testIndex}
                      <Card.Root class="border-dashed border-slate-300">
                        <Card.Content class="pt-4 space-y-4">
                          <div class="grid gap-2">
                            <Label>Input</Label>
                            <Input
                              value={testCase.inputText}
                              oninput={(e) =>
                                updateEditTestCase(
                                  questionIndex,
                                  testIndex,
                                  "inputText",
                                  e.currentTarget.value,
                                )}
                              placeholder=""
                            />
                          </div>
                          <div class="grid gap-2">
                            <Label>Expected Output</Label>
                            <Input
                              value={testCase.expectedText}
                              oninput={(e) =>
                                updateEditTestCase(
                                  questionIndex,
                                  testIndex,
                                  "expectedText",
                                  e.currentTarget.value,
                                )}
                              placeholder=""
                            />
                          </div>
                          <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                              <Checkbox.Root
                                checked={testCase.isHidden}
                                onCheckedChange={(checked) =>
                                  updateEditTestCase(
                                    questionIndex,
                                    testIndex,
                                    "isHidden",
                                    checked,
                                  )}
                                id={"edit-hidden-" +
                                  questionIndex +
                                  "-" +
                                  testIndex}
                              />
                              <Label
                                for={"edit-hidden-" +
                                  questionIndex +
                                  "-" +
                                  testIndex}>Hidden Test Case</Label
                              >
                            </div>
                            {#if question.testCases.length > 1}
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onclick={() =>
                                  removeEditTestCase(questionIndex, testIndex)}
                                >Remove</Button
                              >
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
            <Button type="button" variant="outline" onclick={addEditQuestion}
              >Add Question</Button
            >
            <div class="flex items-center gap-3">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </Dialog.Close>
              <Button type="submit">Save Changes</Button>
            </div>
          </div>
        </form>
      {/if}
    </Dialog.Content>
  </Dialog.Root>
</main>

<style>
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>

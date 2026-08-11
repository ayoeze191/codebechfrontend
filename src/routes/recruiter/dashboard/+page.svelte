<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import { parseValue } from "$lib/parseValue";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Textarea } from "$lib/components/ui/textarea";
  import * as Card from "$lib/components/ui/card";
  import * as Select from "$lib/components/ui/select";
  import * as Checkbox from "$lib/components/ui/checkbox";
  import { Separator } from "$lib/components/ui/separator";

  type Difficulty = "EASY" | "MEDIUM" | "HARD";

  // Test case inputs and expected outputs are arbitrary JSON, so the form holds
  // them as text and only parses on submit.
  type DraftTestCase = {
    id?: string;
    inputText: string;
    expectedText: string;
    isHidden: boolean;
  };

  type DraftQuestion = {
    id?: string;
    title: string;
    description: string;
    difficulty: Difficulty;
    points: number;
    testCases: DraftTestCase[];
  };

  type Draft = {
    id?: string;
    title: string;
    description: string;
    duration: number;
    questions: DraftQuestion[];
  };

  type Assessment = {
    id: string;
    title: string;
    description?: string | null;
    duration: number;
    _count?: { questions: number; submissions: number; invitations: number };
  };

  // Shape returned by GET /assessments/:id — questions with their real test cases.
  type AssessmentDetail = Assessment & {
    questions: Array<{
      id: string;
      title: string;
      description: string;
      difficulty: Difficulty;
      points: number;
      testCases: Array<{
        id: string;
        input: unknown;
        expectedOutput: unknown;
        isHidden: boolean;
      }>;
    }>;
  };

  let assessments = $state<Assessment[]>([]);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let error = $state("");
  let searchQuery = $state("");

  let showEditor = $state(false);
  let editorMode = $state<"create" | "edit">("create");
  let draft = $state<Draft>(emptyDraft());
  let hoveredCardId = $state<string | null>(null);
  let deleteTargetId = $state<string | null>(null);

  const filteredAssessments = $derived(
    assessments.filter((assessment) =>
      assessment.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
    ),
  );

  function emptyDraft(): Draft {
    return {
      title: "",
      description: "",
      duration: 60,
      questions: [emptyQuestion()],
    };
  }

  function emptyQuestion(): DraftQuestion {
    return {
      title: "",
      description: "",
      difficulty: "EASY",
      points: 10,
      testCases: [{ inputText: "", expectedText: "", isHidden: false }],
    };
  }

  onMount(loadAssessments);

  async function loadAssessments() {
    isLoading = true;
    error = "";
    try {
      const response = await api.get<{ assessments: Assessment[] }>("/assessments");
      assessments = response.assessments;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch assessments";
    } finally {
      isLoading = false;
    }
  }

  function openCreate() {
    editorMode = "create";
    draft = emptyDraft();
    error = "";
    showEditor = true;
  }

  // The list endpoint only returns counts, so the full assessment — questions
  // and their test cases — has to be fetched before it can be edited.
  async function openEdit(assessmentId: string) {
    error = "";
    try {
      const detail = await api.get<AssessmentDetail>(`/assessments/${assessmentId}`);
      draft = {
        id: detail.id,
        title: detail.title,
        description: detail.description ?? "",
        duration: detail.duration,
        questions: detail.questions.map((question) => ({
          id: question.id,
          title: question.title,
          description: question.description,
          difficulty: question.difficulty,
          points: question.points,
          testCases: question.testCases.map((testCase) => ({
            id: testCase.id,
            inputText: JSON.stringify(testCase.input),
            expectedText: JSON.stringify(testCase.expectedOutput),
            isHidden: testCase.isHidden,
          })),
        })),
      };
      editorMode = "edit";
      showEditor = true;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load assessment";
    }
  }

  function addQuestion() {
    draft.questions = [...draft.questions, emptyQuestion()];
  }

  function removeQuestion(questionIndex: number) {
    draft.questions = draft.questions.filter((_, i) => i !== questionIndex);
  }

  function addTestCase(questionIndex: number) {
    draft.questions[questionIndex].testCases = [
      ...draft.questions[questionIndex].testCases,
      { inputText: "", expectedText: "", isHidden: false },
    ];
  }

  function removeTestCase(questionIndex: number, testIndex: number) {
    draft.questions[questionIndex].testCases = draft.questions[
      questionIndex
    ].testCases.filter((_, i) => i !== testIndex);
  }

  function buildPayload() {
    return {
      title: draft.title.trim(),
      description: draft.description.trim(),
      duration: Number(draft.duration),
      questions: draft.questions.map((question) => ({
        ...(question.id ? { id: question.id } : {}),
        title: question.title.trim(),
        description: question.description.trim(),
        difficulty: question.difficulty,
        points: Number(question.points),
        testCases: question.testCases.map((testCase, index) => ({
          ...(testCase.id ? { id: testCase.id } : {}),
          input: parseValue(testCase.inputText),
          expectedOutput: parseValue(testCase.expectedText),
          isHidden: testCase.isHidden,
          order: index,
        })),
      })),
    };
  }

  function validate() {
    if (!draft.title.trim()) throw new Error("Assessment title is required");
    if (!draft.duration || draft.duration <= 0)
      throw new Error("Duration must be a positive number of minutes");
    if (draft.questions.length === 0)
      throw new Error("Add at least one question");

    for (const question of draft.questions) {
      if (!question.title.trim())
        throw new Error("Every question needs a title");
      if (!question.description.trim())
        throw new Error(`Question "${question.title}" needs a description`);
      if (question.testCases.length === 0)
        throw new Error(
          `Question "${question.title}" needs at least one test case`,
        );
      for (const testCase of question.testCases) {
        if (!testCase.expectedText.trim())
          throw new Error(
            `Every test case in "${question.title}" needs an expected output`,
          );
      }
    }
  }

  async function saveAssessment(event: Event) {
    event.preventDefault();
    error = "";
    isSaving = true;

    try {
      validate();
      const payload = buildPayload();

      if (editorMode === "edit" && draft.id) {
        await api.patch<Assessment>(`/assessments/${draft.id}`, payload);
      } else {
        await api.post<Assessment>("/assessments", payload);
      }

      // Re-fetch rather than splicing the response in: the list carries the
      // question/submission counts, which the create response doesn't.
      await loadAssessments();
      showEditor = false;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to save assessment";
    } finally {
      isSaving = false;
    }
  }

  async function confirmDelete() {
    if (!deleteTargetId) return;
    error = "";
    try {
      await api.delete(`/assessments/${deleteTargetId}`);
      assessments = assessments.filter((item) => item.id !== deleteTargetId);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to delete assessment";
    } finally {
      deleteTargetId = null;
    }
  }
</script>

<svelte:head><title>Assessments · CodeBench</title></svelte:head>

{#if error}
  <div class="bg-red-50 text-red-600 rounded-lg px-4 py-3 mb-6 border border-red-200" role="alert">
    {error}
  </div>
{/if}

<div class="flex flex-wrap items-center justify-between gap-4 mb-6">
  <div>
    <h1 class="text-2xl font-bold text-slate-900">Assessments</h1>
    <p class="text-slate-500 text-sm">
      {assessments.length}
      {assessments.length === 1 ? "assessment" : "assessments"}
    </p>
  </div>
  <div class="flex items-center gap-3">
    <Input
      type="search"
      placeholder="Search assessments..."
      bind:value={searchQuery}
      class="w-full sm:w-64"
    />
    <Button onclick={openCreate}>+ New Assessment</Button>
  </div>
</div>

{#if isLoading}
  <div class="flex flex-col items-center justify-center h-64 gap-4">
    <div class="w-12 h-12 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
    <p class="text-slate-500 font-medium">Loading assessments...</p>
  </div>
{:else if assessments.length === 0}
  <div class="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-slate-300 p-12">
    <div class="text-6xl mb-4">📋</div>
    <h2 class="text-2xl font-semibold text-slate-900 mb-2">No assessments yet</h2>
    <p class="text-slate-500 mb-6">Create your first assessment to get started.</p>
    <Button onclick={openCreate}>Create Assessment</Button>
  </div>
{:else if filteredAssessments.length === 0}
  <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
    <p class="text-slate-500">No assessment matches “{searchQuery}”.</p>
  </div>
{:else}
  <section class="grid grid-cols-1 xl:grid-cols-2 gap-6">
    {#each filteredAssessments as assessment (assessment.id)}
      <Card.Root
        class="relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-slate-200/60 hover:border-emerald-500/50"
        onmouseenter={() => (hoveredCardId = assessment.id)}
        onmouseleave={() => (hoveredCardId = null)}
      >
        {#if hoveredCardId === assessment.id}
          <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600 rounded-t-2xl"></div>
        {/if}

        <Card.Header class="pb-3">
          <div class="flex items-start justify-between gap-3 w-full">
            <div class="flex-1 min-w-0">
              <Card.Title class="text-lg font-semibold text-slate-900 truncate">
                {assessment.title}
              </Card.Title>
              <Card.Description class="text-sm text-slate-500 line-clamp-1">
                {assessment.description || "No description provided"}
              </Card.Description>
            </div>
            <span class="bg-emerald-50 px-3 py-1 rounded-full text-sm font-semibold text-emerald-700 whitespace-nowrap border border-emerald-100">
              ⏱ {assessment.duration} min
            </span>
          </div>
        </Card.Header>

        <Card.Content class="pb-3">
          <div class="flex items-center gap-4 py-2.5 border-y border-slate-100 text-sm text-slate-600">
            <span><strong class="text-slate-900">{assessment._count?.questions ?? 0}</strong> questions</span>
            <span class="w-px h-6 bg-slate-200"></span>
            <span><strong class="text-slate-900">{assessment._count?.invitations ?? 0}</strong> invited</span>
            <span class="w-px h-6 bg-slate-200"></span>
            <span><strong class="text-slate-900">{assessment._count?.submissions ?? 0}</strong> submissions</span>
          </div>
        </Card.Content>

        <Card.Footer class="flex flex-wrap gap-2 pt-3">
          <Button
            variant="outline"
            size="sm"
            class="flex-1 min-w-[80px]"
            onclick={() => goto(`/recruiter/dashboard/${assessment.id}/candidates`)}
          >
            📨 Invite
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="flex-1 min-w-[80px]"
            onclick={() => goto(`/recruiter/dashboard/${assessment.id}/monitor`)}
          >
            👁️ Monitor
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="flex-1 min-w-[80px]"
            onclick={() => goto(`/recruiter/dashboard/${assessment.id}/results`)}
          >
            📈 Results
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="flex-1 min-w-[80px]"
            onclick={() => openEdit(assessment.id)}
          >
            ✏️ Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            class="flex-1 min-w-[80px]"
            onclick={() => (deleteTargetId = assessment.id)}
          >
            🗑️ Delete
          </Button>
        </Card.Footer>
      </Card.Root>
    {/each}
  </section>
{/if}

<!-- One editor drives both create and edit; only the target endpoint differs. -->
<Dialog.Root bind:open={showEditor}>
  <Dialog.Content class="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
    <Dialog.Header>
      <Dialog.Title>
        {editorMode === "edit" ? "Edit assessment" : "New assessment"}
      </Dialog.Title>
      <Dialog.Description>
        Questions can only be changed until the first invitation goes out.
      </Dialog.Description>
    </Dialog.Header>

    <form onsubmit={saveAssessment} class="space-y-6">
      <Card.Root>
        <Card.Header>
          <Card.Title>Assessment details</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-5">
          <div class="grid gap-2">
            <Label for="assessment-title">Title</Label>
            <Input id="assessment-title" bind:value={draft.title} placeholder="Backend Engineer Screen" required />
          </div>
          <div class="grid gap-2">
            <Label for="assessment-description">Description</Label>
            <Textarea id="assessment-description" rows={3} bind:value={draft.description} />
          </div>
          <div class="grid gap-2">
            <Label for="assessment-duration">Duration (minutes)</Label>
            <Input id="assessment-duration" type="number" min="5" bind:value={draft.duration} required />
          </div>
        </Card.Content>
      </Card.Root>

      {#each draft.questions as question, questionIndex}
        <Card.Root>
          <Card.Header class="flex flex-row items-start justify-between gap-4">
            <div>
              <Card.Title>Question {questionIndex + 1}</Card.Title>
              <Card.Description>Configure the question and its test cases.</Card.Description>
            </div>
            {#if draft.questions.length > 1}
              <Button type="button" variant="destructive" size="sm" onclick={() => removeQuestion(questionIndex)}>
                Remove
              </Button>
            {/if}
          </Card.Header>

          <Card.Content class="space-y-5">
            <div class="grid gap-2">
              <Label>Question title</Label>
              <Input bind:value={question.title} required />
            </div>

            <div class="grid gap-2">
              <Label>Description</Label>
              <Textarea rows={4} bind:value={question.description} required />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="grid gap-2">
                <Label>Difficulty</Label>
                <Select.Root type="single" bind:value={question.difficulty}>
                  <Select.Trigger class="w-full">{question.difficulty}</Select.Trigger>
                  <Select.Content>
                    <Select.Item value="EASY">Easy</Select.Item>
                    <Select.Item value="MEDIUM">Medium</Select.Item>
                    <Select.Item value="HARD">Hard</Select.Item>
                  </Select.Content>
                </Select.Root>
              </div>
              <div class="grid gap-2">
                <Label>Points</Label>
                <Input type="number" min="1" bind:value={question.points} required />
              </div>
            </div>

            <Separator />

            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-sm font-semibold">Test cases</h4>
                  <p class="text-xs text-slate-500">
                    Input as JSON. An object's values are passed as arguments in
                    order — <code>{"{"}"a":1,"b":2{"}"}</code> calls
                    <code>solve(1, 2)</code>.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onclick={() => addTestCase(questionIndex)}>
                  Add test case
                </Button>
              </div>

              {#each question.testCases as testCase, testIndex}
                <Card.Root class="border-dashed">
                  <Card.Content class="pt-6 space-y-4">
                    <div class="grid gap-2">
                      <Label>Input</Label>
                      <Input bind:value={testCase.inputText} placeholder={'{"a":1,"b":2}'} class="font-mono text-sm" />
                    </div>
                    <div class="grid gap-2">
                      <Label>Expected output</Label>
                      <Input bind:value={testCase.expectedText} placeholder="3" class="font-mono text-sm" />
                    </div>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <Checkbox.Root
                          bind:checked={testCase.isHidden}
                          id={`hidden-${questionIndex}-${testIndex}`}
                        />
                        <Label for={`hidden-${questionIndex}-${testIndex}`}>
                          Hidden from the candidate
                        </Label>
                      </div>
                      {#if question.testCases.length > 1}
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onclick={() => removeTestCase(questionIndex, testIndex)}
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

      <div class="flex items-center justify-between pt-2">
        <Button type="button" variant="outline" onclick={addQuestion}>Add question</Button>
        <div class="flex items-center gap-3">
          <Button type="button" variant="outline" disabled={isSaving} onclick={() => (showEditor = false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : editorMode === "edit" ? "Save changes" : "Create assessment"}
          </Button>
        </div>
      </div>
    </form>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root
  open={deleteTargetId !== null}
  onOpenChange={(open) => !open && (deleteTargetId = null)}
>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Delete this assessment?</Dialog.Title>
      <Dialog.Description>
        Its questions, invitations and every candidate submission are deleted
        with it. This cannot be undone.
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (deleteTargetId = null)}>Cancel</Button>
      <Button variant="destructive" onclick={confirmDelete}>Delete</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

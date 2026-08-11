<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { api } from "$lib/api";
  import { socketStore } from "$stores/socketStore";
  import { fade, slide, scale } from "svelte/transition";
  import { page } from "$app/state";
  import { loadLanguages, defaultLanguage, type Language } from "$lib/languages";
  import MonacoEditor from "$components/MonacoEditor.svelte";

  type TestCase = {
    id: string;
    input: unknown;
    expectedOutput: unknown;
  };

  type Question = {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    points: number;
    testCases: TestCase[];
  };

  type Assessment = {
    id: string;
    title: string;
    description?: string;
    duration: number;
    questions: Question[];
  };

  type Submission = {
    id: string;
    questionId: string;
    status: string;
    passed?: number;
    failed?: number;
    createdAt: string;
  };

  type RunResult = {
    passed: boolean;
    output?: unknown;
    expected?: unknown;
    stdout?: string;
    error?: string;
    executionTime?: number;
  };

  const assessmentToken = $derived(page.params._token!);

  let assessment = $state<Assessment | null>(null);
  let startedAt = $state<string | null>(null);
  let selectedQuestionId = $state("");
  let languages = $state<Language[]>([]);
  let language = $state("javascript");
  let submissions = $state<Submission[]>([]);
  let message = $state("");
  let error = $state("");
  let loading = $state(true);
  let loadingQuestion = $state(true);
  let isFullscreen = $state(false);
  let isSubmitting = $state(false);
  let isRunning = $state(false);
  let isFinishing = $state(false);
  let hoveredQuestion = $state<string | null>(null);

  // Answers are kept per question *and* per language, so switching either one
  // never throws away work the candidate has already done.
  let codeByKey = $state<Record<string, string>>({});
  let runResults = $state<RunResult[]>([]);
  let runError = $state("");

  let submissionRefreshTimer: ReturnType<typeof setInterval> | undefined;
  let clockTimer: ReturnType<typeof setInterval> | undefined;
  let now = $state(Date.now());

  // Finish flow
  let showFinishConfirm = $state(false);
  let isCompleted = $state(false);
  let completionData = $state<{
    totalQuestions: number;
    submittedQuestions: number;
    totalScore: number;
  } | null>(null);

  const selectedQuestion = $derived(
    assessment?.questions.find((question) => question.id === selectedQuestionId) ??
      null,
  );

  const currentLanguage = $derived(
    languages.find((item) => item.id === language) ?? null,
  );

  const codeKey = $derived(`${selectedQuestionId}::${language}`);

  const code = $derived(
    codeByKey[codeKey] ?? currentLanguage?.starterCode ?? "",
  );

  const unansweredQuestions = $derived(
    assessment
      ? assessment.questions.filter(
          (question) => !submissions.some((s) => s.questionId === question.id),
        )
      : [],
  );

  // The clock runs from the moment the candidate opened the assessment, which
  // the server records the first time GET /take/:token is called.
  const deadline = $derived(
    assessment && startedAt
      ? new Date(startedAt).getTime() + assessment.duration * 60_000
      : null,
  );

  const msRemaining = $derived(deadline ? Math.max(0, deadline - now) : null);

  const timeRemaining = $derived(
    msRemaining === null
      ? "--:--"
      : `${String(Math.floor(msRemaining / 60_000)).padStart(2, "0")}:${String(
          Math.floor((msRemaining % 60_000) / 1000),
        ).padStart(2, "0")}`,
  );

  const isOutOfTime = $derived(msRemaining !== null && msRemaining === 0);
  const isLocked = $derived(isCompleted || isOutOfTime);

  function setCode(value: string) {
    codeByKey = { ...codeByKey, [codeKey]: value };
  }

  function reportEvent(type: string, extra: Record<string, unknown> = {}) {
    // Fire-and-forget over the socket — a dropped event shouldn't interrupt
    // the candidate's assessment.
    socketStore.emit("candidate:event", { type, ...extra });
  }

  function handleVisibilityChange() {
    reportEvent("visibilitychange", { hidden: document.hidden });
  }

  function handleWindowBlur() {
    reportEvent("blur");
  }

  function handleWindowFocus() {
    reportEvent("focus");
  }

  function handleCopy() {
    reportEvent("copy");
  }

  function handlePaste(e: ClipboardEvent) {
    const pastedLength = e.clipboardData?.getData("text")?.length ?? 0;
    reportEvent("paste", { pastedLength });
  }

  function handleFullscreenExit() {
    if (!document.fullscreenElement) {
      reportEvent("fullscreen_exit");
    }
  }

  async function loadAssessment() {
    error = "";
    loading = true;
    loadingQuestion = true;

    try {
      const response = await api.get<{
        assessment: Assessment;
        invitation: { id: string; startedAt: string; expiresAt: string };
      }>(`/assessments/take/${assessmentToken}`, { auth: false });

      assessment = response.assessment;
      startedAt = response.invitation.startedAt;
      selectedQuestionId = assessment.questions[0]?.id ?? "";

      await loadSubmissions();
      message = "Assessment loaded. Good luck!";
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load assessment";
    } finally {
      loading = false;
      loadingQuestion = false;
    }
  }

  async function loadSubmissions() {
    try {
      submissions = await api.get<Submission[]>(
        `/assessments/take/${assessmentToken}/submissions`,
        { auth: false },
      );
    } catch (err) {
      console.error("Failed to load submissions:", err);
    }
  }

  onMount(async () => {
    languages = await loadLanguages();
    language = defaultLanguage(languages)?.id ?? "javascript";

    await loadAssessment();

    try {
      await socketStore.connect(undefined, assessmentToken);
      socketStore.emit("candidate:join");
    } catch (err) {
      console.error("Live monitoring connection failed:", err);
    }

    // Execution is queued, so poll while anything is still in flight.
    submissionRefreshTimer = setInterval(() => {
      if (
        submissions.some((submission) =>
          ["PENDING", "RUNNING"].includes(submission.status),
        )
      ) {
        loadSubmissions();
      }
    }, 2000);

    clockTimer = setInterval(() => (now = Date.now()), 1000);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("fullscreenchange", handleFullscreenExit);
  });

  onDestroy(() => {
    if (submissionRefreshTimer) clearInterval(submissionRefreshTimer);
    if (clockTimer) clearInterval(clockTimer);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("blur", handleWindowBlur);
    window.removeEventListener("focus", handleWindowFocus);
    document.removeEventListener("copy", handleCopy);
    document.removeEventListener("paste", handlePaste);
    document.removeEventListener("fullscreenchange", handleFullscreenExit);
    socketStore.disconnect();
  });

  // Submits the current question's code as the candidate's answer for that
  // question. Re-submitting replaces the previous answer.
  async function submitCode() {
    if (!assessment || !selectedQuestionId || isLocked) return;

    error = "";
    message = "";
    runError = "";
    isSubmitting = true;

    try {
      await api.post(
        `/submissions`,
        {
          token: assessmentToken,
          questionId: selectedQuestionId,
          code,
          language,
          isFinal: true,
        },
        { auth: false },
      );

      message = "✅ Answer submitted — running against all test cases…";

      socketStore.emit("candidate:submitted", {
        questionId: selectedQuestionId,
      });

      await loadSubmissions();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to submit code";
    } finally {
      isSubmitting = false;
    }
  }

  // Practice run against the visible test cases only. Nothing is persisted.
  async function runCode() {
    if (!assessment || !selectedQuestionId || isLocked) return;

    error = "";
    message = "";
    runError = "";
    runResults = [];
    isRunning = true;

    try {
      const response = await api.post<{
        results: RunResult[];
        error?: string;
        summary: { passed: number; failed: number; total: number };
      }>(
        `/submissions/test`,
        {
          token: assessmentToken,
          questionId: selectedQuestionId,
          code,
          language,
        },
        { auth: false },
      );

      if (response.error) {
        runError = response.error;
        return;
      }

      runResults = response.results;
      message = `Passed ${response.summary.passed}/${response.summary.total} visible test cases`;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to run code";
    } finally {
      isRunning = false;
    }
  }

  function requestFinish() {
    showFinishConfirm = true;
  }

  async function confirmFinish() {
    isFinishing = true;
    error = "";
    try {
      const response = await api.post<{
        invitation: { completedAt: string | null };
        unansweredQuestions: number;
      }>(`/assessments/take/${assessmentToken}/finish`, {}, { auth: false });

      const totalQuestions = assessment?.questions.length ?? 0;
      completionData = {
        totalQuestions,
        submittedQuestions: totalQuestions - response.unansweredQuestions,
        totalScore: submissions.reduce((sum, s) => sum + (s.passed ?? 0), 0),
      };
      isCompleted = true;
      showFinishConfirm = false;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to finish assessment";
      showFinishConfirm = false;
    } finally {
      isFinishing = false;
    }
  }

  function getDifficultyColor(difficulty: string) {
    const colors = {
      EASY: "#10b981",
      MEDIUM: "#f59e0b",
      HARD: "#ef4444",
    };
    return colors[difficulty as keyof typeof colors] || "#6b7280";
  }

  function getQuestionStatus(questionId: string): string {
    return (
      submissions.find((submission) => submission.questionId === questionId)
        ?.status ?? "Not Started"
    );
  }

  function preview(value: unknown) {
    return value === undefined ? "—" : JSON.stringify(value);
  }
</script>

<main class="workspace">
  <!-- Navigation Bar -->
  <nav class="navbar">
    <div class="nav-brand">
      <div class="brand-icon">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect
            x="2"
            y="2"
            width="28"
            height="28"
            rx="8"
            stroke="#10b981"
            stroke-width="2.5"
          />
          <path
            d="M10 16L14 20L22 12"
            stroke="#10b981"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <div>
        <h1>CodeBench</h1>
        <span class="role-badge">Candidate</span>
      </div>
    </div>
    <div class="nav-actions">
      {#if deadline}
        <div
          class="countdown"
          class:urgent={msRemaining !== null && msRemaining < 5 * 60_000}
          class:expired={isOutOfTime}
        >
          <span class="countdown-icon">⏱</span>
          <span class="countdown-value">{timeRemaining}</span>
        </div>
      {/if}
      <div class="progress-indicator">
        <span class="progress-text">
          {submissions.length}/{assessment?.questions.length || 0} answered
        </span>
        <div class="progress-bar">
          <div
            class="progress-fill"
            style="width: {assessment && assessment.questions.length
              ? (submissions.length / assessment.questions.length) * 100
              : 0}%"
          ></div>
        </div>
      </div>
      <button
        class="finish-btn"
        onclick={requestFinish}
        disabled={!assessment || isCompleted}
      >
        Finish Assessment
      </button>
    </div>
  </nav>

  {#if isOutOfTime && !isCompleted}
    <div class="message-banner error">
      <span class="banner-icon">⏰</span>
      <span>
        Your time is up. Submit the assessment to record the answers you have
        already sent.
      </span>
    </div>
  {/if}

  <!-- Loader Section -->
  {#if loading}
    <section class="loader-section">
      <div class="loader-card">
        <div class="loader-header">
          <h2>
            🚀 {loadingQuestion
              ? "Launching assessment…"
              : "Assessment loaded…"}
          </h2>
        </div>
      </div>
    </section>
  {/if}

  <!-- Messages -->
  {#if error}
    <div class="message-banner error" transition:fade={{ duration: 300 }}>
      <span class="banner-icon">⚠️</span>
      <span>{error}</span>
      <button class="close-banner" onclick={() => (error = "")}>✕</button>
    </div>
  {/if}

  <!-- Main Assessment Workspace -->
  {#if assessment}
    <section class="assessment-workspace" transition:slide={{ duration: 400 }}>
      <div class="workspace-header">
        <div class="workspace-title">
          <h2>{assessment.title}</h2>
          <div class="workspace-meta">
            <span class="meta-item">
              <span class="meta-icon">⏱️</span>
              {assessment.duration} minutes
            </span>
            <span class="meta-item">
              <span class="meta-icon">📝</span>
              {assessment.questions.length} questions
            </span>
            <span class="meta-item">
              <span class="meta-icon">✅</span>
              {submissions.length} answered
            </span>
          </div>
        </div>
        {#if assessment.description}
          <p class="workspace-description">{assessment.description}</p>
        {/if}
      </div>

      <div class="workspace-grid">
        <!-- Question Sidebar -->
        <aside class="question-sidebar">
          <div class="sidebar-header">
            <h3>Questions</h3>
            <span class="question-count">{assessment.questions.length}</span>
          </div>
          <div class="question-list">
            {#each assessment.questions as question, index}
              <button
                class="question-item"
                class:active={selectedQuestionId === question.id}
                class:completed={getQuestionStatus(question.id) === "COMPLETED"}
                onmouseenter={() => (hoveredQuestion = question.id)}
                onmouseleave={() => (hoveredQuestion = null)}
                onclick={() => (selectedQuestionId = question.id)}
                transition:slide={{ duration: 200, delay: index * 30 }}
              >
                <div class="question-indicator">
                  <span class="q-number">{index + 1}</span>
                </div>
                <div class="question-info">
                  <span class="question-title">{question.title}</span>
                  <div class="question-tags">
                    <span
                      class="difficulty-badge"
                      style="background: {getDifficultyColor(
                        question.difficulty,
                      )}20; color: {getDifficultyColor(question.difficulty)}"
                    >
                      {question.difficulty}
                    </span>
                    <span class="points-badge">{question.points} pts</span>
                    {#if getQuestionStatus(question.id) === "COMPLETED"}
                      <span class="status-badge completed">✓ Submitted</span>
                    {:else if getQuestionStatus(question.id) === "FAILED"}
                      <span class="status-badge failed">✗ Error</span>
                    {:else if ["PENDING", "RUNNING"].includes(getQuestionStatus(question.id))}
                      <span class="status-badge">⏳ Running</span>
                    {/if}
                  </div>
                </div>
                {#if hoveredQuestion === question.id && selectedQuestionId !== question.id}
                  <span class="hover-arrow">→</span>
                {/if}
              </button>
            {/each}
          </div>
        </aside>

        <!-- Code Editor -->
        <div class="editor-panel">
          {#if selectedQuestion}
            <div class="question-header">
              <div class="question-title-section">
                <h3>{selectedQuestion.title}</h3>
                <div class="question-badges">
                  <span
                    class="difficulty-badge"
                    style="background: {getDifficultyColor(
                      selectedQuestion.difficulty,
                    )}20; color: {getDifficultyColor(
                      selectedQuestion.difficulty,
                    )}"
                  >
                    {selectedQuestion.difficulty}
                  </span>
                  <span class="points-badge"
                    >{selectedQuestion.points} points</span
                  >
                </div>
              </div>
              <p class="question-description">{selectedQuestion.description}</p>
            </div>
          {/if}

          <div class="editor-controls">
            <div class="language-selector">
              <label for="language-select">Language</label>
              <select id="language-select" bind:value={language} disabled={isLocked}>
                {#each languages as option (option.id)}
                  <option value={option.id}>{option.label}</option>
                {/each}
              </select>
            </div>
            <div class="editor-actions">
              <button
                class="fullscreen-btn"
                onclick={() => (isFullscreen = !isFullscreen)}
                title="Toggle a larger editor"
              >
                ⛶
              </button>
            </div>
          </div>

          <div class="code-editor" class:fullscreen={isFullscreen}>
            <!-- Keyed so switching question or language builds a fresh editor
                 rather than trying to reconcile an unrelated buffer. -->
            {#key `${selectedQuestionId}-${language}`}
              <MonacoEditor
                value={code}
                onChange={setCode}
                language={currentLanguage?.editorLanguage ?? "javascript"}
                readOnly={isLocked}
                questionId={selectedQuestionId}
              />
            {/key}
          </div>

          {#if runError}
            <div class="run-panel run-panel-error" transition:slide={{ duration: 200 }}>
              <p class="run-panel-title">Your code could not run</p>
              <pre>{runError}</pre>
            </div>
          {:else if runResults.length}
            <div class="run-panel" transition:slide={{ duration: 200 }}>
              <p class="run-panel-title">
                Sample test cases — {runResults.filter((r) => r.passed).length}/{runResults.length}
                passed
              </p>
              <ul class="run-list">
                {#each runResults as result, index (index)}
                  <li class="run-item" class:failed={!result.passed}>
                    <span class="run-verdict">{result.passed ? "✓" : "✗"}</span>
                    <span class="run-detail">
                      Test {index + 1}
                      {#if result.error}
                        — {result.error}
                      {:else if !result.passed}
                        — expected {preview(result.expected)}, got {preview(result.output)}
                      {/if}
                      {#if result.stdout}
                        <span class="run-stdout">{result.stdout}</span>
                      {/if}
                    </span>
                  </li>
                {/each}
              </ul>
              <p class="run-note">
                Hidden test cases are only checked when you submit.
              </p>
            </div>
          {/if}

          <div class="action-bar">
            <div class="action-left">
              <button
                class="action-btn run-btn"
                onclick={runCode}
                disabled={isRunning || isLocked}
                transition:scale={{ duration: 150 }}
              >
                <span class="btn-icon">▶</span>
                {isRunning ? "Running…" : "Run Code"}
              </button>
            </div>
            <div class="action-right">
              <button
                class="action-btn submit-btn"
                onclick={submitCode}
                disabled={isSubmitting || isLocked}
                transition:scale={{ duration: 150 }}
              >
                <span class="btn-icon">📤</span>
                {isSubmitting ? "Submitting…" : "Submit Answer"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
    {#if message}
      <div class="message-banner success" transition:fade={{ duration: 300 }}>
        <span class="banner-icon">✨</span>
        <span>{message}</span>
        <button class="close-banner" onclick={() => (message = "")}>✕</button>
      </div>
    {/if}
  {/if}
</main>

<!-- Finish confirmation modal -->
{#if showFinishConfirm}
  <div class="modal-backdrop" transition:fade={{ duration: 200 }}>
    <div class="modal-card" transition:scale={{ duration: 250 }}>
      <div class="modal-icon">🏁</div>
      <h2>Finish assessment?</h2>
      {#if unansweredQuestions.length > 0}
        <p class="modal-text">
          You still have <strong>{unansweredQuestions.length}</strong>
          {unansweredQuestions.length === 1 ? "question" : "questions"} unanswered.
          Once you finish, you won't be able to submit any more answers.
        </p>
      {:else}
        <p class="modal-text">
          You've answered every question. Once you finish, you won't be able to
          submit any more answers.
        </p>
      {/if}
      <div class="modal-actions">
        <button
          class="ghost-modal-btn"
          onclick={() => (showFinishConfirm = false)}
          disabled={isFinishing}
        >
          Keep working
        </button>
        <button
          class="primary-btn"
          onclick={confirmFinish}
          disabled={isFinishing}
        >
          {isFinishing ? "Finishing…" : "Yes, finish"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Completion modal -->
{#if isCompleted && completionData}
  <div class="modal-backdrop" transition:fade={{ duration: 300 }}>
    <div
      class="modal-card completion-card"
      transition:scale={{ duration: 350 }}
    >
      <div class="completion-icon">🎉</div>
      <h1>Assessment Complete!</h1>
      <p class="completion-subtitle">Your results have been recorded</p>

      <div class="completion-stats">
        <div class="stat-box">
          <span class="stat-number">{completionData.totalQuestions}</span>
          <span class="stat-label">Total Questions</span>
        </div>
        <div class="stat-box">
          <span class="stat-number">{completionData.submittedQuestions}</span>
          <span class="stat-label">Submitted</span>
        </div>
        <div class="stat-box">
          <span class="stat-number">{completionData.totalScore}</span>
          <span class="stat-label">Total Score</span>
        </div>
      </div>

      <div class="completion-actions">
        <button class="primary-btn" onclick={() => window.close()}>
          Close Window
        </button>
      </div>

      <p class="completion-note">The recruiter will review your submissions.</p>
    </div>
  </div>
{/if}

<style>
  .workspace {
    min-height: 100vh;
    background: #0a0e0c;
    color: #e7f0ec;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
      Ubuntu, sans-serif;
  }

  /* Navbar */
  .navbar {
    background: #111815;
    border-bottom: 1px solid #1a2420;
    padding: 12px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(12px);
  }

  .nav-brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .brand-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 10px;
    border: 1px solid rgba(16, 185, 129, 0.2);
  }

  .nav-brand h1 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 700;
    background: linear-gradient(135deg, #10b981, #34d399);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .role-badge {
    font-size: 0.7rem;
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    padding: 2px 10px;
    border-radius: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .nav-actions {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .countdown {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 8px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #34d399;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  .countdown.urgent {
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.3);
    color: #fbbf24;
  }

  .countdown.expired {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  .countdown-value {
    font-size: 1rem;
    letter-spacing: 0.04em;
  }

  /* Results of a practice run against the visible test cases. */
  .run-panel {
    margin: 0 20px 12px;
    padding: 14px 16px;
    border-radius: 10px;
    background: #111815;
    border: 1px solid #1a2420;
  }

  .run-panel-error pre {
    margin: 8px 0 0;
    white-space: pre-wrap;
    color: #f87171;
    font-size: 0.8rem;
  }

  .run-panel-title {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 700;
    color: #e7f0ec;
  }

  .run-list {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }

  .run-item {
    display: flex;
    gap: 8px;
    font-size: 0.8rem;
    color: #9fb3ab;
  }

  .run-verdict {
    color: #34d399;
    font-weight: 700;
  }

  .run-item.failed .run-verdict {
    color: #f87171;
  }

  .run-stdout {
    display: block;
    margin-top: 4px;
    padding: 6px 8px;
    border-radius: 6px;
    background: #0a0e0c;
    color: #6b7f77;
    white-space: pre-wrap;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .run-note {
    margin: 10px 0 0;
    font-size: 0.72rem;
    color: #6b7f77;
  }

  .finish-btn {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: none;
    padding: 8px 18px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .finish-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
  }

  .finish-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Loader Section */
  .loader-section {
    padding: 32px;
    max-width: 800px;
    margin: 0 auto;
  }

  .loader-card {
    background: #111815;
    border: 1px solid #1a2420;
    border-radius: 16px;
    padding: 16px;
  }

  .loader-header h2 {
    margin: 0 0 4px 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  /* Messages */
  .message-banner {
    margin: 16px 32px;
    padding: 14px 20px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px solid;
  }

  .message-banner.error {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .message-banner.success {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }

  .banner-icon {
    font-size: 1.2rem;
  }

  .close-banner {
    margin-left: auto;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    opacity: 0.6;
    font-size: 0.9rem;
  }

  .close-banner:hover {
    opacity: 1;
  }

  /* Assessment Workspace */
  .assessment-workspace {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 32px 32px;
  }

  .workspace-header {
    background: #111815;
    border: 1px solid #1a2420;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
  }

  .workspace-title {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 12px;
  }

  .workspace-title h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .workspace-meta {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #8a9892;
    font-size: 0.85rem;
  }

  .workspace-description {
    margin: 12px 0 0 0;
    color: #8a9892;
    font-size: 0.95rem;
  }

  .workspace-grid {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 24px;
  }

  /* Question Sidebar */
  .question-sidebar {
    background: #111815;
    border: 1px solid #1a2420;
    border-radius: 12px;
    overflow: hidden;
    max-height: 700px;
    display: flex;
    flex-direction: column;
  }

  .sidebar-header {
    padding: 16px 20px;
    border-bottom: 1px solid #1a2420;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .sidebar-header h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .question-count {
    background: #1a2420;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    color: #8a9892;
  }

  .question-list {
    overflow-y: auto;
    padding: 8px;
    flex: 1;
  }

  .question-item {
    width: 100%;
    padding: 12px 14px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: #8a9892;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    position: relative;
  }

  .question-item:hover {
    background: #1a2420;
    color: #e7f0ec;
  }

  .question-item.active {
    background: rgba(16, 185, 129, 0.1);
    color: #e7f0ec;
    border: 1px solid rgba(16, 185, 129, 0.2);
  }

  .question-item.completed {
    border-left: 3px solid #10b981;
  }

  .question-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 24px;
  }

  .q-number {
    font-size: 0.75rem;
    font-weight: 600;
    opacity: 0.5;
  }

  .question-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .question-title {
    font-size: 0.9rem;
    font-weight: 500;
  }

  .question-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }

  .difficulty-badge {
    font-size: 0.65rem;
    padding: 1px 8px;
    border-radius: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .points-badge {
    font-size: 0.65rem;
    padding: 1px 8px;
    border-radius: 10px;
    background: #1a2420;
    color: #8a9892;
  }

  .status-badge {
    font-size: 0.6rem;
    padding: 1px 6px;
    border-radius: 8px;
    font-weight: 600;
  }

  .status-badge.completed {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .status-badge.failed {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .hover-arrow {
    color: #10b981;
    font-size: 0.8rem;
  }

  /* Editor Panel */
  .editor-panel {
    background: #111815;
    border: 1px solid #1a2420;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .question-header {
    padding: 20px 24px;
    border-bottom: 1px solid #1a2420;
  }

  .question-title-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 8px;
  }

  .question-title-section h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .question-badges {
    display: flex;
    gap: 8px;
  }

  .question-description {
    margin: 0;
    color: #8a9892;
    font-size: 0.95rem;
    line-height: 1.6;
  }

  .editor-controls {
    padding: 12px 24px;
    border-bottom: 1px solid #1a2420;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .language-selector {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .language-selector label {
    font-size: 0.85rem;
    color: #8a9892;
  }

  .language-selector select {
    background: #0a0e0c;
    border: 1px solid #1a2420;
    border-radius: 6px;
    padding: 6px 12px;
    color: #e7f0ec;
    font-size: 0.85rem;
    cursor: pointer;
    outline: none;
  }

  .language-selector select:focus {
    border-color: #10b981;
  }

  .fullscreen-btn {
    background: none;
    border: 1px solid #1a2420;
    color: #8a9892;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1.1rem;
    transition: all 0.2s ease;
  }

  .fullscreen-btn:hover {
    background: #1a2420;
    color: #e7f0ec;
  }

  .code-editor {
    flex: 1;
    display: flex;
    background: #0a0e0c;
    position: relative;
    min-height: 400px;
  }

  .code-editor.fullscreen {
    position: fixed;
    inset: 0;
    z-index: 1000;
    min-height: 100vh;
    border-radius: 0;
  }




  .action-bar {
    padding: 16px 24px;
    border-top: 1px solid #1a2420;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .action-left,
  .action-right {
    display: flex;
    gap: 10px;
  }

  .action-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .run-btn {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .run-btn:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.25);
    transform: translateY(-1px);
  }

  .submit-btn {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
  }

  .submit-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
  }

  .btn-icon {
    font-size: 1rem;
  }

  /* Progress indicator in navbar */
  .progress-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .progress-text {
    font-size: 0.8rem;
    color: #8a9892;
    white-space: nowrap;
  }

  .progress-bar {
    width: 100px;
    height: 4px;
    background: #1a2420;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #34d399);
    border-radius: 2px;
    transition: width 0.6s ease;
  }

  /* Modals (shared backdrop for finish-confirm and completion) */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 14, 12, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 24px;
  }

  .modal-card {
    background: #111815;
    border: 1px solid #1a2420;
    border-radius: 20px;
    padding: 40px;
    max-width: 460px;
    width: 100%;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .modal-icon {
    font-size: 3rem;
    margin-bottom: 12px;
    display: block;
  }

  .modal-card h2 {
    margin: 0 0 12px 0;
    font-size: 1.4rem;
    font-weight: 700;
  }

  .modal-text {
    color: #8a9892;
    font-size: 0.95rem;
    line-height: 1.6;
    margin: 0 0 28px 0;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .ghost-modal-btn {
    background: transparent;
    color: #8a9892;
    border: 1px solid #1a2420;
    padding: 10px 20px;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .ghost-modal-btn:hover:not(:disabled) {
    background: #1a2420;
    color: #e7f0ec;
  }

  .ghost-modal-btn:disabled,
  .primary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Completion card (extends modal-card) */
  .completion-icon {
    font-size: 4rem;
    margin-bottom: 16px;
    display: block;
    animation: bounce 1s ease infinite;
  }

  @keyframes bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  .completion-card h1 {
    margin: 0 0 8px 0;
    font-size: 2rem;
    font-weight: 700;
    background: linear-gradient(135deg, #10b981, #34d399);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .completion-subtitle {
    color: #8a9892;
    font-size: 1rem;
    margin-bottom: 32px;
  }

  .completion-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 32px;
  }

  .stat-box {
    background: #0a0e0c;
    border: 1px solid #1a2420;
    border-radius: 12px;
    padding: 16px;
  }

  .stat-number {
    display: block;
    font-size: 1.8rem;
    font-weight: 700;
    color: #10b981;
  }

  .stat-label {
    display: block;
    font-size: 0.75rem;
    color: #5f6b66;
    margin-top: 4px;
  }

  .completion-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-bottom: 16px;
  }

  .primary-btn {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
  }

  .primary-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
  }

  .completion-note {
    font-size: 0.85rem;
    color: #5f6b66;
    margin: 0;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .workspace-grid {
      grid-template-columns: 1fr;
    }

    .question-sidebar {
      max-height: 300px;
    }
  }

  @media (max-width: 768px) {
    .navbar {
      padding: 12px 16px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .loader-section {
      padding: 16px;
    }

    .loader-card {
      padding: 20px;
    }

    .assessment-workspace {
      padding: 0 16px 16px;
    }

    .workspace-title {
      flex-direction: column;
    }

    .workspace-meta {
      flex-wrap: wrap;
    }

    .action-bar {
      flex-direction: column;
    }

    .action-left,
    .action-right {
      width: 100%;
    }

    .action-btn {
      flex: 1;
      justify-content: center;
    }

    .progress-bar {
      width: 60px;
    }

    .nav-actions {
      flex-wrap: wrap;
      width: 100%;
    }

    .completion-stats {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 480px) {
    .nav-brand h1 {
      font-size: 1.1rem;
    }

    .question-title-section {
      flex-direction: column;
      align-items: flex-start;
    }

    .editor-controls {
      flex-direction: column;
      align-items: stretch;
    }

    .code-editor {
      min-height: 300px;
    }

    .modal-card {
      padding: 28px 20px;
    }

    .completion-icon {
      font-size: 3rem;
    }

    .completion-card h1 {
      font-size: 1.5rem;
    }

    .message-banner {
      margin: 12px 16px;
      padding: 12px 16px;
    }
  }
</style>

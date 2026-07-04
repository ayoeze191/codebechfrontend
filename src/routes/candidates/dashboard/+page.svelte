<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import { auth } from "$lib/auth";
  import { socketStore } from "$stores/socketStore";
  import { fade, slide, scale } from "svelte/transition";
  import { flip } from "svelte/animate";

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
    assessmentTitle: string;
    questionTitle: string;
    status: string;
    passed?: number;
    failed?: number;
    createdAt: string;
  };

  const defaultValue =
    "module.exports = function(a, b) { \n return a + b;\n };";
  let assessmenttoken = $state("");
  let assessment = $state<Assessment | null>(null);
  let selectedQuestionId = $state("");
  let code = $state(defaultValue);
  let language = $state("javascript");
  let submissions = $state<Submission[]>([]);
  let message = $state("");
  let error = $state("");
  let loading = $state(false);
  let isFullscreen = $state(false);
  let isSubmitting = $state(false);
  let hoveredQuestion = $state<string | null>(null);

  const selectedQuestion = $derived(
    assessment?.questions.find(
      (question) => question.id === selectedQuestionId,
    ) ?? null,
  );

  onMount(async () => {
    auth.init();
    await loadSubmissions();
  });

  async function loadSubmissions() {
    try {
      const response = await api.get<{ data: Submission[] }>(
        "/submissions/candidate/me",
      );
      submissions = response.data;
    } catch {
      submissions = [];
    }
  }

  async function loadAssessment() {
    error = "";
    message = "";
    loading = true;

    try {
      assessment = await api.get<Assessment>(`/assessments/${assessmenttoken}`);
      selectedQuestionId = assessment.questions[0]?.id ?? "";
      await socketStore.connect();
      socketStore.emit("candidate:join", { assessmenttoken });
      message = "Assessment loaded successfully";
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load assessment";
    } finally {
      loading = false;
    }
  }

  async function submitCode(isFinal = false) {
    if (!assessment || !selectedQuestionId) return;

    error = "";
    message = "";
    isSubmitting = true;

    try {
      const response = await api.post<{ submissionId: string; status: string }>(
        "/submissions",
        {
          assessmenttoken: assessment.id,
          questionId: selectedQuestionId,
          code,
          language,
          isFinal,
        },
      );

      message = `✅ Submission ${isFinal ? "finalized" : "queued"}: ${response.submissionId}`;
      socketStore.emit("candidate:submitted", {
        assessmenttoken: assessment.id,
      });
      await loadSubmissions();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to submit code";
    } finally {
      isSubmitting = false;
    }
  }

  async function runCode() {
    error = "";
    message = "";
    loading = true;
    try {
      const response = await api.post<{
        summary: { passed: number; failed: number; total: number };
      }>("/submissions/test", {
        assessmenttoken: assessment?.id,
        code,
        language,
        testCases: selectedQuestion?.testCases ?? [
          { input: { a: 1, b: 2 }, expectedOutput: 3 },
        ],
      });
      message = `✅ Passed ${response.summary.passed}/${response.summary.total} test cases`;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to run code";
    } finally {
      loading = false;
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

  function getStatusEmoji(status: string) {
    const emojis = {
      PASSED: "✅",
      FAILED: "❌",
      PENDING: "⏳",
      RUNNING: "🔄",
    };
    return emojis[status as keyof typeof emojis] || "📝";
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
        <h1>CodeWorks</h1>
        <span class="role-badge">Candidate</span>
      </div>
    </div>
    <div class="nav-actions">
      <button class="ghost-btn" onclick={() => auth.logout()}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Sign Out
      </button>
    </div>
  </nav>

  <!-- Loader Section -->
  <section class="loader-section">
    <div class="loader-card">
      <div class="loader-header">
        <h2>🚀 Launch Assessment</h2>
        <p>Enter the assessment ID to begin your coding challenge</p>
      </div>
      <div class="loader-input-group">
        <div class="input-wrapper">
          <span class="input-icon">🔑</span>
          <input
            bind:value={assessmenttoken}
            placeholder="Enter assessment ID..."
            onkeydown={(e) => e.key === "Enter" && loadAssessment()}
          />
          {#if assessmenttoken}
            <button class="clear-input" onclick={() => (assessmenttoken = "")}
              >✕</button
            >
          {/if}
        </div>
        <button
          class="primary-btn load-btn"
          onclick={loadAssessment}
          disabled={loading || !assessmenttoken}
          transition:scale={{ duration: 150 }}
        >
          {#if loading}
            <span class="spinner"></span>
            Loading...
          {:else}
            <span>→</span>
            Load Assessment
          {/if}
        </button>
      </div>
    </div>
  </section>

  <!-- Messages -->
  {#if error}
    <div class="message-banner error" transition:fade={{ duration: 300 }}>
      <span class="banner-icon">⚠️</span>
      <span>{error}</span>
      <button class="close-banner" onclick={() => (error = "")}>✕</button>
    </div>
  {/if}
  {#if message}
    <div class="message-banner success" transition:fade={{ duration: 300 }}>
      <span class="banner-icon">✨</span>
      <span>{message}</span>
      <button class="close-banner" onclick={() => (message = "")}>✕</button>
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
                onmouseenter={() => (hoveredQuestion = question.id)}
                onmouseleave={() => (hoveredQuestion = null)}
                onclick={() => (selectedQuestionId = question.id)}
                transition:slide={{ duration: 200, delay: index * 30 }}
              >
                <div class="question-indicator">
                  <span class="q-number">{index + 1}</span>
                  {#if selectedQuestionId === question.id}
                    <span class="active-indicator">●</span>
                  {/if}
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
              <label>Language</label>
              <select bind:value={language}>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="go">Go</option>
              </select>
            </div>
            <div class="editor-actions">
              <button
                class="fullscreen-btn"
                onclick={() => (isFullscreen = !isFullscreen)}
              >
                {isFullscreen ? "⛶" : "⛶"}
              </button>
            </div>
          </div>

          <div class="code-editor" class:fullscreen={isFullscreen}>
            <div class="editor-line-numbers">
              {#each Array(code.split("\n").length) as _, i}
                <span>{i + 1}</span>
              {/each}
            </div>
            <textarea
              bind:value={code}
              spellcheck="false"
              class="code-input"
              onkeydown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const start = e.currentTarget.selectionStart;
                  const end = e.currentTarget.selectionEnd;
                  code = code.substring(0, start) + "  " + code.substring(end);
                  setTimeout(() => {
                    e.currentTarget.selectionStart =
                      e.currentTarget.selectionEnd = start + 2;
                  }, 0);
                }
              }}
            ></textarea>
          </div>

          <div class="action-bar">
            <div class="action-left">
              <button
                class="action-btn run-btn"
                onclick={runCode}
                disabled={loading}
                transition:scale={{ duration: 150 }}
              >
                <span class="btn-icon">▶</span>
                Run Code
              </button>
            </div>
            <div class="action-right">
              <button
                class="action-btn submit-btn"
                onclick={() => submitCode(false)}
                disabled={isSubmitting}
                transition:scale={{ duration: 150 }}
              >
                <span class="btn-icon">📤</span>
                Submit
              </button>
              <button
                class="action-btn final-btn"
                onclick={() => submitCode(true)}
                disabled={isSubmitting}
                transition:scale={{ duration: 150 }}
              >
                <span class="btn-icon">🏁</span>
                Final Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  {/if}

  <!-- Submissions Section -->
  <section class="submissions-section">
    <div class="submissions-header">
      <h2>📊 My Submissions</h2>
      <span class="submission-count">{submissions.length} total</span>
    </div>
    <div class="submissions-grid">
      {#each submissions as submission}
        <div class="submission-card" transition:slide={{ duration: 300 }}>
          <div class="submission-header">
            <div class="submission-title">
              <strong>{submission.assessmentTitle}</strong>
              <span class="submission-question">{submission.questionTitle}</span
              >
            </div>
            <span class="submission-status">
              {getStatusEmoji(submission.status)}
              {submission.status}
            </span>
          </div>
          <div class="submission-details">
            <div class="submission-meta">
              <span
                >📅 {new Date(submission.createdAt).toLocaleDateString()}</span
              >
              <span
                >🕐 {new Date(submission.createdAt).toLocaleTimeString()}</span
              >
            </div>
            {#if submission.passed !== undefined}
              <div class="submission-score">
                <div class="score-bar">
                  <div
                    class="score-fill"
                    style="width: {((submission.passed || 0) /
                      ((submission.passed || 0) + (submission.failed || 0) ||
                        1)) *
                      100}%"
                  ></div>
                </div>
                <span class="score-text">
                  {submission.passed ?? 0}/{(submission.passed ?? 0) +
                    (submission.failed ?? 0)} passed
                </span>
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="empty-state">
          <span class="empty-icon">📭</span>
          <h3>No submissions yet</h3>
          <p>Start solving questions to see your submissions here</p>
        </div>
      {/each}
    </div>
  </section>
</main>

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
    gap: 12px;
  }

  .ghost-btn {
    background: transparent;
    color: #8a9892;
    border: 1px solid #1a2420;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
  }

  .ghost-btn:hover {
    background: #1a2420;
    color: #e7f0ec;
    border-color: #2a3832;
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
    padding: 32px;
  }

  .loader-header h2 {
    margin: 0 0 4px 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .loader-header p {
    margin: 0 0 20px 0;
    color: #8a9892;
    font-size: 0.95rem;
  }

  .loader-input-group {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .input-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    background: #0a0e0c;
    border: 1px solid #1a2420;
    border-radius: 10px;
    transition: all 0.3s ease;
  }

  .input-wrapper:focus-within {
    border-color: #10b981;
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
  }

  .input-icon {
    padding: 0 12px;
    opacity: 0.5;
  }

  .input-wrapper input {
    flex: 1;
    background: transparent;
    border: none;
    padding: 12px 8px;
    color: #e7f0ec;
    font-size: 0.95rem;
    outline: none;
  }

  .input-wrapper input::placeholder {
    color: #5f6b66;
  }

  .clear-input {
    background: none;
    border: none;
    color: #5f6b66;
    padding: 0 12px;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .clear-input:hover {
    color: #e7f0ec;
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
  }

  .primary-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
  }

  .primary-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
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
    padding: 0 32px 32px;
    max-width: 1400px;
    margin: 0 auto;
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

  .active-indicator {
    color: #10b981;
    font-size: 0.5rem;
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

  .editor-line-numbers {
    padding: 16px 12px;
    background: #0a0e0c;
    color: #5f6b66;
    font-family: "Courier New", monospace;
    font-size: 0.85rem;
    line-height: 1.6;
    text-align: right;
    user-select: none;
    min-width: 40px;
  }

  .code-input {
    flex: 1;
    background: transparent;
    border: none;
    padding: 16px;
    color: #e7f0ec;
    font-family: "Courier New", monospace;
    font-size: 0.85rem;
    line-height: 1.6;
    resize: vertical;
    outline: none;
    tab-size: 2;
  }

  .code-input::selection {
    background: rgba(16, 185, 129, 0.2);
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
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .submit-btn:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.25);
    transform: translateY(-1px);
  }

  .final-btn {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
  }

  .final-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
  }

  .btn-icon {
    font-size: 1rem;
  }

  /* Submissions Section */
  .submissions-section {
    padding: 32px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .submissions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .submissions-header h2 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 600;
  }

  .submission-count {
    background: #1a2420;
    padding: 4px 14px;
    border-radius: 20px;
    font-size: 0.8rem;
    color: #8a9892;
  }

  .submissions-grid {
    display: grid;
    gap: 12px;
  }

  .submission-card {
    background: #111815;
    border: 1px solid #1a2420;
    border-radius: 10px;
    padding: 16px 20px;
    transition: all 0.3s ease;
  }

  .submission-card:hover {
    border-color: #2a3832;
    transform: translateX(4px);
  }

  .submission-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 8px;
  }

  .submission-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .submission-title strong {
    font-size: 0.95rem;
  }

  .submission-question {
    font-size: 0.85rem;
    color: #8a9892;
  }

  .submission-status {
    font-size: 0.85rem;
    font-weight: 500;
    padding: 4px 12px;
    border-radius: 12px;
    background: #1a2420;
  }

  .submission-details {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .submission-meta {
    display: flex;
    gap: 16px;
    font-size: 0.8rem;
    color: #5f6b66;
  }

  .submission-score {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 150px;
  }

  .score-bar {
    flex: 1;
    height: 4px;
    background: #1a2420;
    border-radius: 2px;
    overflow: hidden;
  }

  .score-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #34d399);
    border-radius: 2px;
    transition: width 0.6s ease;
  }

  .score-text {
    font-size: 0.8rem;
    color: #8a9892;
    white-space: nowrap;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    background: #111815;
    border: 1px solid #1a2420;
    border-radius: 12px;
  }

  .empty-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    margin: 0 0 8px 0;
    font-size: 1.1rem;
  }

  .empty-state p {
    margin: 0;
    color: #8a9892;
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

    .loader-input-group {
      flex-direction: column;
    }

    .primary-btn {
      width: 100%;
      justify-content: center;
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

    .submissions-section {
      padding: 16px;
    }

    .submission-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .submission-details {
      flex-direction: column;
      align-items: flex-start;
    }

    .submission-score {
      width: 100%;
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
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { api, API_URL } from "$lib/api";

  type Assessment = {
    id: string;
    title: string;
  };

  type LeaderboardEntry = {
    rank: number;
    candidateId: string;
    candidateName: string;
    score: number;
    passed: number;
    failed: number;
    total: number;
    executionTime: number;
    memoryUsed: number;
    submittedAt: string;
  };

  let assessment = $state<Assessment | null>(null);
  let results = $state<LeaderboardEntry[]>([]);
  let isLoading = $state(true);
  let error = $state("");

  onMount(async () => {
    await loadResults();
  });

  async function loadResults() {
    isLoading = true;
    error = "";

    try {
      const [assessmentResponse, leaderboardResponse] = await Promise.all([
        api.get<Assessment>(`/assessments/${page.params.id}`),
        api.get<{ leaderboard: LeaderboardEntry[] }>(
          `/submissions/assessment/${page.params.id}/leaderboard`,
        ),
      ]);
      assessment = assessmentResponse;
      results = leaderboardResponse.leaderboard;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch results";
    } finally {
      isLoading = false;
    }
  }

  function exportResults() {
    const token = localStorage.getItem("codebench_token");
    fetch(`${API_URL}/api/submissions/assessment/${page.params.id}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((response) => response.blob())
      .then((blob) => {
        const href = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = `${assessment?.title ?? "assessment"}-results.csv`;
        anchor.click();
        URL.revokeObjectURL(href);
      });
  }
</script>

<main class="results">
  <header>
    <div>
      <p>Results</p>
      <h1>{assessment?.title ?? "Assessment"}</h1>
    </div>
    <button onclick={exportResults}>Export CSV</button>
  </header>

  {#if error}
    <p class="error">{error}</p>
  {:else if isLoading}
    <div class="empty">Loading results...</div>
  {:else if results.length === 0}
    <div class="empty">No final submissions yet</div>
  {:else}
    <section class="table">
      <div class="head">
        <span>Rank</span>
        <span>Candidate</span>
        <span>Score</span>
        <span>Passed</span>
        <span>Failed</span>
        <span>Time</span>
      </div>
      {#each results as result}
        <div class="row">
          <span>{result.rank}</span>
          <span>{result.candidateName}</span>
          <span>{result.score}%</span>
          <span>{result.passed}</span>
          <span>{result.failed}</span>
          <span>{result.executionTime}ms</span>
        </div>
      {/each}
    </section>
  {/if}
</main>

<style>
  .results {
    min-height: 100vh;
    padding: 24px;
    background: #f6f7f7;
    color: #17201b;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  header p,
  h1 {
    margin: 0;
  }

  button {
    border: 0;
    border-radius: 6px;
    background: #255f4b;
    color: white;
    font-weight: 700;
    padding: 10px 14px;
    cursor: pointer;
  }

  .table {
    background: white;
    border: 1px solid #dde3df;
    border-radius: 8px;
    overflow: hidden;
  }

  .head,
  .row {
    display: grid;
    grid-template-columns: 80px 1fr 110px 100px 100px 120px;
    gap: 12px;
    padding: 12px 16px;
    align-items: center;
  }

  .head {
    background: #eef3f0;
    font-weight: 700;
  }

  .row {
    border-top: 1px solid #edf1ef;
  }

  .empty,
  .error {
    background: white;
    border: 1px solid #dde3df;
    border-radius: 8px;
    padding: 18px;
  }

  .error {
    color: #b42318;
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";

  type Progress = "not_started" | "in_progress" | "completed" | "expired";

  type CandidateResult = {
    invitationId: string;
    email: string;
    status: string;
    progress: Progress;
    startedAt: string | null;
    completedAt: string | null;
    expiresAt: string;
    questionsAttempted: number;
    totalPassed: number;
    totalFailed: number;
  };

  // NOTE: verify this matches your route folder param name, e.g. if the
  // folder is src/routes/recruiter/assessments/[id]/results/+page.svelte
  // the key is "id".
  let assessmentId = $state("");
  $effect(() => {
    assessmentId = page.params!._assessmentId!;
  });

  let candidates = $state<CandidateResult[]>([]);
  let loading = $state(true);
  let error = $state("");

  const progressLabels: Record<Progress, string> = {
    not_started: "Not Started",
    in_progress: "In Progress",
    completed: "Completed",
    expired: "Expired",
  };

  const progressBadgeClasses: Record<Progress, string> = {
    not_started: "bg-slate-100 text-slate-500 border-slate-200",
    in_progress: "bg-purple-100 text-purple-800 border-purple-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    expired: "bg-red-100 text-red-700 border-red-200",
  };

  function formatDate(value: string | null) {
    if (!value) return "—";
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  async function loadResults() {
    loading = true;
    error = "";
    try {
      candidates = await api.get<CandidateResult[]>(
        `/assessments/${assessmentId}/candidates`,
      );
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to load candidate results";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadResults();
  });

  function viewCandidate(invitationId: string) {
    goto(`/recruiter/assessments/${assessmentId}/candidates/${invitationId}`);
  }

  const summary = $derived({
    total: candidates.length,
    completed: candidates.filter((c) => c.progress === "completed").length,
    inProgress: candidates.filter((c) => c.progress === "in_progress").length,
  });
</script>

<main class="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100/80">
  <div
    class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6"
  >
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Candidate Results</h1>
      {#if !loading && candidates.length > 0}
        <p class="text-slate-500 text-sm">
          {summary.total} invited · {summary.completed} completed · {summary.inProgress}
          in progress
        </p>
      {/if}
    </div>
    <Button variant="outline" onclick={loadResults} disabled={loading}>
      {loading ? "Refreshing…" : "Refresh"}
    </Button>
  </div>

  {#if error}
    <div
      class="bg-red-50 text-red-600 rounded-lg px-4 py-3 mb-6 border border-red-200 flex items-center gap-3"
    >
      <span>⚠️</span>
      <span>{error}</span>
      <button
        class="ml-auto text-red-400 hover:text-red-600"
        onclick={() => (error = "")}
      >
        ✕
      </button>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center h-64">
      <div class="flex flex-col items-center gap-4">
        <div
          class="w-12 h-12 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin"
        ></div>
        <p class="text-slate-500 font-medium">Loading candidate results…</p>
      </div>
    </div>
  {:else if candidates.length === 0}
    <div
      class="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-slate-300 p-12"
    >
      <div class="text-6xl mb-4">📭</div>
      <h2 class="text-2xl font-semibold text-slate-900 mb-2">No results yet</h2>
      <p class="text-slate-500">
        No candidates have been invited to this assessment yet.
      </p>
    </div>
  {:else}
    <Card.Root class="overflow-hidden">
      <Card.Content class="p-0">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50/50">
                <th
                  class="px-4 py-3 text-left text-sm font-semibold text-slate-700"
                  >Candidate</th
                >
                <th
                  class="px-4 py-3 text-left text-sm font-semibold text-slate-700"
                  >Progress</th
                >
                <th
                  class="px-4 py-3 text-left text-sm font-semibold text-slate-700"
                  >Questions</th
                >
                <th
                  class="px-4 py-3 text-left text-sm font-semibold text-slate-700"
                  >TestCase Passed</th
                >
                <th
                  class="px-4 py-3 text-left text-sm font-semibold text-slate-700"
                  >TestCase Failed</th
                >
                <th
                  class="px-4 py-3 text-left text-sm font-semibold text-slate-700"
                  >Started</th
                >
                <th
                  class="px-4 py-3 text-left text-sm font-semibold text-slate-700"
                  >Completed</th
                >
              </tr>
            </thead>
            <tbody>
              {#each candidates as candidate (candidate.invitationId)}
                <tr
                  class="border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  onclick={() => viewCandidate(candidate.invitationId)}
                >
                  <td class="px-4 py-3 font-medium text-slate-900">
                    {candidate.email}
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border {progressBadgeClasses[
                        candidate.progress
                      ]}"
                    >
                      {progressLabels[candidate.progress]}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm text-slate-700">
                    {candidate.questionsAttempted}
                  </td>
                  <td class="px-4 py-3 text-sm font-semibold text-emerald-600">
                    {candidate.totalPassed}
                  </td>
                  <td class="px-4 py-3 text-sm font-semibold text-red-600">
                    {candidate.totalFailed}
                  </td>
                  <td class="px-4 py-3 text-sm text-slate-500">
                    {formatDate(candidate.startedAt)}
                  </td>
                  <td class="px-4 py-3 text-sm text-slate-500">
                    {formatDate(candidate.completedAt)}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </Card.Content>
    </Card.Root>
  {/if}
</main>

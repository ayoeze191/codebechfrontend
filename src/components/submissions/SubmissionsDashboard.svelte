<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { api } from "$lib/api";
  import SubmissionStats from "./SubmissionStats.svelte";
  import SubmissionFilters from "./SubmissionFilters.svelte";
  import SubmissionTable from "./SubmissionTable.svelte";
  import SubmissionEmptyState from "./SubmissionEmptyState.svelte";
  import SubmissionDetailModal from "./SubmissionDetailModal.svelte";
  import type { Submission, SubmissionStats as Stats } from "./types";

  const assessmentId = $derived(page.params._assessmentId!);

  let submissions = $state<Submission[]>([]);
  // Deep links from the candidate list arrive as ?candidate=<email>.
  let searchQuery = $state(page.url.searchParams.get("candidate") ?? "");
  let statusFilter = $state("all");
  let isFinalFilter = $state("all");
  let sortBy = $state("newest");
  let currentPage = $state(1);
  let itemsPerPage = $state(10);
  let loading = $state(true);
  let error = $state("");
  let selectedSubmission = $state<Submission | null>(null);
  let modalOpen = $state(false);

  const filtered = $derived(
    submissions
      .filter((item) => {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          !query ||
          item.id.includes(query) ||
          item.candidate?.email.toLowerCase().includes(query) ||
          item.question?.title.toLowerCase().includes(query);
        const matchesStatus =
          statusFilter === "all" || item.status === statusFilter;
        const matchesFinal =
          isFinalFilter === "all" ||
          (isFinalFilter === "final" ? item.isFinal : !item.isFinal);
        return matchesSearch && matchesStatus && matchesFinal;
      })
      .sort((a, b) => {
        if (sortBy === "oldest")
          return +new Date(a.createdAt) - +new Date(b.createdAt);
        if (sortBy === "score") return (b.passed ?? 0) - (a.passed ?? 0);
        if (sortBy === "name")
          return (a.candidate?.email ?? "").localeCompare(
            b.candidate?.email ?? "",
          );
        return +new Date(b.createdAt) - +new Date(a.createdAt);
      }),
  );

  const stats = $derived<Stats>({
    total: submissions.length,
    completed: submissions.filter((s) => s.status === "COMPLETED").length,
    failed: submissions.filter((s) => s.status === "FAILED").length,
    pending: submissions.filter(
      (s) => s.status === "PENDING" || s.status === "RUNNING",
    ).length,
    averageScore: submissions.length
      ? submissions.reduce((total, s) => total + (s.passed ?? 0), 0) /
        submissions.length
      : 0,
    passRate: (() => {
      const passed = submissions.reduce((n, s) => n + (s.passed ?? 0), 0);
      const total = submissions.reduce(
        (n, s) => n + (s.passed ?? 0) + (s.failed ?? 0),
        0,
      );
      return total ? (passed / total) * 100 : 0;
    })(),
  });

  async function load() {
    loading = true;
    error = "";
    try {
      submissions = (
        await api.get<{ data: Submission[] }>(
          `/submissions/assessment/${assessmentId}`,
        )
      ).data;
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not load submissions";
    } finally {
      loading = false;
    }
  }

  function view(submission: Submission) {
    selectedSubmission = submission;
    modalOpen = true;
  }

  onMount(load);
</script>

<svelte:head><title>Results · CodeBench</title></svelte:head>

<div>
  <div class="flex justify-between gap-4 mb-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Submission results</h1>
      <p class="text-sm text-slate-500">
        {submissions.length}
        {submissions.length === 1 ? "submission" : "submissions"}
      </p>
    </div>
    <button class="border rounded px-3 py-2 text-sm" onclick={load}>Refresh</button>
  </div>

  {#if error}
    <p class="text-red-600 mb-4" role="alert">{error}</p>
  {/if}

  {#if !loading && submissions.length}
    <SubmissionStats {stats} />
  {/if}

  <SubmissionFilters bind:searchQuery bind:statusFilter bind:isFinalFilter bind:sortBy />

  {#if loading}
    <p class="text-slate-500">Loading submissions…</p>
  {:else if !submissions.length}
    <SubmissionEmptyState
      title="No submissions yet"
      message="Candidates have not submitted any solutions."
    />
  {:else if !filtered.length}
    <SubmissionEmptyState icon="🔍" title="No matches" message="Try changing your filters." />
  {:else}
    <SubmissionTable
      submissions={filtered}
      bind:currentPage
      bind:itemsPerPage
      onView={view}
    />
  {/if}
</div>

<SubmissionDetailModal
  submission={selectedSubmission}
  bind:open={modalOpen}
  onClose={() => (modalOpen = false)}
/>

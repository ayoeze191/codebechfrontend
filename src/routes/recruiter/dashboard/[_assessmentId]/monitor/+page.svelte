<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";
  import { socketStore } from "$stores/socketStore";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";

  // TODO: adjust this import to however your app exposes the current
  // recruiter's JWT client-side (the socket handshake needs it — this is
  // separate from whatever your `api` HTTP client uses internally).
  //   import { getAuthToken } from "$lib/auth";

  type Progress = "not_started" | "in_progress" | "completed" | "expired";

  type CandidateRow = {
    invitationId: string;
    email: string;
    status: string;
    progress: Progress;
    questionsAttempted: number;
    questionsSolved: number;
    flaggedEvents: number;
  };

  type SuspiciousEvent = {
    invitationId: string;
    eventType: string;
    metadata: Record<string, unknown>;
    timestamp: string;
  };

  // NOTE: verify this matches your route folder param name.
  let assessmentId = $state("");
  $effect(() => {
    assessmentId = page.params!.id!;
  });

  let candidates = $state<CandidateRow[]>([]);
  let loading = $state(true);
  let error = $state("");
  let isLive = $state(false);

  // Live-only state layered on top of the REST snapshot above.
  let onlineInvitationIds = $state(new Set<string>());
  let liveFlagBumps = $state(new Map<string, number>()); // invitationId -> extra flags seen since page load
  let activityFeed = $state<SuspiciousEvent[]>([]);
  let typingInvitationIds = $state(new Set<string>());

  let selectedInvitationId = $state<string | null>(null);
  let liveCodeByInvitation = $state(new Map<string, string>());

  const EVENT_LABELS: Record<string, string> = {
    TAB_SWITCH: "switched away from the tab",
    TAB_RETURN: "returned to the tab",
    WINDOW_BLUR: "lost window focus",
    WINDOW_FOCUS: "regained window focus",
    COPY: "copied text",
    PASTE: "pasted text",
    FULLSCREEN_EXIT: "exited fullscreen",
  };

  function totalFlags(candidate: CandidateRow) {
    return (
      candidate.flaggedEvents + (liveFlagBumps.get(candidate.invitationId) ?? 0)
    );
  }

  function formatTime(value: string | Date) {
    return new Date(value).toLocaleTimeString();
  }

  async function loadCandidates() {
    loading = true;
    error = "";
    try {
      candidates = await api.get<CandidateRow[]>(
        `/assessments/${assessmentId}/candidates`,
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load candidates";
    } finally {
      loading = false;
    }
  }

  // Handlers kept as named functions so they can be cleanly removed in
  // onDestroy.
  function handleCandidateConnected(data: {
    invitationId: string;
    email: string;
  }) {
    onlineInvitationIds = new Set(onlineInvitationIds).add(data.invitationId);
  }

  function handleCandidateDisconnected(data: { invitationId: string }) {
    const next = new Set(onlineInvitationIds);
    next.delete(data.invitationId);
    onlineInvitationIds = next;
  }

  function handleSuspicious(data: SuspiciousEvent) {
    activityFeed = [data, ...activityFeed].slice(0, 50);

    const next = new Map(liveFlagBumps);
    next.set(data.invitationId, (next.get(data.invitationId) ?? 0) + 1);
    liveFlagBumps = next;
  }

  function handleTyping(data: { invitationId: string }) {
    typingInvitationIds = new Set(typingInvitationIds).add(data.invitationId);
    // Clear the indicator if nothing else comes in for a couple seconds.
    setTimeout(() => {
      const next = new Set(typingInvitationIds);
      next.delete(data.invitationId);
      typingInvitationIds = next;
    }, 2000);
  }

  function handleCodeChange(data: {
    invitationId: string;
    questionId: string;
    code: string;
  }) {
    const next = new Map(liveCodeByInvitation);
    next.set(data.invitationId, data.code);
    liveCodeByInvitation = next;
  }

  function handleSubmitted(data: { invitationId: string }) {
    // Nudge the REST snapshot to refresh so questionsAttempted/Solved
    // catch up — cheap since it's a single fetch, not on every keystroke.
    loadCandidates();
  }

  function selectCandidate(invitationId: string) {
    selectedInvitationId =
      selectedInvitationId === invitationId ? null : invitationId;
  }

  onMount(async () => {
    await loadCandidates();

    try {
      await socketStore.connect();
      socketStore.emit("recruiter:join", { assessmentId });
      isLive = true;
    } catch (err) {
      console.error("Live monitor socket connection failed:", err);
      isLive = false;
    }

    socketStore.on("candidate:connected", handleCandidateConnected);
    socketStore.on("candidate:disconnected", handleCandidateDisconnected);
    socketStore.on("candidate:suspicious", handleSuspicious);
    socketStore.on("candidate:typing", handleTyping);
    socketStore.on("candidate:codeChange", handleCodeChange);
    socketStore.on("candidate:submitted", handleSubmitted);
  });

  onDestroy(() => {
    socketStore.off("candidate:connected", handleCandidateConnected);
    socketStore.off("candidate:disconnected", handleCandidateDisconnected);
    socketStore.off("candidate:suspicious", handleSuspicious);
    socketStore.off("candidate:typing", handleTyping);
    socketStore.off("candidate:codeChange", handleCodeChange);
    socketStore.off("candidate:submitted", handleSubmitted);
  });

  function emailFor(invitationId: string) {
    return (
      candidates.find((c) => c.invitationId === invitationId)?.email ??
      invitationId
    );
  }

  function goBack() {
    goto(`/recruiter/assessments/${assessmentId}/results`);
  }
</script>

<main class="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100/80">
  <div class="flex items-center justify-between mb-6">
    <button
      class="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1"
      onclick={goBack}
    >
      ← Back to results
    </button>
    <div
      class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold {isLive
        ? 'bg-green-100 text-green-700 border border-green-200'
        : 'bg-slate-100 text-slate-500 border border-slate-200'}"
    >
      <span
        class="w-2 h-2 rounded-full {isLive
          ? 'bg-green-500 animate-pulse'
          : 'bg-slate-400'}"
      ></span>
      {isLive ? "Live" : "Connecting…"}
    </div>
  </div>

  <h1 class="text-2xl font-bold text-slate-900 mb-6">Live Monitor</h1>

  {#if error}
    <div
      class="bg-red-50 text-red-600 rounded-lg px-4 py-3 mb-6 border border-red-200"
    >
      {error}
    </div>
  {/if}

  <div class="grid lg:grid-cols-3 gap-6">
    <!-- Candidate roster -->
    <Card.Root class="lg:col-span-2 overflow-hidden">
      <Card.Content class="p-0">
        {#if loading}
          <div class="p-12 text-center text-slate-500">Loading candidates…</div>
        {:else if candidates.length === 0}
          <div class="p-12 text-center text-slate-500">
            No candidates invited to this assessment yet.
          </div>
        {:else}
          <table class="w-full">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50/50">
                <th
                  class="px-4 py-3 text-left text-sm font-semibold text-slate-700"
                >
                  Candidate
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-semibold text-slate-700"
                >
                  Online
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-semibold text-slate-700"
                >
                  Solved
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-semibold text-slate-700"
                >
                  Flags
                </th>
              </tr>
            </thead>
            <tbody>
              {#each candidates as candidate (candidate.invitationId)}
                <tr
                  class="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer {selectedInvitationId ===
                  candidate.invitationId
                    ? 'bg-emerald-50/50'
                    : ''}"
                  onclick={() => selectCandidate(candidate.invitationId)}
                >
                  <td class="px-4 py-3">
                    <div class="font-medium text-slate-900">
                      {candidate.email}
                    </div>
                    {#if typingInvitationIds.has(candidate.invitationId)}
                      <div class="text-xs text-emerald-600">typing…</div>
                    {/if}
                  </td>
                  <td class="px-4 py-3">
                    {#if onlineInvitationIds.has(candidate.invitationId)}
                      <span
                        class="inline-flex items-center gap-1.5 text-xs font-medium text-green-700"
                      >
                        <span class="w-2 h-2 rounded-full bg-green-500"></span>
                        Online
                      </span>
                    {:else}
                      <span
                        class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400"
                      >
                        <span class="w-2 h-2 rounded-full bg-slate-300"></span>
                        Offline
                      </span>
                    {/if}
                  </td>
                  <td class="px-4 py-3 text-sm font-medium text-slate-900">
                    {candidate.questionsSolved}/{candidate.questionsAttempted}
                  </td>
                  <td class="px-4 py-3">
                    {#if totalFlags(candidate) > 0}
                      <span
                        class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200"
                      >
                        🚩 {totalFlags(candidate)}
                      </span>
                    {:else}
                      <span class="text-slate-400 text-xs">—</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </Card.Content>
    </Card.Root>

    <!-- Live activity feed -->
    <Card.Root>
      <Card.Content class="p-0">
        <div
          class="px-5 py-3 border-b border-slate-100 font-semibold text-slate-900"
        >
          Live Activity
        </div>
        {#if activityFeed.length === 0}
          <div class="p-6 text-center text-sm text-slate-400">
            No flagged activity yet this session.
          </div>
        {:else}
          <ul class="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
            {#each activityFeed as event, i (i)}
              <li class="px-5 py-3 bg-red-50/40">
                <p class="text-sm text-red-700">
                  <span class="font-medium">{emailFor(event.invitationId)}</span
                  >
                  {EVENT_LABELS[event.eventType] ?? event.eventType}
                </p>
                <p class="text-xs text-slate-400 mt-0.5">
                  {formatTime(event.timestamp)}
                </p>
              </li>
            {/each}
          </ul>
        {/if}
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Live code peek for the selected candidate -->
  {#if selectedInvitationId}
    <Card.Root class="mt-6">
      <Card.Content class="p-0">
        <div
          class="px-5 py-3 border-b border-slate-100 font-semibold text-slate-900 flex items-center justify-between"
        >
          <span>Live code — {emailFor(selectedInvitationId)}</span>
          <button
            class="text-slate-400 hover:text-slate-700 text-sm"
            onclick={() => (selectedInvitationId = null)}
          >
            ✕
          </button>
        </div>
        <pre
          class="p-5 text-sm font-mono bg-slate-900 text-slate-100 overflow-x-auto min-h-[200px]">{liveCodeByInvitation.get(
            selectedInvitationId,
          ) ??
            "No live code received yet — waiting for the candidate to type."}</pre>
      </Card.Content>
    </Card.Root>
  {/if}
</main>

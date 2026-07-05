<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/state";
  import { socketStore } from "$stores/socketStore";
  import { api } from "$lib/api";

  interface Candidate {
    id: string;
    name: string;
    email: string;
    connected: boolean;
    typing: boolean;
    suspicious: boolean;
    currentCode?: string;
  }

  interface CandidateEvent {
    candidateId: string;
    eventType: string;
    timestamp: string;
    alert?: boolean;
  }

  interface CandidateTypingEvent {
    candidateId: string;
    questionId: string;
  }

  interface CandidateCodeChangeEvent {
    candidateId: string;
    questionId: string;
    code: string;
    timestamp: string;
  }

  interface CandidateConnectionEvent {
    candidateId: string;
    assessmentId: string;
  }

  let assessmentId = $state(page.params._assessmentId);

  let candidates = $state<Candidate[]>([]);
  let selectedCandidate = $state<Candidate | null>(null);
  let candidateEvents = $state<CandidateEvent[]>([]);
  let liveCandidates = $state(new Set<string>());

  function updateCandidate(candidateId: string, updates: Partial<Candidate>) {
    candidates = candidates.map((candidate) =>
      candidate.id === candidateId ? { ...candidate, ...updates } : candidate,
    );

    if (selectedCandidate?.id === candidateId) {
      selectedCandidate = {
        ...selectedCandidate,
        ...updates,
      };
    }
  }

  async function selectCandidate(candidateId: string) {
    selectedCandidate = candidates.find((c) => c.id === candidateId) ?? null;

    if (!selectedCandidate) return;

    const response = await api.get<CandidateEvent[]>(
      `/candidates/${candidateId}/events`,
    );

    candidateEvents = response;
  }

  onMount(async () => {
    await socketStore.connect();

    socketStore.emit("recruiter:join", {
      assessmentId,
    });

    const response = await api.get<Candidate[]>(
      `/assessments/${assessmentId}/candidates`,
    );

    candidates = response.map((candidate: Candidate) => ({
      ...candidate,
      connected: false,
      typing: false,
      suspicious: false,
    }));

    socketStore.on("candidate:connected", (data: CandidateConnectionEvent) => {
      liveCandidates = new Set(liveCandidates).add(data.candidateId);

      updateCandidate(data.candidateId, {
        connected: true,
      });
    });

    socketStore.on(
      "candidate:disconnected",
      (data: { candidateId: string }) => {
        liveCandidates.delete(data.candidateId);
        liveCandidates = new Set(liveCandidates);

        updateCandidate(data.candidateId, {
          connected: false,
          typing: false,
        });
      },
    );

    socketStore.on("candidate:typing", (data: CandidateTypingEvent) => {
      updateCandidate(data.candidateId, {
        typing: true,
      });

      setTimeout(() => {
        updateCandidate(data.candidateId, {
          typing: false,
        });
      }, 2000);
    });

    socketStore.on("candidate:suspicious", (data: CandidateEvent) => {
      candidateEvents = [
        {
          ...data,
          alert: true,
        },
        ...candidateEvents,
      ];

      updateCandidate(data.candidateId, {
        suspicious: true,
      });
    });

    socketStore.on("candidate:codeChange", (data: CandidateCodeChangeEvent) => {
      updateCandidate(data.candidateId, {
        currentCode: data.code,
      });
    });
  });

  onDestroy(() => {
    socketStore.off?.("candidate:connected");
    socketStore.off?.("candidate:disconnected");
    socketStore.off?.("candidate:typing");
    socketStore.off?.("candidate:suspicious");
    socketStore.off?.("candidate:codeChange");

    socketStore.disconnect();
  });
</script>

<div class="monitor-container">
  <header class="monitor-header">
    <h1>Live Monitoring</h1>
    <div class="stats">
      <span>Active: {liveCandidates.size}</span>
      <span>Total: {candidates.length}</span>
    </div>
  </header>

  <div class="monitor-body">
    <aside class="candidate-list">
      {#each candidates as candidate}
        <button
          type="button"
          class="candidate-item"
          class:active={selectedCandidate?.id === candidate.id}
          onclick={() => selectCandidate(candidate.id)}
        >
          <span class="candidate-name">{candidate.name ?? candidate.email}</span
          >
          <span class="status" class:connected={candidate.connected}>
            {candidate.connected ? "●" : "○"}
          </span>
          {#if candidate.typing}
            <span class="typing-indicator">✏️</span>
          {/if}
          {#if candidate.suspicious}
            <span class="warning">⚠️</span>
          {/if}
        </button>
      {/each}
    </aside>

    <main class="monitor-content">
      {#if selectedCandidate}
        <div class="candidate-details">
          <h2>Candidate: {selectedCandidate.name}</h2>

          <div class="events-log">
            <h3>Activity Log</h3>
            <div class="events-scroll">
              {#each candidateEvents as event}
                <div class="event-item" class:suspicious={event.alert}>
                  <span class="event-time">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <span class="event-type">{event.eventType}</span>
                  {#if event.alert}
                    <span class="event-alert">⚠️ Suspicious</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>

          <div class="code-view">
            <h3>Current Code</h3>
            <pre class="code-snapshot">
              {selectedCandidate.currentCode ?? "No code submitted yet"}
            </pre>
          </div>
        </div>
      {:else}
        <div class="no-selection">
          <p>Select a candidate to monitor</p>
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
  .monitor-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #f5f5f5;
  }

  .monitor-header {
    padding: 16px 24px;
    background: white;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stats {
    display: flex;
    gap: 16px;
  }
</style>

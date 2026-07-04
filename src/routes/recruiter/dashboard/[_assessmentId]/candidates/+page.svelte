<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Textarea } from "$lib/components/ui/textarea";
  import * as Card from "$lib/components/ui/card";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { page } from "$app/state";
  import { Avatar, AvatarFallback } from "$lib/components/ui/avatar";
  import { goto } from "$app/navigation";

  // Maps directly to what GET /assessments/:id/candidates returns.
  // "id" here is the invitation id — candidates have no identity apart from their invitation.
  type Candidate = {
    invitationId: string;
    email: string;
    status: "PENDING" | "STARTED" | "COMPLETED" | "REVOKED";
    progress: "not_started" | "in_progress" | "completed" | "expired";
    startedAt: string | null;
    completedAt: string | null;
    expiresAt: string;
    questionsAttempted: number;
    totalPassed: number;
    totalFailed: number;
  };

  let assessmentId = $state("");
  $effect(() => {
    assessmentId = page.params!._assessmentId!; // confirm this matches your route folder param name
  });

  let candidates = $state<Candidate[]>([]);
  let isLoading = $state(true);
  let error = $state("");
  let searchQuery = $state("");
  let selectedCandidates = $state<string[]>([]);
  let showInviteModal = $state(false);
  let inviteEmails = $state("");
  let isInviting = $state(false);
  let revokeTargetId = $state<string | null>(null);
  let isRevoking = $state(false);

  let filteredCandidates = $derived(
    candidates.filter((candidate) =>
      candidate.email.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  );

  onMount(async () => {
    await loadCandidates();
  });

  async function loadCandidates() {
    isLoading = true;
    error = "";
    try {
      candidates = await api.get<Candidate[]>(
        `/assessments/${assessmentId}/candidates`,
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load candidates";
    } finally {
      isLoading = false;
    }
  }

  function getStatusBadge(status: Candidate["status"]) {
    const variants = {
      PENDING: "bg-blue-100 text-blue-800 border-blue-200",
      STARTED: "bg-purple-100 text-purple-800 border-purple-200",
      COMPLETED: "bg-green-100 text-green-800 border-green-200",
      REVOKED: "bg-slate-100 text-slate-500 border-slate-200",
    };
    const labels = {
      PENDING: "Invited",
      STARTED: "In Progress",
      COMPLETED: "Completed",
      REVOKED: "Revoked",
    };
    return { variant: variants[status], label: labels[status] };
  }

  function getScore(candidate: Candidate): string {
    const total = candidate.totalPassed + candidate.totalFailed;
    if (total === 0) return "—";
    return `${Math.round((candidate.totalPassed / total) * 100)}%`;
  }

  function getInitials(email: string) {
    return email.slice(0, 2).toUpperCase();
  }

  function toggleSelectAll() {
    if (selectedCandidates.length === filteredCandidates.length) {
      selectedCandidates = [];
    } else {
      selectedCandidates = filteredCandidates.map((c) => c.invitationId);
    }
  }

  function toggleSelect(invitationId: string) {
    if (selectedCandidates.includes(invitationId)) {
      selectedCandidates = selectedCandidates.filter(
        (id) => id !== invitationId,
      );
    } else {
      selectedCandidates = [...selectedCandidates, invitationId];
    }
  }

  async function sendInvitations() {
    if (!inviteEmails.trim()) return;
    isInviting = true;
    error = "";
    try {
      const emailList = inviteEmails
        .split(/[\n,;]+/)
        .map((email) => email.trim())
        .filter((email) => email && email.includes("@"));

      await api.post(`/assessments/${assessmentId}/invitations`, {
        emails: emailList,
      });
      await loadCandidates();
      showInviteModal = false;
      inviteEmails = "";
      selectedCandidates = [];
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to send invitations";
    } finally {
      isInviting = false;
    }
  }

  async function resendInvite(invitationId: string) {
    error = "";
    try {
      await api.post(`/assessments/invitations/${invitationId}/resend`, {});
      await loadCandidates();
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to resend invitation";
    }
  }

  async function confirmRevoke() {
    if (!revokeTargetId) return;
    isRevoking = true;
    error = "";
    try {
      await api.delete(`/invitations/${revokeTargetId}`);
      await loadCandidates();
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to revoke invitation";
    } finally {
      isRevoking = false;
      revokeTargetId = null;
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

  <div
    class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6"
  >
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Candidates</h1>
      <p class="text-slate-500 text-sm">{candidates.length} total candidates</p>
    </div>
    <div class="flex items-center gap-3 w-full sm:w-auto">
      <div class="relative flex-1 sm:flex-initial">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          >🔍</span
        >
        <Input
          type="text"
          placeholder="Search candidates..."
          bind:value={searchQuery}
          class="pl-9 w-full sm:w-64"
        />
      </div>
      <Button onclick={() => (showInviteModal = true)}>
        <span class="mr-2">+</span> Invite
      </Button>
    </div>
  </div>

  {#if isLoading}
    <div class="flex items-center justify-center h-64">
      <div class="flex flex-col items-center gap-4">
        <div
          class="w-12 h-12 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin"
        ></div>
        <p class="text-slate-500 font-medium">Loading candidates...</p>
      </div>
    </div>
  {:else if filteredCandidates.length === 0}
    <div
      class="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-slate-300 p-12"
    >
      <div class="text-6xl mb-4">👥</div>
      <h2 class="text-2xl font-semibold text-slate-900 mb-2">
        No candidates found
      </h2>
      <p class="text-slate-500 mb-6">
        {searchQuery
          ? "Try adjusting your search"
          : "Start by inviting candidates"}
      </p>
      {#if !searchQuery}
        <Button onclick={() => (showInviteModal = true)}
          >Invite Candidates</Button
        >
      {/if}
    </div>
  {:else}
    <Card.Root class="overflow-hidden">
      <Card.Content class="p-0">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50/50">
                <th class="px-4 py-3 text-left">
                  <Checkbox
                    checked={selectedCandidates.length ===
                      filteredCandidates.length &&
                      filteredCandidates.length > 0}
                    onCheckedChange={toggleSelectAll}
                    class="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-semibold text-slate-700"
                  >Candidate</th
                >
                <th
                  class="px-4 py-3 text-left text-sm font-semibold text-slate-700"
                  >Email</th
                >
                <th
                  class="px-4 py-3 text-left text-sm font-semibold text-slate-700"
                  >Status</th
                >
                <th
                  class="px-4 py-3 text-left text-sm font-semibold text-slate-700"
                  >Score</th
                >
                <th
                  class="px-4 py-3 text-right text-sm font-semibold text-slate-700"
                  >Actions</th
                >
              </tr>
            </thead>
            <tbody>
              {#each filteredCandidates as candidate (candidate.invitationId)}
                <tr
                  class="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <td class="px-4 py-3">
                    <Checkbox
                      checked={selectedCandidates.includes(
                        candidate.invitationId,
                      )}
                      onCheckedChange={() =>
                        toggleSelect(candidate.invitationId)}
                      class="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    />
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <Avatar class="h-8 w-8">
                        <AvatarFallback
                          class="bg-emerald-100 text-emerald-700 text-xs font-medium"
                        >
                          {getInitials(candidate.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span class="font-medium text-slate-900"
                        >{candidate.email}</span
                      >
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    {#key candidate.invitationId}
                      {@const status = getStatusBadge(candidate.status)}
                      <span
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border {status.variant}"
                      >
                        {status.label}
                      </span>
                    {/key}
                  </td>
                  <td class="px-4 py-3 text-sm font-medium text-slate-700">
                    {getScore(candidate)}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-2">
                      {#if candidate.status === "PENDING"}
                        <Button
                          size="sm"
                          variant="outline"
                          onclick={() => resendInvite(candidate.invitationId)}
                          class="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <span class="mr-1">🔄</span> Resend
                        </Button>
                      {/if}
                      {#if candidate.status === "COMPLETED"}
                        <Button
                          size="sm"
                          variant="outline"
                          onclick={() =>
                            goto(
                              `/recruiter/candidates/${candidate.invitationId}/results`,
                            )}
                        >
                          <span class="mr-1">📊</span> View
                        </Button>
                      {/if}
                      {#if candidate.status !== "COMPLETED" && candidate.status !== "REVOKED"}
                        <Button
                          size="sm"
                          variant="outline"
                          onclick={() =>
                            (revokeTargetId = candidate.invitationId)}
                          class="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          <span class="mr-1">🚫</span> Revoke
                        </Button>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </Card.Content>
    </Card.Root>

    {#if selectedCandidates.length > 0}
      <div
        class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-slate-200 px-6 py-4 flex items-center gap-4 z-50"
      >
        <span class="text-sm text-slate-600">
          <span class="font-semibold text-slate-900"
            >{selectedCandidates.length}</span
          > candidates selected
        </span>
        <div class="w-px h-6 bg-slate-200"></div>
        <Button
          size="sm"
          onclick={() => {
            const selected = candidates.filter((c) =>
              selectedCandidates.includes(c.id),
            );
            inviteEmails = selected.map((c) => c.email).join("\n");
            showInviteModal = true;
          }}
        >
          <span class="mr-2">📨</span> Invite Selected
        </Button>
        <Button
          size="sm"
          variant="outline"
          onclick={() => (selectedCandidates = [])}
        >
          Clear
        </Button>
      </div>
    {/if}
  {/if}

  <!-- Invite Modal -->
  <Dialog.Root bind:open={showInviteModal}>
    <Dialog.Content class="sm:max-w-lg">
      <Dialog.Header>
        <Dialog.Title>Invite Candidates</Dialog.Title>
        <Dialog.Description>
          Send assessment invitations to candidates. Enter one email per line.
        </Dialog.Description>
      </Dialog.Header>

      <form
        onsubmit={(e) => {
          e.preventDefault();
          sendInvitations();
        }}
      >
        <div class="space-y-4 py-4">
          <div class="grid gap-2">
            <Label for="invite-emails">Email Addresses</Label>
            <Textarea
              id="invite-emails"
              rows={6}
              bind:value={inviteEmails}
              placeholder="john@example.com&#10;jane@example.com&#10;alex@example.com"
              class="font-mono text-sm"
            />
            <p class="text-xs text-slate-500">
              Enter one email per line, or separate with commas or semicolons.
            </p>
          </div>

          {#if error}
            <div
              class="bg-red-50 text-red-600 rounded-md px-3 py-2 text-sm border border-red-200"
            >
              {error}
            </div>
          {/if}
        </div>

        <Dialog.Footer>
          <Dialog.Close asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </Dialog.Close>
          <Button type="submit" disabled={isInviting || !inviteEmails.trim()}>
            {isInviting ? "Sending..." : "Send Invitations"}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog.Content>
  </Dialog.Root>

  <AlertDialog.Root
    open={revokeTargetId !== null}
    onOpenChange={(open) => !open && (revokeTargetId = null)}
  >
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>Revoke this invitation?</AlertDialog.Title>
        <AlertDialog.Description>
          The candidate's link will stop working immediately. This can't be
          undone — they'll need a brand new invitation to try again.
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
        <AlertDialog.Action onclick={confirmRevoke} disabled={isRevoking}>
          {isRevoking ? "Revoking..." : "Revoke"}
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
</main>

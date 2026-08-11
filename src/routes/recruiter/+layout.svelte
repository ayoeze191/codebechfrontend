<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { auth } from "$lib/auth";

  let { children } = $props();

  // Assessment-scoped pages live under /recruiter/dashboard/[id]/..., so the
  // sub-navigation only makes sense once an id is in the URL.
  const assessmentId = $derived(page.params?._assessmentId ?? null);

  const tabs = $derived(
    assessmentId
      ? [
          { href: `/recruiter/dashboard/${assessmentId}/candidates`, label: "Candidates" },
          { href: `/recruiter/dashboard/${assessmentId}/monitor`, label: "Live Monitor" },
          { href: `/recruiter/dashboard/${assessmentId}/results`, label: "Results" },
        ]
      : [],
  );

  onMount(() => {
    auth.init();
    // The API rejects unauthenticated calls anyway; this just avoids showing an
    // empty dashboard to someone who is simply signed out.
    if (!localStorage.getItem("codebench_token")) goto("/");
  });

  function handleLogout() {
    auth.logout();
    goto("/");
  }
</script>

<div class="min-h-screen bg-slate-50">
  <header class="bg-white border-b border-slate-200">
    <div class="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
      <a href="/recruiter/dashboard" class="flex items-center gap-3">
        <span
          class="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-900/10"
        >
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="28" height="28" rx="8" stroke="#255f4b" stroke-width="2.5" />
            <path
              d="M10 16L14 20L22 12"
              stroke="#255f4b"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span>
          <span class="block text-lg font-bold tracking-tight text-slate-900">CodeBench</span>
          <span class="block text-xs font-medium text-slate-500">Recruiter workspace</span>
        </span>
      </a>

      <div class="flex items-center gap-3">
        {#if $auth.user}
          <span class="text-sm text-slate-500 hidden sm:inline">
            {$auth.user.name || $auth.user.email}
          </span>
        {/if}
        <button
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm border border-slate-200 bg-slate-50 text-slate-900 transition-colors hover:bg-slate-100"
          onclick={handleLogout}
        >
          Sign out
        </button>
      </div>
    </div>

    {#if tabs.length}
      <nav class="max-w-7xl mx-auto px-6 flex gap-1 -mb-px">
        <a
          href="/recruiter/dashboard"
          class="px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← All assessments
        </a>
        {#each tabs as tab (tab.href)}
          <a
            href={tab.href}
            class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors {page.url
              .pathname === tab.href
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'}"
          >
            {tab.label}
          </a>
        {/each}
      </nav>
    {/if}
  </header>

  <main class="max-w-7xl mx-auto px-6 py-6">
    {@render children()}
  </main>
</div>

<script lang="ts">
  import type { Submission, TestCaseResult } from "./types";

  let {
    submission,
    open = $bindable(false),
    onClose,
  }: {
    submission: Submission | null;
    open?: boolean;
    onClose: () => void;
  } = $props();

  const total = $derived(
    (submission?.passed ?? 0) + (submission?.failed ?? 0),
  );
  const score = $derived(`${submission?.passed ?? 0}/${total}`);

  // A whole-run failure (compile error, missing entry point) is stored as
  // { error } instead of an array of per-test verdicts.
  const runError = $derived(
    submission?.results && !Array.isArray(submission.results)
      ? (submission.results as { error?: string }).error
      : undefined,
  );

  const testResults = $derived<TestCaseResult[]>(
    Array.isArray(submission?.results) ? submission.results : [],
  );

  const preview = (value: unknown) =>
    value === undefined ? "—" : JSON.stringify(value);
</script>

<svelte:window
  onkeydown={(event) => {
    if (open && event.key === "Escape") onClose();
  }}
/>

{#if open && submission}
  <div
    class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
    role="presentation"
    onclick={onClose}
  >
    <!-- Clicks inside the panel must not reach the backdrop's close handler. -->
    <div
      class="bg-white rounded-lg border shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Submission details"
      tabindex="-1"
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => event.key === "Escape" && onClose()}
    >
      <div class="flex justify-between gap-4">
        <div>
          <h2 class="font-bold text-lg">
            {submission.question?.title ?? "Submission"}
          </h2>
          <p class="text-sm text-slate-500">
            {submission.candidate?.email ?? "Candidate"} · {submission.language} ·
            {submission.status} · {score} passed
            {#if submission.isFinal}
              · <span class="text-emerald-700 font-medium">final answer</span>
            {/if}
          </p>
        </div>
        <button class="text-slate-400 hover:text-slate-900" onclick={onClose}>✕</button>
      </div>

      {#if runError}
        <div class="mt-4 rounded border border-red-200 bg-red-50 p-3">
          <p class="text-sm font-semibold text-red-700">Execution failed</p>
          <pre class="mt-1 text-xs text-red-700 whitespace-pre-wrap">{runError}</pre>
        </div>
      {/if}

      {#if testResults.length}
        <h3 class="mt-5 mb-2 text-sm font-semibold">Test cases</h3>
        <ul class="space-y-2">
          {#each testResults as result, index (index)}
            <li
              class="rounded border p-3 text-xs {result.passed
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-red-200 bg-red-50'}"
            >
              <div class="flex justify-between font-medium">
                <span>{result.passed ? "✓" : "✗"} Test {index + 1}</span>
                {#if result.executionTime !== undefined}
                  <span class="text-slate-500">{result.executionTime}ms</span>
                {/if}
              </div>
              {#if result.error}
                <p class="mt-1 text-red-700">{result.error}</p>
              {:else if !result.passed}
                <p class="mt-1 text-slate-600">
                  expected <code>{preview(result.expected)}</code>, got
                  <code>{preview(result.output)}</code>
                </p>
              {/if}
              {#if result.stdout}
                <pre class="mt-1 text-slate-500 whitespace-pre-wrap">{result.stdout}</pre>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}

      <h3 class="mt-5 mb-2 text-sm font-semibold">Code</h3>
      <pre class="max-h-96 overflow-auto rounded bg-slate-900 text-slate-100 p-4 text-xs">{submission.code}</pre>
    </div>
  </div>
{/if}

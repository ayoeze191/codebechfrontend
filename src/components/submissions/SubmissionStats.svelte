<script lang="ts">
  import type { SubmissionStats } from "./types";
  let { stats }: { stats: SubmissionStats } = $props();
</script>
<div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
  <div class="rounded-lg border p-3"><p class="text-xs text-muted-foreground">Total</p><p class="text-xl font-bold">{stats.total}</p></div>
  <div class="rounded-lg border p-3"><p class="text-xs text-muted-foreground">Completed</p><p class="text-xl font-bold">{stats.completed}</p></div>
  <div class="rounded-lg border p-3"><p class="text-xs text-muted-foreground">Failed</p><p class="text-xl font-bold">{stats.failed}</p></div>
  <div class="rounded-lg border p-3"><p class="text-xs text-muted-foreground">Pending</p><p class="text-xl font-bold">{stats.pending}</p></div>
  <div class="rounded-lg border p-3"><p class="text-xs text-muted-foreground">Pass rate</p><p class="text-xl font-bold">{stats.passRate.toFixed(0)}%</p></div>
</div>

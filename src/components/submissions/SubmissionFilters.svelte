<script lang="ts">
  let { searchQuery = $bindable(""), statusFilter = $bindable("all"), isFinalFilter = $bindable("all"), sortBy = $bindable("newest") }: { searchQuery?: string; statusFilter?: string; isFinalFilter?: string; sortBy?: string } = $props();
</script>
<div class="flex flex-wrap gap-3 mb-5">
  <input class="border rounded px-3 py-2" placeholder="Search candidate or question" bind:value={searchQuery} />
  <select class="border rounded px-3 py-2" bind:value={statusFilter}><option value="all">All statuses</option><option value="PENDING">Pending</option><option value="RUNNING">Running</option><option value="COMPLETED">Completed</option><option value="FAILED">Failed</option><option value="ERROR">Error</option></select>
  <select class="border rounded px-3 py-2" bind:value={isFinalFilter}><option value="all">All attempts</option><option value="final">Final</option><option value="draft">Draft</option></select>
  <select class="border rounded px-3 py-2" bind:value={sortBy}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="score">Score</option><option value="name">Candidate</option></select>
</div>

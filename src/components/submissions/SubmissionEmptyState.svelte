<script lang="ts">
  let { icon = "📭", title = "No submissions", message = "No submissions found" }: { icon?: string; title?: string; message?: string } = $props();
</script>
<div class="rounded-lg border p-12 text-center"><p class="text-4xl mb-3">{icon}</p><h3 class="font-semibold">{title}</h3><p class="text-muted-foreground text-sm">{message}</p></div>

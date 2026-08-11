<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { socketStore } from "$stores/socketStore";
  import { candidateStore } from "$stores/candidateStore";

  // `value` is a one-way prop with an onChange callback rather than a binding,
  // because the page derives it from a per-question/per-language map.
  let {
    value = "",
    onChange,
    language = "javascript",
    readOnly = false,
    questionId = "",
  }: {
    value?: string;
    onChange: (next: string) => void;
    language?: string;
    readOnly?: boolean;
    questionId?: string;
  } = $props();

  let editorContainer: HTMLDivElement;
  // Typed loosely because monaco is only imported in the browser, below.
  let editor: any = null;
  let monaco: any = null;
  let ready = $state(false);

  // Guards the feedback loop: writing a new value into the editor fires
  // onDidChangeModelContent, which would otherwise write straight back out.
  let applyingExternalValue = false;
  let debounceTimer: ReturnType<typeof setTimeout>;
  let copyHandler: (() => void) | null = null;
  let domNode: HTMLElement | null = null;

  onMount(async () => {
    // Monaco touches `window` and `document` at import time, so it can only be
    // loaded once we're actually in the browser — never during SSR.
    monaco = await import("monaco-editor");
    const editorWorker = (
      await import("monaco-editor/esm/vs/editor/editor.worker?worker")
    ).default;
    (self as any).MonacoEnvironment = { getWorker: () => new editorWorker() };

    monaco.editor.defineTheme("codebench-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#0f1613",
        "editor.foreground": "#e7f0ec",
        "editorLineNumber.foreground": "#4a5a53",
      },
    });

    editor = monaco.editor.create(editorContainer, {
      value,
      language,
      theme: "codebench-dark",
      automaticLayout: true,
      readOnly,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: "on",
      scrollBeyondLastLine: false,
      tabSize: 2,
      renderLineHighlight: "line",
    });
    ready = true;

    editor.onDidChangeModelContent(() => {
      if (applyingExternalValue) return;
      const next = editor.getValue();
      onChange(next);

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        candidateStore.updateCode(questionId, next);
        if ($socketStore.isConnected) {
          socketStore.emit("candidate:typing", { questionId });
          socketStore.emit("candidate:codeChange", { questionId, code: next });
        }
      }, 500);
    });

    // Paste and copy inside the editor are reported for the live monitor. The
    // page-level listeners don't see these, since Monaco handles them itself.
    editor.onDidPaste(() => socketStore.emit("candidate:event", { type: "paste" }));

    domNode = editor.getDomNode();
    if (domNode) {
      copyHandler = () => socketStore.emit("candidate:event", { type: "copy" });
      domNode.addEventListener("copy", copyHandler);
    }
  });

  // Switching question or language replaces the buffer from the outside.
  $effect(() => {
    if (!ready || !editor) return;
    if (value === editor.getValue()) return;

    applyingExternalValue = true;
    editor.setValue(value);
    applyingExternalValue = false;
  });

  $effect(() => {
    if (!ready || !editor || !monaco) return;
    const model = editor.getModel();
    if (model) monaco.editor.setModelLanguage(model, language);
  });

  $effect(() => {
    if (ready && editor) editor.updateOptions({ readOnly });
  });

  onDestroy(() => {
    clearTimeout(debounceTimer);
    if (domNode && copyHandler) domNode.removeEventListener("copy", copyHandler);
    editor?.dispose();
  });
</script>

<div class="editor-wrapper">
  <div bind:this={editorContainer} class="editor-container"></div>
  {#if !ready}
    <p class="editor-loading">Loading editor…</p>
  {/if}
</div>

<style>
  .editor-wrapper {
    position: relative;
    height: 100%;
    min-height: 420px;
    background: #0f1613;
    border-radius: 8px;
    overflow: hidden;
  }

  .editor-container {
    height: 100%;
    min-height: 420px;
  }

  .editor-loading {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    color: #6b7f77;
    font-size: 0.85rem;
    background: #0f1613;
  }
</style>

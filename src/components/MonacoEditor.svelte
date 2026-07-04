<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import * as monaco from "monaco-editor";
  import { socketStore } from "$stores/socketStore";
  import { candidateStore } from "$stores/candidateStore";

  let {
    code = "",
    language = "javascript",
    readOnly = false,
    questionId = "",
  } = $props<{
    code?: string;
    language?: string;
    readOnly?: boolean;
    questionId?: string;
  }>();

  let editorContainer!: HTMLDivElement;
  let editor: monaco.editor.IStandaloneCodeEditor | null = null;

  let debounceTimer: ReturnType<typeof setTimeout>;

  let domNode: HTMLElement | null = null;
  let copyHandler: (() => void) | null = null;

  onMount(() => {
    // Configure Monaco
    monaco.editor.defineTheme("dark-theme", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#1e1e1e",
        "editor.foreground": "#d4d4d4",
        "editorLineNumber.foreground": "#858585",
        "editor.selectionBackground": "#264f78",
        "editor.inactiveSelectionBackground": "#3a3d41",
      },
    });

    // Create editor
    editor = monaco.editor.create(editorContainer, {
      value: code,
      language,
      theme: "dark-theme",
      automaticLayout: true,
      readOnly,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: "on",
      scrollBeyondLastLine: false,
      tabSize: 2,
      detectIndentation: true,
    });

    // Track code changes
    editor.onDidChangeModelContent(() => {
      clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        const newCode = editor?.getValue() ?? "";

        code = newCode;
        candidateStore.updateCode(questionId, newCode);

        if ($socketStore.isConnected) {
          socketStore.emit("candidate:typing", {
            questionId,
            timestamp: Date.now(),
          });

          // Optional: send current code to recruiters
          socketStore.emit("candidate:codeChange", {
            questionId,
            code: newCode,
          });
        }
      }, 500);
    });

    // Track cursor movement
    editor.onDidChangeCursorPosition(
      (e: monaco.editor.ICursorPositionChangedEvent) => {
        if ($socketStore.isConnected) {
          socketStore.emit("candidate:event", {
            eventType: "CURSOR_MOVE",
            metadata: {
              position: e.position,
              questionId,
            },
          });
        }
      },
    );

    // Track paste
    editor.onDidPaste(() => {
      if ($socketStore.isConnected) {
        socketStore.emit("candidate:event", {
          eventType: "PASTE",
          metadata: {
            questionId,
            timestamp: Date.now(),
          },
        });
      }
    });

    // Track copy
    domNode = editor.getDomNode();

    if (domNode) {
      copyHandler = () => {
        if ($socketStore.isConnected) {
          socketStore.emit("candidate:event", {
            eventType: "COPY",
            metadata: {
              questionId,
              timestamp: Date.now(),
            },
          });
        }
      };

      domNode.addEventListener("copy", copyHandler);
    }
  });

  onDestroy(() => {
    clearTimeout(debounceTimer);

    if (domNode && copyHandler) {
      domNode.removeEventListener("copy", copyHandler);
    }

    editor?.dispose();
  });
</script>

<div class="editor-wrapper">
  <div class="editor-header">
    <span class="language-badge">{language}</span>
    <span class="editor-status">
      {#if readOnly}
        <span class="badge badge-secondary">Read Only</span>
      {/if}
    </span>
  </div>
  <div bind:this={editorContainer} class="editor-container"></div>
</div>

<style>
  .editor-wrapper {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #1e1e1e;
    border-radius: 8px;
    overflow: hidden;
  }

  .editor-header {
    padding: 8px 16px;
    background: #252526;
    border-bottom: 1px solid #3e3e42;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .editor-container {
    flex: 1;
    min-height: 400px;
  }

  .language-badge {
    background: #2d2d2d;
    color: #d4d4d4;
    padding: 2px 12px;
    border-radius: 12px;
    font-size: 12px;
    text-transform: uppercase;
  }

  .badge-secondary {
    background: #3e3e42;
    color: #d4d4d4;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
  }
</style>

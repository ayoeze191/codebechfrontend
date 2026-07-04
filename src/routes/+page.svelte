<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { auth } from "$lib/auth";

  let email = $state("");
  let password = $state("");
  let name = $state("");
  let mode = $state<"login" | "register">("login");
  let error = $state("");
  let loading = $state(false);

  onMount(() => {
    auth.init();
  });

  async function submit() {
    error = "";
    loading = true;
    try {
      const user =
        mode === "login"
          ? await auth.login(email, password)
          : await auth.register({ email, password, name, role: "RECRUITER" });

      // Only RECRUITER and ADMIN accounts exist behind this form now —
      // candidates never authenticate here, they use their invitation link.
      goto("/recruiter/dashboard");
    } catch (err) {
      error = err instanceof Error ? err.message : "Authentication failed";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>CodeBench</title>
</svelte:head>

<main class="shell">
  <section class="panel">
    <div>
      <p class="eyebrow">CodeBench</p>
      <h1>{mode === "login" ? "Sign in" : "Create account"}</h1>
    </div>
    <form onsubmit={submit}>
      <label>
        <span>Email</span>
        <input bind:value={email} type="email" autocomplete="email" required />
      </label>
      <label>
        <span>Password</span>
        <input
          bind:value={password}
          type="password"
          autocomplete={mode === "login" ? "current-password" : "new-password"}
          minlength={mode === "register" ? 8 : undefined}
          required
        />
        {#if mode === "register"}
          <span class="hint">At least 8 characters</span>
        {/if}
      </label>
      {#if mode === "register"}
        <label>
          <span>Name</span>
          <input bind:value={name} autocomplete="name" />
        </label>
      {/if}
      {#if error}
        <p class="error">{error}</p>
      {/if}
      <button type="submit" disabled={loading}
        >{loading ? "Please wait..." : "Continue"}</button
      >
    </form>
    <button
      class="link"
      type="button"
      onclick={() => (mode = mode === "login" ? "register" : "login")}
    >
      {mode === "login" ? "Need an account?" : "Already have an account?"}
    </button>
  </section>
</main>

<style>
  .shell {
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: #f7f7f4;
    padding: 24px;
    color: #17201b;
  }
  .panel {
    width: min(420px, 100%);
    background: #ffffff;
    border: 1px solid #d9ded8;
    border-radius: 8px;
    padding: 28px;
    box-shadow: 0 12px 40px rgba(23, 32, 27, 0.08);
  }
  .eyebrow {
    margin: 0 0 6px;
    color: #3d6f5d;
    font-weight: 700;
  }
  h1 {
    margin: 0 0 24px;
    font-size: 28px;
  }
  form {
    display: grid;
    gap: 14px;
  }
  label {
    display: grid;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
  }
  input,
  select {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #c9d1cc;
    border-radius: 6px;
    padding: 11px 12px;
    font: inherit;
  }
  .hint {
    font-weight: 400;
    font-size: 12px;
    color: #6b756f;
  }
  button {
    border: 0;
    border-radius: 6px;
    background: #255f4b;
    color: white;
    font-weight: 700;
    padding: 12px 14px;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.7;
    cursor: wait;
  }
  .link {
    margin-top: 16px;
    width: 100%;
    background: transparent;
    color: #255f4b;
  }
  .error {
    margin: 0;
    color: #b42318;
    font-size: 14px;
  }
</style>

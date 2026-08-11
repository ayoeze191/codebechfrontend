<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { auth } from "$lib/auth";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

  // The shared Button defaults to the near-black `primary` token, which reads
  // as a different brand next to the emerald used everywhere else on this page.
  // tailwind-merge lets the class through cleanly.
  const cta = "bg-emerald-700 text-white hover:bg-emerald-800";

  let email = $state("");
  let password = $state("");
  let name = $state("");
  let mode = $state<"login" | "register">("login");
  let error = $state("");
  let loading = $state(false);

  onMount(() => {
    auth.init();
  });

  async function submit(event: SubmitEvent) {
    // A plain DOM handler in Svelte 5 — without this the form does a native
    // GET submit and reloads the page out from under the request.
    event.preventDefault();

    error = "";
    loading = true;
    try {
      if (mode === "login") {
        await auth.login(email, password);
      } else {
        await auth.register({ email, password, name, role: "RECRUITER" });
      }

      // Only RECRUITER and ADMIN accounts exist behind this form — candidates
      // never authenticate here, they use their invitation link.
      goto("/recruiter/dashboard");
    } catch (err) {
      error = err instanceof Error ? err.message : "Authentication failed";
    } finally {
      loading = false;
    }
  }

  const steps = [
    {
      title: "Build the assessment",
      body: "Write the questions, set a duration, and attach test cases. Mark any of them hidden so candidates can't tune their answer to the examples.",
    },
    {
      title: "Email the invitations",
      body: "Paste up to 200 addresses at once. Each candidate gets their own expiring link — resend it or revoke it at any point before they finish.",
    },
    {
      title: "Watch, then review",
      body: "Follow the session as it happens, then read every submission with per-test-case results and the exact code that produced them.",
    },
  ];

  const features = [
    {
      title: "No candidate accounts",
      body: "The invitation link is the identity. Nothing to sign up for, no password to reset, nothing left behind when the hiring round closes.",
    },
    {
      title: "Live session monitor",
      body: "See who is connected, who is typing, and what is in their editor right now — plus tab switches, window blur, copies, pastes, and fullscreen exits as they happen.",
    },
    {
      title: "Hidden test cases",
      body: "Candidates can run their code against the visible cases as often as they like. Submitting grades against every case, including the ones they never saw.",
    },
    {
      title: "One question, three languages",
      body: "Write a test case once as JSON. The same inputs map to arguments identically in JavaScript, Python, and Go, so candidates pick what they know.",
    },
    {
      title: "A clock that can't be gamed",
      body: "The countdown starts server-side the first time the link is opened. Reloading, switching browsers, or clearing storage doesn't buy more time.",
    },
    {
      title: "Questions freeze on send",
      body: "Once the first invitation goes out the questions are locked, so nobody is ever graded against an assessment that changed underneath them.",
    },
  ];

  const isolation = [
    "No network access at all",
    "256 MB memory cap, swap disabled",
    "Half a CPU core, hard quota",
    "64-process limit — fork bombs die",
    "Every Linux capability dropped, runs as non-root",
    "20-second wall clock, then the container is destroyed",
  ];

  // The real starter templates the API serves to the candidate editor.
  const samples = [
    {
      id: "javascript",
      label: "JavaScript",
      code: `// Export your solution. Arguments arrive in the
// order the test case lists them.
module.exports = function solve(a, b) {
  return a + b;
};`,
    },
    {
      id: "python",
      label: "Python",
      code: `# Define a top-level function named solve.
def solve(a, b):
    return a + b`,
    },
    {
      id: "go",
      label: "Go",
      code: `// Define an exported function named Solve.
// Do not write func main().
func Solve(a int, b int) int {
	return a + b
}`,
    },
  ];

  let activeSample = $state("javascript");
  const sample = $derived(
    samples.find((s) => s.id === activeSample) ?? samples[0],
  );
</script>

<svelte:head>
  <title>CodeBench — coding assessments for technical hiring</title>
  <meta
    name="description"
    content="Build a coding assessment, email candidates a link, watch them work in real time, and grade their code in an isolated sandbox. No candidate accounts required."
  />
</svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-900">
  <header
    class="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur"
  >
    <div
      class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4"
    >
      <a href="/" class="flex items-center gap-3">
        <span
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-900/10"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="28"
              height="28"
              rx="8"
              stroke="#255f4b"
              stroke-width="2.5"
            />
            <path
              d="M10 16L14 20L22 12"
              stroke="#255f4b"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span class="text-lg font-bold tracking-tight">CodeBench</span>
      </a>

      <nav class="hidden items-center gap-1 md:flex">
        <a
          href="#how-it-works"
          class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >How it works</a
        >
        <a
          href="#capabilities"
          class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >Capabilities</a
        >
        <a
          href="#sandbox"
          class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >Sandbox</a
        >
      </nav>

      <div class="flex items-center gap-3">
        {#if $auth.user}
          <Button href="/recruiter/dashboard" size="lg" class={cta}
            >Go to dashboard</Button
          >
        {:else}
          <a
            href="#sign-in"
            class="text-sm font-semibold text-emerald-800 hover:text-emerald-900"
            >Sign in</a
          >
        {/if}
      </div>
    </div>
  </header>

  <!-- Hero: positioning on the left, the thing a returning recruiter actually
       came here to do on the right. -->
  <section class="mx-auto max-w-7xl px-6 pt-16 pb-20 lg:pt-24">
    <div class="grid items-start gap-12 lg:grid-cols-[1.1fr_auto] lg:gap-16">
      <div>
        <span
          class="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700"
        >
          For technical hiring teams
        </span>

        <h1
          class="mt-6 text-4xl leading-[1.1] font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl"
        >
          See how candidates
          <span class="text-emerald-700">actually code.</span>
        </h1>

        <p class="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
          CodeBench runs your screening exercise in a real sandbox, grades it
          against tests you control, and lets you watch the session while it
          happens — without asking a single candidate to create an account.
        </p>

        <ul class="mt-8 grid max-w-xl gap-3">
          {#each ["Invite by email — the link is the login", "Watch the editor live and catch tab switches and pastes", "Grade against hidden tests inside an isolated container"] as point (point)}
            <li class="flex items-start gap-3">
              <span
                class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 6.5L4.8 8.8L9.5 3.5"
                    stroke="#15803d"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span class="text-slate-700">{point}</span>
            </li>
          {/each}
        </ul>

        <div
          class="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500"
        >
          <span class="font-medium text-slate-600">JavaScript</span>
          <span class="h-1 w-1 rounded-full bg-slate-300"></span>
          <span class="font-medium text-slate-600">Python</span>
          <span class="h-1 w-1 rounded-full bg-slate-300"></span>
          <span class="font-medium text-slate-600">Go</span>
        </div>
      </div>

      <!-- The sign-in card doubles as the redirect target for signed-out
           recruiters bounced out of /recruiter/*, so it stays on this route. -->
      <div id="sign-in" class="w-full lg:w-[420px]">
        {#if $auth.user}
          <div
            class="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5"
          >
            <h2 class="text-xl font-bold tracking-tight">
              Welcome back{$auth.user.name ? `, ${$auth.user.name}` : ""}
            </h2>
            <p class="mt-2 text-sm text-slate-500">
              You're signed in as {$auth.user.email}.
            </p>
            <Button
              href="/recruiter/dashboard"
              size="lg"
              class="mt-6 w-full justify-center {cta}"
              >Open the dashboard</Button
            >
            <Button
              variant="ghost"
              size="lg"
              class="mt-2 w-full justify-center"
              onclick={() => auth.logout()}>Sign out</Button
            >
          </div>
        {:else}
          <div
            class="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5"
          >
            <h2 class="text-xl font-bold tracking-tight">
              {mode === "login" ? "Sign in" : "Create your account"}
            </h2>
            <p class="mt-1.5 text-sm text-slate-500">
              {mode === "login"
                ? "Recruiter and admin accounts."
                : "Free to create — you'll be signed in straight away."}
            </p>

            <form class="mt-6 grid gap-4" onsubmit={submit}>
              <div class="grid gap-2">
                <Label for="email">Email</Label>
                <Input
                  id="email"
                  bind:value={email}
                  type="email"
                  autocomplete="email"
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div class="grid gap-2">
                <Label for="password">Password</Label>
                <Input
                  id="password"
                  bind:value={password}
                  type="password"
                  autocomplete={mode === "login"
                    ? "current-password"
                    : "new-password"}
                  minlength={mode === "register" ? 8 : undefined}
                  required
                />
                {#if mode === "register"}
                  <p class="text-xs text-slate-500">At least 8 characters.</p>
                {/if}
              </div>

              {#if mode === "register"}
                <div class="grid gap-2">
                  <Label for="name">Name <span class="font-normal text-slate-400">(optional)</span></Label>
                  <Input id="name" bind:value={name} autocomplete="name" />
                </div>
              {/if}

              {#if error}
                <p
                  class="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              {/if}

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                class="w-full justify-center {cta}"
              >
                {loading
                  ? "Please wait…"
                  : mode === "login"
                    ? "Sign in"
                    : "Create account"}
              </Button>
            </form>

            <p class="mt-5 text-center text-sm text-slate-500">
              {mode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}
              <button
                type="button"
                class="font-semibold text-emerald-800 hover:underline"
                onclick={() => {
                  mode = mode === "login" ? "register" : "login";
                  error = "";
                }}
              >
                {mode === "login" ? "Create one" : "Sign in"}
              </button>
            </p>
          </div>
        {/if}

        <p class="mt-4 text-center text-sm text-slate-500">
          Taking an assessment? Open the link in your invitation email — you
          don't need an account.
        </p>
      </div>
    </div>
  </section>

  <!-- How it works -->
  <section id="how-it-works" class="border-y border-slate-200 bg-white">
    <div class="mx-auto max-w-7xl px-6 py-20">
      <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
        Three steps, start to shortlist
      </h2>
      <p class="mt-3 max-w-2xl text-lg text-slate-600">
        From an empty dashboard to graded submissions without leaving the
        browser.
      </p>

      <ol class="mt-12 grid gap-8 md:grid-cols-3">
        {#each steps as step, i (step.title)}
          <li class="relative">
            <span
              class="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-700 text-lg font-bold text-white"
            >
              {i + 1}
            </span>
            <h3 class="mt-5 text-lg font-semibold text-slate-900">
              {step.title}
            </h3>
            <p class="mt-2 leading-relaxed text-slate-600">{step.body}</p>
          </li>
        {/each}
      </ol>
    </div>
  </section>

  <!-- Capabilities -->
  <section id="capabilities" class="mx-auto max-w-7xl px-6 py-20">
    <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
      Built around how screening actually goes wrong
    </h2>
    <p class="mt-3 max-w-2xl text-lg text-slate-600">
      Every one of these exists because the obvious version of a take-home
      leaks, drifts, or wastes someone's afternoon.
    </p>

    <div class="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {#each features as feature (feature.title)}
        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-xl"
        >
          <h3 class="text-base font-semibold text-slate-900">
            {feature.title}
          </h3>
          <p class="mt-2 text-sm leading-relaxed text-slate-600">
            {feature.body}
          </p>
        </div>
      {/each}
    </div>
  </section>

  <!-- Sandbox: the isolation guarantees, next to what the candidate writes -->
  <section id="sandbox" class="bg-slate-900 text-slate-100">
    <div class="mx-auto max-w-7xl px-6 py-20">
      <!-- min-w-0 on both tracks: a grid item defaults to min-width:auto, so
           without it the code blocks below widen the whole page instead of
           scrolling inside their own container. -->
      <div class="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div class="min-w-0">
          <span
            class="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-300"
          >
            Untrusted code, contained
          </span>
          <h2 class="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
            Their code runs in a container that doesn't survive the request
          </h2>
          <p class="mt-4 leading-relaxed text-slate-300">
            Every submission gets its own throwaway container, and it is
            destroyed the moment the run finishes — whether it passed, failed,
            or had to be killed.
          </p>

          <ul class="mt-8 grid gap-3">
            {#each isolation as rule (rule)}
              <li class="flex items-start gap-3">
                <span
                  class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2.5 6.5L4.8 8.8L9.5 3.5"
                      stroke="#6ee7b7"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <span class="text-slate-200">{rule}</span>
              </li>
            {/each}
          </ul>

          <p class="mt-8 text-sm text-slate-400">
            Execution is queued and handled by a separate worker process, so a
            runaway submission can never tie up the app the rest of your team is
            using.
          </p>
        </div>

        <div class="min-w-0">
          <p class="text-sm font-semibold text-slate-400">
            What the candidate writes
          </p>

          <div
            class="mt-4 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 shadow-2xl"
          >
            <div
              class="flex items-center gap-1 border-b border-slate-800 bg-slate-900/60 px-3 py-2"
            >
              {#each samples as item (item.id)}
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {activeSample ===
                  item.id
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'}"
                  aria-pressed={activeSample === item.id}
                  onclick={() => (activeSample = item.id)}
                >
                  {item.label}
                </button>
              {/each}
            </div>

            <pre class="overflow-x-auto p-5 text-sm leading-relaxed text-slate-200"><code
                >{sample.code}</code
              ></pre>
          </div>

          <div
            class="mt-4 rounded-2xl border border-slate-700/70 bg-slate-950/60 p-5"
          >
            <p class="text-sm font-semibold text-slate-300">
              And the test case that drives it
            </p>
            <pre class="mt-3 overflow-x-auto text-sm text-slate-400"><code
                >&#123;"a": 1, "b": 2&#125;  →  solve(1, 2)  →  3</code
              ></pre>
            <p class="mt-3 text-sm leading-relaxed text-slate-400">
              Inputs are plain JSON and map to arguments the same way in all
              three languages, so a question written once works for whoever
              takes it.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Candidate wayfinding: people do land here from a search instead of the
       emailed link, and there is nothing for them to sign into. -->
  <section class="border-b border-slate-200 bg-white">
    <div class="mx-auto max-w-7xl px-6 py-14">
      <div
        class="flex flex-col items-start justify-between gap-6 rounded-2xl border border-slate-200 bg-slate-50 p-8 sm:flex-row sm:items-center"
      >
        <div>
          <h2 class="text-xl font-semibold text-slate-900">
            Here to take an assessment?
          </h2>
          <p class="mt-2 max-w-2xl text-slate-600">
            There's nothing to sign into. Open the link in your invitation email
            and you're in — your timer only starts when you do.
          </p>
        </div>
        <span
          class="shrink-0 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
        >
          No account needed
        </span>
      </div>
    </div>
  </section>

  <!-- Closing call to action -->
  <section class="mx-auto max-w-7xl px-6 py-20 text-center">
    <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
      Put your next screen together in an afternoon
    </h2>
    <p class="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
      Write a couple of questions, invite a candidate, and watch the whole thing
      run end to end.
    </p>
    <div class="mt-8 flex flex-wrap justify-center gap-3">
      {#if $auth.user}
        <Button href="/recruiter/dashboard" size="lg" class={cta}
          >Go to your dashboard</Button
        >
      {:else}
        <Button href="#sign-in" size="lg" class={cta}>Create an account</Button>
        <Button href="#how-it-works" variant="outline" size="lg"
          >See how it works</Button
        >
      {/if}
    </div>
  </section>

  <footer class="border-t border-slate-200 bg-white">
    <div
      class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row"
    >
      <div class="flex items-center gap-2.5">
        <svg
          width="20"
          height="20"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="2"
            y="2"
            width="28"
            height="28"
            rx="8"
            stroke="#255f4b"
            stroke-width="2.5"
          />
          <path
            d="M10 16L14 20L22 12"
            stroke="#255f4b"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="text-sm font-semibold text-slate-700">CodeBench</span>
      </div>
      <p class="text-sm text-slate-500">
        Coding assessments for technical hiring.
      </p>
    </div>
  </footer>
</div>

"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

type ActionState = { error: string } | null;

async function action(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await loginAction(formData);
  return result ?? null;
}

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);

  return (
    <form
      action={formAction}
      className="w-full max-w-sm space-y-4 rounded-3xl border border-[var(--border)] p-8 bg-[var(--surface)] shadow-sm"
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-serif text-[var(--accent)]">Kitchen</h1>
        <p className="text-sm text-[var(--muted)]">Household login</p>
      </div>
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm text-[var(--muted)]">Password</span>
        <input
          type="password"
          name="password"
          autoFocus
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
          required
        />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-[var(--accent)] text-white py-2 font-medium disabled:opacity-60 hover:bg-[var(--accent-hover)] transition-colors"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

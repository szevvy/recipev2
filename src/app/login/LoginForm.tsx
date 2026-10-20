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
      className="w-full max-w-sm space-y-4 rounded-xl border border-black/10 dark:border-white/10 p-6 bg-white dark:bg-neutral-900 shadow-sm"
    >
      <h1 className="text-xl font-semibold">Household login</h1>
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm text-neutral-600 dark:text-neutral-400">Password</span>
        <input
          type="password"
          name="password"
          autoFocus
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </label>
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-blue-600 text-white py-2 font-medium disabled:opacity-60 hover:bg-blue-700"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

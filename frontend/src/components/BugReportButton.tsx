import React, { useEffect, useState } from "react";
import { submitBugReport } from "../lib/api";

type State = "idle" | "open" | "submitting" | "success" | "error";

export default function BugReportButton() {
  const [state, setState] = useState<State>("idle");
  const [description, setDescription] = useState("");
  const [page, setPage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  function open() {
    setDescription("");
    setPage(window.location.pathname);
    setErrorMsg("");
    setState("open");
  }

  useEffect(() => {
    window.addEventListener("open-bug-report", open);
    return () => window.removeEventListener("open-bug-report", open);
  }, []);

  function close() {
    if (state === "submitting") return;
    setState("idle");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setState("submitting");
    try {
      await submitBugReport({ description: description.trim(), page: page.trim() || undefined });
      setState("success");
      setTimeout(() => setState("idle"), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setState("error");
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={open}
        aria-label="Report a bug"
        className="fixed bottom-5 right-5 z-40 bg-away-moss hover:bg-away-green border border-away-green text-away-cream/70 hover:text-away-cream rounded-full px-4 py-2 text-xs font-semibold shadow-lg transition-all flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        Report a Bug
      </button>

      {/* Modal */}
      {state !== "idle" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="bg-away-forest border border-away-moss rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-away-moss">
              <h2 className="text-away-cream font-bold text-base">Report a Bug</h2>
              <button
                onClick={close}
                disabled={state === "submitting"}
                className="text-away-cream/40 hover:text-away-cream/80 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {state === "success" ? (
              <div className="px-5 py-8 text-center">
                <div className="w-12 h-12 bg-away-gold/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-away-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-away-cream font-semibold">Thanks! We got it.</p>
                <p className="text-away-cream/50 text-sm mt-1">Your report has been submitted.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="p-5 space-y-4">
                <div>
                  <label className="block text-away-cream/80 text-sm font-medium mb-1.5">
                    What went wrong? <span className="text-away-orange">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={state === "submitting"}
                    placeholder="Describe the issue — what you expected vs. what happened, steps to reproduce, etc."
                    rows={5}
                    maxLength={2000}
                    required
                    className="w-full bg-away-green border border-away-moss rounded-lg px-3 py-2 text-away-cream text-sm placeholder-away-cream/30 focus:outline-none focus:border-away-gold resize-none disabled:opacity-60"
                  />
                  <div className="text-right text-away-cream/30 text-xs mt-0.5">{description.length}/2000</div>
                </div>

                <div>
                  <label className="block text-away-cream/80 text-sm font-medium mb-1.5">
                    Page / feature <span className="text-away-cream/40 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={page}
                    onChange={(e) => setPage(e.target.value)}
                    disabled={state === "submitting"}
                    placeholder="/picks, bracket, leaderboard…"
                    className="w-full bg-away-green border border-away-moss rounded-lg px-3 py-2 text-away-cream text-sm placeholder-away-cream/30 focus:outline-none focus:border-away-gold disabled:opacity-60"
                  />
                </div>

                {state === "error" && (
                  <p className="text-red-400 text-sm bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">
                    {errorMsg}
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={close}
                    disabled={state === "submitting"}
                    className="flex-1 py-2 rounded-lg border border-away-moss text-away-cream/70 hover:text-away-cream text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={state === "submitting" || !description.trim()}
                    className="flex-1 py-2 rounded-lg bg-away-orange hover:bg-away-orange-light text-away-cream text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {state === "submitting" ? (
                      <>
                        <div className="w-4 h-4 border-2 border-away-cream border-t-transparent rounded-full animate-spin" />
                        Sending…
                      </>
                    ) : "Submit Report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

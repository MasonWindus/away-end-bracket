import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register, requestMagicLink } from "../lib/api";
import { useAuth } from "../lib/auth";

type Tab = "new" | "returning";

export default function Register() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("new");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  if (user) {
    navigate("/picks");
    return null;
  }

  async function handleNewUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!displayName.trim()) {
      setError("Please enter your display name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    setLoading(true);
    try {
      await register(displayName.trim(), email.trim().toLowerCase());
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReturningUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    setLoading(true);
    try {
      await requestMagicLink(email.trim().toLowerCase());
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send magic link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function switchTab(t: Tab) {
    setTab(t);
    setError(null);
    setSuccess(false);
    setDisplayName("");
    setEmail("");
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-900 border border-gray-700 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">📬</div>
          <h2 className="text-2xl font-bold text-white mb-3">Check Your Email!</h2>
          <p className="text-gray-400 leading-relaxed">
            We've sent a magic sign-in link to{" "}
            <span className="text-emerald-400 font-medium">{email}</span>.
          </p>
          <p className="text-gray-500 text-sm mt-3">
            Click the link in the email to sign in. It's valid for 15 minutes.
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="mt-6 text-emerald-400 hover:text-emerald-300 text-sm underline"
          >
            ← Try a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⚽</div>
          <h1 className="text-3xl font-extrabold text-white">
            <span className="text-emerald-400">The Away End</span>
          </h1>
          <p className="text-gray-400 mt-2">World Cup 2026 Bracket Contest</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            <button
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                tab === "new"
                  ? "bg-gray-800 text-emerald-400 border-b-2 border-emerald-400"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => switchTab("new")}
            >
              New User
            </button>
            <button
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                tab === "returning"
                  ? "bg-gray-800 text-emerald-400 border-b-2 border-emerald-400"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => switchTab("returning")}
            >
              Returning User
            </button>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {tab === "new" ? (
              <form onSubmit={handleNewUser} className="space-y-4">
                <p className="text-gray-400 text-sm mb-4">
                  Create a new account. We'll email you a magic link to sign in — no password needed!
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name (shown on leaderboard)"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
                    maxLength={50}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
                >
                  {loading ? "Creating Account..." : "Create Account & Get Link"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleReturningUser} className="space-y-4">
                <p className="text-gray-400 text-sm mb-4">
                  Already have an account? Enter your email and we'll send you a sign-in link.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
                >
                  {loading ? "Sending..." : "Send Magic Link"}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          By signing up, you join The Away End World Cup 2026 bracket contest.
          <br />
          No spam — just your magic link.
        </p>
      </div>
    </div>
  );
}

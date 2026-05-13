import React, { useState } from "react";
import { Filter } from "bad-words";
import { useNavigate } from "react-router-dom";
import { register, requestMagicLink } from "../lib/api";
import { useAuth } from "../lib/auth";

const profanityFilter = new Filter();

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
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  // Redirect if already logged in
  if (user) {
    navigate("/picks");
    return null;
  }

  function validateDisplayName(name: string): string | null {
    if (name.trim().length < 2) return "Display name must be at least 2 characters.";
    if (profanityFilter.isProfane(name)) return "Display name contains inappropriate language.";
    return null;
  }

  function handleDisplayNameBlur() {
    setDisplayNameError(validateDisplayName(displayName));
  }

  async function handleNewUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!displayName.trim()) {
      setError("Please enter your display name.");
      return;
    }
    const nameErr = validateDisplayName(displayName);
    if (nameErr) {
      setDisplayNameError(nameErr);
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
    setDisplayNameError(null);
    setSuccess(false);
    setDisplayName("");
    setEmail("");
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-away-green border border-away-moss rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">📬</div>
          <h2 className="text-2xl font-bold text-away-cream mb-3">Check Your Email!</h2>
          <p className="text-away-cream/70 leading-relaxed">
            We've sent a magic sign-in link to{" "}
            <span className="text-away-gold font-medium">{email}</span>.
          </p>
          <p className="text-away-cream/50 text-sm mt-3">
            Click the link in the email to sign in. It's valid for 15 minutes.
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="mt-6 text-away-gold hover:text-away-gold-light text-sm underline"
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
          <h1 className="font-display text-4xl tracking-widest text-away-gold">
            The Away End
          </h1>
          <p className="text-away-cream/60 mt-2">World Cup 2026 Bracket Contest</p>
        </div>

        <div className="bg-away-green border border-away-moss rounded-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-away-moss">
            <button
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                tab === "new"
                  ? "bg-away-moss text-away-gold border-b-2 border-away-gold"
                  : "text-away-cream/60 hover:text-away-cream"
              }`}
              onClick={() => switchTab("new")}
            >
              New User
            </button>
            <button
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                tab === "returning"
                  ? "bg-away-moss text-away-gold border-b-2 border-away-gold"
                  : "text-away-cream/60 hover:text-away-cream"
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
                <p className="text-away-cream/60 text-sm mb-4">
                  Create a new account. We'll email you a magic link to sign in — no password needed!
                </p>
                <div>
                  <label className="block text-sm font-medium text-away-cream/80 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value); setDisplayNameError(null); }}
                    onBlur={handleDisplayNameBlur}
                    placeholder="Your name (shown on leaderboard)"
                    className={`w-full bg-away-forest border rounded-lg px-4 py-3 text-away-cream placeholder-away-cream/30 focus:outline-none focus:ring-1 text-sm ${displayNameError ? "border-red-600 focus:border-red-600 focus:ring-red-600" : "border-away-moss focus:border-away-gold focus:ring-away-gold"}`}
                    maxLength={50}
                    disabled={loading}
                  />
                  {displayNameError && (
                    <p className="mt-1 text-red-400 text-xs">{displayNameError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-away-cream/80 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-away-forest border border-away-moss rounded-lg px-4 py-3 text-away-cream placeholder-away-cream/30 focus:outline-none focus:border-away-gold focus:ring-1 focus:ring-away-gold text-sm"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-away-orange hover:bg-away-orange-light disabled:opacity-60 disabled:cursor-not-allowed text-away-cream font-bold py-3 rounded-lg transition-colors"
                >
                  {loading ? "Creating Account..." : "Create Account & Get Link"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleReturningUser} className="space-y-4">
                <p className="text-away-cream/60 text-sm mb-4">
                  Already have an account? Enter your email and we'll send you a sign-in link.
                </p>
                <div>
                  <label className="block text-sm font-medium text-away-cream/80 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-away-forest border border-away-moss rounded-lg px-4 py-3 text-away-cream placeholder-away-cream/30 focus:outline-none focus:border-away-gold focus:ring-1 focus:ring-away-gold text-sm"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-away-orange hover:bg-away-orange-light disabled:opacity-60 disabled:cursor-not-allowed text-away-cream font-bold py-3 rounded-lg transition-colors"
                >
                  {loading ? "Sending..." : "Send Magic Link"}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-away-cream/40 text-xs mt-6">
          By signing up, you join The Away End World Cup 2026 bracket contest.
          <br />
          No spam — just your magic link.
        </p>
      </div>
    </div>
  );
}

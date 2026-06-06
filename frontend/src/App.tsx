import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Navbar from "./components/Navbar";
import BugReportButton from "./components/BugReportButton";
import Home from "./pages/Home";
import Register from "./pages/Register";
import Verify from "./pages/Verify";
import Picks from "./pages/Picks";
import LeaderboardPage from "./pages/LeaderboardPage";
import PublicBracketPage from "./pages/PublicBracketPage";
import Admin from "./pages/Admin";

const BRACKET_FIX_NOTICE_KEY = "bracketFixNotice_v1";

function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-emerald-400 text-lg animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/register" replace />;
  }

  if (requireAdmin && !user.is_admin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const [showBracketNotice, setShowBracketNotice] = useState(
    () => localStorage.getItem(BRACKET_FIX_NOTICE_KEY) !== "dismissed"
  );
  function dismissBracketNotice() {
    localStorage.setItem(BRACKET_FIX_NOTICE_KEY, "dismissed");
    setShowBracketNotice(false);
  }

  return (
    <div className="min-h-screen bg-away-forest">
      <Navbar />
      {showBracketNotice && (
        <div className="bg-amber-900/30 border-b border-amber-500/40 px-4 py-2.5 flex items-center gap-3">
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="flex-1 text-amber-200 text-xs sm:text-sm">
            <span className="font-semibold">Bracket updated:</span> The R32 matchups have been corrected to match the official FIFA 2026 draw. If you have existing knockout picks, please{" "}
            <a href="/picks" className="underline hover:text-amber-100">review your bracket</a>.
          </p>
          <button
            onClick={dismissBracketNotice}
            className="shrink-0 text-amber-400/60 hover:text-amber-200 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/verify" element={<Verify />} />
          <Route
            path="/picks"
            element={
              <ProtectedRoute>
                <Picks />
              </ProtectedRoute>
            }
          />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/bracket/:userId" element={<PublicBracketPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="border-t border-away-moss/40 mt-12 py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-bug-report"))}
            className="text-away-cream/30 hover:text-away-cream/60 text-xs transition-colors"
          >
            Report a Bug
          </button>
        </div>
      </footer>

      <BugReportButton />
    </div>
  );
}

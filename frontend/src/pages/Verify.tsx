import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";

type VerifyState = "verifying" | "success" | "error";

export default function Verify() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refetch } = useAuth();
  const calledRef = useRef(false);
  const [state, setState] = useState<VerifyState>("verifying");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const token = searchParams.get("token");
    if (!token) {
      navigate("/register", { replace: true });
      return;
    }

    fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorMessage(data.error || "This link is invalid or has expired.");
          setState("error");
          return;
        }
        setState("success");
        refetch();
        setTimeout(() => navigate("/picks", { replace: true }), 2000);
      })
      .catch(() => {
        setErrorMessage("Something went wrong. Please try again.");
        setState("error");
      });
  }, [navigate, refetch, searchParams]);

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-900 border border-gray-700 rounded-2xl p-10 text-center">
          <div className="text-5xl mb-5">❌</div>
          <h2 className="text-2xl font-bold text-white mb-3">Sign in failed</h2>
          <p className="text-gray-400 mb-6">{errorMessage}</p>
          <button
            onClick={() => navigate("/register", { replace: true })}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Request a new link
          </button>
        </div>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-900 border border-gray-700 rounded-2xl p-10 text-center">
          <div className="text-5xl mb-5">✅</div>
          <h2 className="text-2xl font-bold text-white mb-3">You're signed in!</h2>
          <p className="text-gray-400 mb-2">Welcome back to The Away End Bracket Contest.</p>
          <p className="text-gray-500 text-sm">Redirecting you to your picks in a moment...</p>
          <div className="mt-6 flex justify-center">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-700 rounded-2xl p-10 text-center">
        <div className="flex justify-center mb-5">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Signing you in...</h2>
        <p className="text-gray-400">Please wait a moment.</p>
      </div>
    </div>
  );
}

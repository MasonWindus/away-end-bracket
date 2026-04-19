import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Verify() {
  const navigate = useNavigate();
  const { refetch } = useAuth();
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    // The backend has already set the session cookie via the /api/auth/verify?token=... redirect.
    // We just need to refetch the user and then redirect to picks.
    refetch();

    const timer = setTimeout(() => {
      navigate("/picks", { replace: true });
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate, refetch]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-700 rounded-2xl p-10 text-center">
        <div className="text-5xl mb-5">✅</div>
        <h2 className="text-2xl font-bold text-white mb-3">You're signed in!</h2>
        <p className="text-gray-400 mb-2">Welcome back to The Away End Bracket Contest.</p>
        <p className="text-gray-500 text-sm">
          Redirecting you to your picks in a moment...
        </p>
        <div className="mt-6 flex justify-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
}

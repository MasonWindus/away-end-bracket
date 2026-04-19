import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { logout } from "../lib/api";

export default function Navbar() {
  const { user, refetch } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // ignore
    }
    refetch();
    navigate("/");
    setMenuOpen(false);
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link
            to="/"
            className="flex items-center gap-2 text-white font-bold text-lg tracking-wide hover:text-emerald-400 transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            <span className="text-2xl">⚽</span>
            <span className="text-emerald-400">THE AWAY END</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/leaderboard"
              className="text-gray-300 hover:text-emerald-400 transition-colors text-sm font-medium"
            >
              Leaderboard
            </Link>
            {user ? (
              <>
                <Link
                  to="/picks"
                  className="text-gray-300 hover:text-emerald-400 transition-colors text-sm font-medium"
                >
                  My Picks
                </Link>
                {user.is_admin && (
                  <Link
                    to="/admin"
                    className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm font-medium"
                  >
                    Admin
                  </Link>
                )}
                <span className="text-gray-400 text-sm">{user.display_name}</span>
                <button
                  onClick={handleLogout}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/register"
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-gray-300 hover:text-white p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-800 mt-2 pt-4 space-y-2">
            <Link
              to="/leaderboard"
              className="block text-gray-300 hover:text-emerald-400 py-2 text-sm font-medium transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Leaderboard
            </Link>
            {user ? (
              <>
                <Link
                  to="/picks"
                  className="block text-gray-300 hover:text-emerald-400 py-2 text-sm font-medium transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  My Picks
                </Link>
                {user.is_admin && (
                  <Link
                    to="/admin"
                    className="block text-yellow-400 hover:text-yellow-300 py-2 text-sm font-medium transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Admin
                  </Link>
                )}
                <div className="pt-2 border-t border-gray-800">
                  <p className="text-gray-400 text-sm mb-2">{user.display_name}</p>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <Link
                to="/register"
                className="block bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm font-medium transition-colors text-center"
                onClick={() => setMenuOpen(false)}
              >
                Sign In
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

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
    <nav className="bg-away-moss border-b border-away-green sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link
            to="/"
            className="flex items-center gap-2 text-away-cream hover:text-away-gold transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            <img src="/favicon.png" alt="" className="w-7 h-7 object-contain" aria-hidden="true" />
            <span className="font-display text-2xl tracking-widest text-away-gold leading-none">
              THE AWAY END
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/about"
              className="text-away-cream/80 hover:text-away-gold transition-colors text-sm font-semibold tracking-wide uppercase"
            >
              About
            </Link>
            <Link
              to="/leaderboard"
              className="text-away-cream/80 hover:text-away-gold transition-colors text-sm font-semibold tracking-wide uppercase"
            >
              Leaderboard
            </Link>
            {user ? (
              <>
                <Link
                  to="/picks"
                  className="text-away-cream/80 hover:text-away-gold transition-colors text-sm font-semibold tracking-wide uppercase"
                >
                  My Picks
                </Link>
                {user.is_admin && (
                  <Link
                    to="/admin"
                    className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm font-semibold tracking-wide uppercase"
                  >
                    Admin
                  </Link>
                )}
                <span className="text-away-cream/60 text-sm">{user.display_name}</span>
                <button
                  onClick={handleLogout}
                  className="bg-away-green hover:bg-away-forest text-away-cream px-3 py-1.5 rounded text-sm font-semibold transition-colors border border-away-green"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/register"
                className="bg-away-orange hover:bg-away-orange-light text-away-cream px-4 py-1.5 rounded text-sm font-semibold transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-away-cream/80 hover:text-away-cream p-2"
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
          <div className="md:hidden pb-4 border-t border-away-green mt-2 pt-4 space-y-2">
            <Link
              to="/about"
              className="block text-away-cream/80 hover:text-away-gold py-2 text-sm font-semibold uppercase tracking-wide transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              About
            </Link>
            <Link
              to="/leaderboard"
              className="block text-away-cream/80 hover:text-away-gold py-2 text-sm font-semibold uppercase tracking-wide transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Leaderboard
            </Link>
            {user ? (
              <>
                <Link
                  to="/picks"
                  className="block text-away-cream/80 hover:text-away-gold py-2 text-sm font-semibold uppercase tracking-wide transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  My Picks
                </Link>
                {user.is_admin && (
                  <Link
                    to="/admin"
                    className="block text-yellow-400 hover:text-yellow-300 py-2 text-sm font-semibold uppercase tracking-wide transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Admin
                  </Link>
                )}
                <div className="pt-2 border-t border-away-green">
                  <p className="text-away-cream/60 text-sm mb-2">{user.display_name}</p>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left bg-away-green hover:bg-away-forest text-away-cream px-3 py-2 rounded text-sm font-semibold transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <Link
                to="/register"
                className="block bg-away-orange hover:bg-away-orange-light text-away-cream px-4 py-2 rounded text-sm font-semibold transition-colors text-center"
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

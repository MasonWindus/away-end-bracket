import React from "react";

const scoringRows = [
  { stage: "Group Stage", description: "Correctly place a team (1st–4th) within their group", points: "1 pt each" },
  { stage: "Best Third-Place", description: "Correctly pick a third-place team that advances", points: "1 pt each" },
  { stage: "Round of 32", description: "Correctly pick a team to advance", points: "2 pts each" },
  { stage: "Round of 16", description: "Correctly pick a team to advance", points: "4 pts each" },
  { stage: "Quarterfinals", description: "Correctly pick a team to advance", points: "6 pts each" },
  { stage: "Semifinals", description: "Correctly pick a team to advance", points: "10 pts each" },
  { stage: "Runner-Up", description: "Correctly pick the finalist who doesn't win it all", points: "15 pts" },
  { stage: "Champion", description: "Correctly pick the World Cup winner", points: "20 pts" },
];

export default function About() {
  return (
    <div className="min-h-screen bg-away-forest">
      <div className="max-w-3xl mx-auto px-4 py-16 space-y-10">

        {/* Header */}
        <div className="text-center">
          <h1 className="font-display text-5xl sm:text-6xl tracking-widest text-away-gold mb-4">
            ABOUT
          </h1>
          <p className="text-away-cream/70 text-lg leading-relaxed">
            The Away End Bracket is a fan-run World Cup bracket challenge for listeners of{" "}
            <span className="text-away-cream font-semibold">The Away End Podcast</span>. Sign up
            with your email, fill out your bracket, and check back daily once the tournament kicks
            off to see how your picks are holding up.
          </p>
          <p className="text-away-cream/70 text-lg leading-relaxed mt-4">
            The podcast hosts have put up signed copies of their book as a prize for the winner —
            so there's actually something on the line. Good luck, and hopefully this gives you a
            reason to care about every single match.
          </p>
        </div>

        {/* How to Enter */}
        <div className="bg-away-green border border-away-moss rounded-xl p-6 space-y-4">
          <h2 className="font-display text-3xl tracking-widest text-away-gold">HOW TO ENTER</h2>
          <ol className="space-y-3 text-away-cream/80 list-none">
            {[
              "Sign up with your email address — no password required.",
              "Fill out your bracket: pick group standings, third-place advancers, and every knockout round all the way to the champion.",
              "Submit your picks before the tournament starts. Once matches begin, brackets are locked.",
              "Check the leaderboard daily to see where you stand.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="font-display text-away-gold text-xl leading-none mt-0.5">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Scoring */}
        <div className="bg-away-green border border-away-moss rounded-xl p-6 space-y-4">
          <h2 className="font-display text-3xl tracking-widest text-away-gold">SCORING</h2>
          <p className="text-away-cream/60 text-sm">Points increase as the tournament progresses — getting the champion right is worth the most.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-away-moss">
                  <th className="text-left text-away-gold/80 font-semibold uppercase tracking-wide py-2 pr-4">Stage</th>
                  <th className="text-left text-away-gold/80 font-semibold uppercase tracking-wide py-2 pr-4 hidden sm:table-cell">What earns points</th>
                  <th className="text-right text-away-gold/80 font-semibold uppercase tracking-wide py-2">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-away-moss/40">
                {scoringRows.map((row) => (
                  <tr key={row.stage}>
                    <td className="py-2.5 pr-4 text-away-cream font-medium">{row.stage}</td>
                    <td className="py-2.5 pr-4 text-away-cream/60 hidden sm:table-cell">{row.description}</td>
                    <td className="py-2.5 text-right text-away-gold font-semibold tabular-nums">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bug report callout */}
        <div className="bg-away-green border border-away-moss rounded-xl p-6">
          <h2 className="font-display text-3xl tracking-widest text-away-gold mb-2">FOUND A BUG?</h2>
          <p className="text-away-cream/70 leading-relaxed">
            There's a bug report button on every page — use it to flag any issues you run into, or
            just to say hi. We'd love to hear from you.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-bug-report"))}
            className="mt-4 bg-away-orange hover:bg-away-orange-light text-away-cream px-5 py-2 rounded text-sm font-semibold transition-colors"
          >
            Report a Bug
          </button>
        </div>

      </div>
    </div>
  );
}

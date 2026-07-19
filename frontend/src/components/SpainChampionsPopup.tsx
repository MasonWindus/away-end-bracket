import React, { useEffect, useRef } from "react";
import TeamFlag from "./TeamFlag";

const CONFETTI_COLORS = ["#F2C200", "#C45231", "#F5F0DF", "#AA151B", "#D4694A"];
const CONFETTI_COUNT = 140;

interface ConfettiPiece {
  x: number;
  y: number;
  size: number;
  color: string;
  speed: number;
  drift: number;
  rotation: number;
  spin: number;
}

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    function handleResize() {
      width = canvas!.width = window.innerWidth;
      height = canvas!.height = window.innerHeight;
    }
    window.addEventListener("resize", handleResize);

    const pieces: ConfettiPiece[] = Array.from({ length: CONFETTI_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height - height,
      size: 6 + Math.random() * 8,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      speed: 1.5 + Math.random() * 2.5,
      drift: Math.random() * 2 - 1,
      rotation: Math.random() * 360,
      spin: Math.random() * 6 - 3,
    }));

    let frameId: number;
    function draw() {
      ctx!.clearRect(0, 0, width, height);
      for (const p of pieces) {
        p.y += p.speed;
        p.x += p.drift;
        p.rotation += p.spin;
        if (p.y > height) {
          p.y = -20;
          p.x = Math.random() * width;
        }
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rotation * Math.PI) / 180);
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx!.restore();
      }
      frameId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[60] pointer-events-none"
      aria-hidden="true"
    />
  );
}

export default function SpainChampionsPopup({ onDismiss }: { onDismiss: () => void }) {
  return (
    <>
      <ConfettiCanvas />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-away-green border-2 border-away-gold rounded-2xl p-6 max-w-md w-full shadow-2xl text-center">
          <div className="text-5xl mb-2" aria-hidden="true">
            🏆🎉🎊
          </div>
          <h2 className="text-3xl font-bold text-away-gold font-display tracking-wide mb-1">
            ¡Campeones del Mundo!
          </h2>
          <p className="text-away-cream text-lg font-semibold mb-4 flex items-center justify-center gap-2">
            <TeamFlag code="ESP" /> Spain wins the World Cup! <TeamFlag code="ESP" />
          </p>
          <p className="text-away-cream/80 text-sm leading-relaxed mb-3">
            Congratulations to Spain, worthy champions of the world!
          </p>
          <p className="text-away-cream/70 text-sm leading-relaxed mb-3">
            And to every single one of you who filled out a bracket for this very silly little
            game: thank you. Thank you for the group stage picks. Thank you for agonizing over
            your knockout bracket. Thank you for checking the leaderboard way more than was
            healthy. Whether you nailed it or your bracket was busted by the Round of 32, you
            showed up and you played along, and that means the world to us.
          </p>
          <p className="text-away-cream/60 text-xs leading-relaxed mb-6 italic">
            We mean it. Every single entrant. Even the late ones. Even the ones who picked
            teams based on jersey colors. You're all champions to us. Mostly Spain, though.
          </p>
          <button
            onClick={onDismiss}
            className="w-full py-3 bg-away-orange hover:bg-away-orange-light text-away-cream font-bold rounded-xl transition-colors text-sm"
          >
            ¡Vamos España!
          </button>
        </div>
      </div>
    </>
  );
}

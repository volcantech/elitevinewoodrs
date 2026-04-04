import { useState, useEffect, useRef } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Prize {
  id: number;
  label: string;
  type: string;
  value: number;
  color: string;
  probability: number;
}

interface WheelData {
  prizes: Prize[];
  canSpin: boolean;
  lastSpin: any;
  nextSpinAt: string | null;
}

interface SpinResult {
  spin: any;
  prize: Prize;
  nextSpinAt: string;
}

function getTimeUntil(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return "maintenant";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return h > 0 ? `${h}h ${m}min` : m > 0 ? `${m}min ${s}s` : `${s}s`;
}

export function SpinWheel() {
  const [data, setData] = useState<WheelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [angle, setAngle] = useState(0);
  const [countdown, setCountdown] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!data?.nextSpinAt) return;
    const interval = setInterval(() => {
      setCountdown(getTimeUntil(data.nextSpinAt!));
      if (new Date(data.nextSpinAt!).getTime() <= Date.now()) {
        setData(prev => prev ? { ...prev, canSpin: true, nextSpinAt: null } : prev);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [data?.nextSpinAt]);

  useEffect(() => {
    drawWheel(angle);
  }, [data, angle]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wheel", { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setData(d);
        if (d.nextSpinAt) setCountdown(getTimeUntil(d.nextSpinAt));
      }
    } catch {}
    setLoading(false);
  };

  const drawWheel = (currentAngle: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !data?.prizes?.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prizes = data.prizes;
    const total = prizes.reduce((s, p) => s + p.probability, 0);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = cx - 8;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Drop shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#1f2937";
    ctx.fill();
    ctx.restore();

    let startAngle = (currentAngle * Math.PI) / 180;
    prizes.forEach((prize) => {
      const sliceAngle = (prize.probability / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = prize.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 3;
      const maxLen = 14;
      const label = prize.label.length > maxLen ? prize.label.slice(0, maxLen) + "…" : prize.label;
      ctx.fillText(label, r - 10, 4);
      ctx.restore();

      startAngle += sliceAngle;
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
    grad.addColorStop(0, "#fbbf24");
    grad.addColorStop(1, "#d97706");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const handleSpin = async () => {
    if (!data?.canSpin || spinning || !data?.prizes?.length) return;
    setSpinning(true);
    setResult(null);

    try {
      const res = await fetch("/api/wheel/spin", {
        method: "POST",
        credentials: "include",
      });
      const spinResult: SpinResult = await res.json();

      if (!res.ok) {
        toast.error((spinResult as any).error || "Erreur");
        setSpinning(false);
        return;
      }

      const prizes = data.prizes;
      const total = prizes.reduce((s, p) => s + p.probability, 0);
      const wonPrize = spinResult.prize;

      let targetAngleOffset = 0;
      let cumulative = 0;
      for (const prize of prizes) {
        const sliceAngle = (prize.probability / total) * 360;
        if (prize.id === wonPrize.id) {
          const midAngle = cumulative + sliceAngle / 2;
          targetAngleOffset = 360 - midAngle;
          break;
        }
        cumulative += sliceAngle;
      }

      const fullSpins = 5 * 360;
      const finalAngle = fullSpins + targetAngleOffset;
      const duration = 5000;
      const startTime = performance.now();
      const startAngle = angle % 360;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 4);
        const current = startAngle + finalAngle * ease;
        setAngle(current);
        drawWheel(current);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          setAngle(current % 360);
          setResult(spinResult);
          setData(prev => prev ? { ...prev, canSpin: false, nextSpinAt: spinResult.nextSpinAt } : prev);
          setSpinning(false);
        }
      };

      animFrameRef.current = requestAnimationFrame(animate);
    } catch {
      toast.error("Erreur lors du spin");
      setSpinning(false);
    }
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!data || data.prizes.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>La roue n'est pas encore configurée.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Pointer */}
      <div className="relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10 w-0 h-0" style={{
          borderLeft: "10px solid transparent",
          borderRight: "10px solid transparent",
          borderTop: "22px solid #f59e0b",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
        }} />
        <canvas
          ref={canvasRef}
          width={280}
          height={280}
          className="rounded-full"
          style={{ display: "block" }}
        />
      </div>

      {result && (
        <div className={`text-center px-6 py-4 rounded-2xl border animate-in fade-in slide-in-from-bottom-2 duration-500 ${
          result.prize.type === "nothing"
            ? "bg-gray-800/60 border-gray-600 text-gray-400"
            : "bg-amber-500/10 border-amber-500/30"
        }`}>
          <p className="text-2xl mb-1">
            {result.prize.type === "nothing" ? "😔" : "🎉"}
          </p>
          <p className="font-bold text-white text-lg">{result.prize.label}</p>
          {result.prize.type === "points" && result.prize.value > 0 && (
            <p className="text-sm text-amber-400 mt-1">+{result.prize.value} points de fidélité ajoutés !</p>
          )}
          {result.prize.type === "discount" && (
            <p className="text-sm text-green-400 mt-1">{result.prize.value}% de réduction à utiliser lors de votre prochaine commande.</p>
          )}
          {result.prize.type === "nothing" && (
            <p className="text-sm text-gray-500 mt-1">Pas de chance cette fois-ci. Revenez demain !</p>
          )}
        </div>
      )}

      <button
        onClick={handleSpin}
        disabled={!data.canSpin || spinning}
        className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-lg transition-all ${
          data.canSpin && !spinning
            ? "bg-amber-500 hover:bg-amber-400 text-white shadow-lg hover:shadow-amber-500/30 hover:scale-105"
            : "bg-gray-700 text-gray-500 cursor-not-allowed"
        }`}
      >
        {spinning ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Rotation...</>
        ) : data.canSpin ? (
          <><RefreshCw className="w-5 h-5" /> Tourner la roue !</>
        ) : (
          <><RefreshCw className="w-5 h-5" /> Revenez dans {countdown || "demain"}</>
        )}
      </button>

      {data.lastSpin && !data.canSpin && (
        <p className="text-xs text-gray-500">
          Dernier spin : {data.lastSpin.prize_label} — {new Date(data.lastSpin.spun_at).toLocaleDateString("fr-FR")}
        </p>
      )}
    </div>
  );
}

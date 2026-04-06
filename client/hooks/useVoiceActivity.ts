import { useEffect, useRef, useState } from "react";

export function useVoiceActivity(stream: MediaStream | null, threshold = 10): boolean {
  const [speaking, setSpeaking] = useState(false);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setSpeaking(false);
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    try { ctxRef.current?.close(); } catch {}
    ctxRef.current = null;

    if (!stream) return;

    let ctx: AudioContext | null = null;
    let raf: number | null = null;
    let alive = true;

    try {
      ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);

      let lastSpeaking = false;
      function tick() {
        if (!alive) return;
        analyser.getByteTimeDomainData(buf);
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = buf[i] - 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / buf.length);
        const isSpeaking = rms > threshold;
        if (isSpeaking !== lastSpeaking) {
          lastSpeaking = isSpeaking;
          setSpeaking(isSpeaking);
        }
        raf = requestAnimationFrame(tick);
        rafRef.current = raf;
      }
      tick();
    } catch {}

    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      rafRef.current = null;
      try { ctx?.close(); } catch {}
    };
  }, [stream, threshold]);

  return speaking;
}

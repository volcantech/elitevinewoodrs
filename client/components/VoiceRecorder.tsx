import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Send, X, Loader2, Play, Pause } from "lucide-react";
import { toast } from "sonner";

type VoiceState = "idle" | "recording" | "stopped" | "sending";

interface VoiceRecorderProps {
  onSend: (audioData: string) => Promise<void>;
  disabled?: boolean;
  onActiveChange?: (active: boolean, state?: VoiceState) => void;
  sendRef?: React.MutableRefObject<(() => void) | null>;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AudioPlayer({ src, recordedDuration }: { src: string; recordedDuration?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(recordedDuration ?? 0);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.error("Audio play error:", err);
        toast.error("Impossible de lire l'audio");
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  };

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); if (audioRef.current) audioRef.current.currentTime = 0; }}
        onTimeUpdate={() => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); }}
        onDurationChange={() => { if (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0) setDuration(audioRef.current.duration); }}
        onLoadedMetadata={() => { if (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0) setDuration(audioRef.current.duration); }}
        className="hidden"
      />
      <button
        type="button"
        onClick={togglePlay}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-colors shrink-0"
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>
      <div className="flex flex-col gap-0.5 min-w-0">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.05}
          value={currentTime}
          onChange={handleSeek}
          className="w-28 sm:w-36 h-1 accent-amber-400 cursor-pointer"
        />
        <span className="text-[10px] text-gray-500 font-mono">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}

export function VoiceRecorder({ onSend, disabled, onActiveChange, sendRef }: VoiceRecorderProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const MAX_DURATION = 30;

  const stopRecording = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/ogg";

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16000,
      });

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioData(reader.result as string);
          setState("stopped");
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setState("recording");
      setDuration(0);

      intervalRef.current = setInterval(() => {
        setDuration(d => {
          if (d >= MAX_DURATION - 1) {
            stopRecording();
            return d + 1;
          }
          return d + 1;
        });
      }, 1000);
    } catch {
      toast.error("Impossible d'accéder au microphone");
    }
  }, [stopRecording]);

  const handleSend = useCallback(async () => {
    if (!audioData) return;
    setState("sending");
    try {
      await onSend(audioData);
      handleCancel();
    } catch {
      setState("stopped");
    }
  }, [audioData, onSend]);

  const handleCancel = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    stopRecording();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioData(null);
    setDuration(0);
    setState("idle");
  }, [audioUrl, stopRecording]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => {
    onActiveChange?.(state !== "idle", state);
    if (sendRef) {
      sendRef.current = state === "stopped" ? handleSend : null;
    }
  }, [state, onActiveChange, sendRef, handleSend]);

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={startRecording}
        disabled={disabled}
        className="p-2 rounded-xl text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all disabled:opacity-40"
        title="Message vocal"
      >
        <Mic className="w-5 h-5" />
      </button>
    );
  }

  if (state === "recording") {
    return (
      <div className="flex-1 flex items-center gap-2 bg-gray-800/80 rounded-xl px-3 py-1.5 border border-red-500/30">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
        <span className="text-red-400 text-sm font-mono min-w-[36px]">{formatDuration(duration)}</span>
        <button
          type="button"
          onClick={stopRecording}
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
          title="Arrêter"
        >
          <Square className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="p-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
          title="Annuler"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (state === "stopped" || state === "sending") {
    return (
      <div className="flex-1 flex items-center gap-2 bg-gray-800/80 rounded-xl px-3 py-1.5 border border-gray-700/50">
        <Mic className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        {audioUrl && <AudioPlayer src={audioUrl} recordedDuration={duration} />}
        {!sendRef && (state === "sending" ? (
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
        ) : (
          <button
            type="button"
            onClick={handleSend}
            className="p-1 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-all shrink-0"
            title="Envoyer"
          >
            <Send className="w-4 h-4" />
          </button>
        ))}
        <button
          type="button"
          onClick={handleCancel}
          className="p-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
          title="Annuler"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}

function dataUrlToMimeType(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+)/);
  return match ? match[1] : "audio/webm";
}

export function AudioMessageBubble({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) return;
    let url: string;

    if (src.startsWith("data:")) {
      // Convert data URL → Blob URL for reliable cross-browser playback
      try {
        const mimeType = dataUrlToMimeType(src);
        const base64 = src.split(",")[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mimeType });
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (e) {
        console.error("Failed to convert audio data URL to blob:", e);
        setError(true);
      }
    } else {
      setBlobUrl(src);
    }

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || error) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.error("Audio play error:", err);
        setError(true);
        toast.error("Impossible de lire l'audio");
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  };

  if (error) {
    return (
      <div className="flex items-center gap-2 py-0.5 text-gray-500 text-xs italic">
        <Mic className="w-3.5 h-3.5" />
        <span>Format audio non supporté</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-0.5">
      {blobUrl && (
        <audio
          ref={audioRef}
          src={blobUrl}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setCurrentTime(0);
            if (audioRef.current) audioRef.current.currentTime = 0;
          }}
          onTimeUpdate={() => {
            const audio = audioRef.current;
            if (!audio) return;
            setCurrentTime(audio.currentTime);
            if (isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
          }}
          onDurationChange={() => {
            const d = audioRef.current?.duration;
            if (d && isFinite(d) && d > 0) setDuration(d);
          }}
          onLoadedMetadata={() => {
            const d = audioRef.current?.duration;
            if (d && isFinite(d) && d > 0) setDuration(d);
          }}
          onError={(e) => {
            console.error("Audio element error:", e);
            setError(true);
          }}
          className="hidden"
        />
      )}
      <button
        type="button"
        onClick={togglePlay}
        disabled={!blobUrl}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-colors shrink-0 disabled:opacity-40"
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      <div className="flex flex-col gap-1 min-w-0">
        <input
          type="range"
          min={0}
          max={Math.max(duration, currentTime, 1)}
          step={0.05}
          value={currentTime}
          onChange={handleSeek}
          className="w-32 sm:w-40 h-1.5 accent-amber-400 cursor-pointer"
        />
        <span className="text-xs text-amber-300/80 font-mono tabular-nums">
          {playing
            ? <><span className="text-amber-400 font-semibold">{formatDuration(currentTime)}</span>{duration > 0 ? <span className="text-gray-500"> / {formatDuration(duration)}</span> : null}</>
            : <span className="text-gray-400">{duration > 0 ? formatDuration(duration) : "0:00"}</span>
          }
        </span>
      </div>
    </div>
  );
}

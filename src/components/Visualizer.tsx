import { useRef, useEffect, useState, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isAndroid } from "../lib/platform";

interface Props {
  playing: boolean;
}

const NUM_BINS = 64;
const MODE_LIST = ["bars", "xp", "oscilloscope", "circular"] as const;
type VisMode = typeof MODE_LIST[number];

const MODE_LABELS: Record<VisMode, string> = {
  bars: "Modern Capsules",
  xp: "Retro XP Equalizer",
  oscilloscope: "Oscilloscope",
  circular: "Circular Spectrum",
};

export function Visualizer({ playing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  
  const [visMode, setVisMode] = useState<VisMode>(() => {
    try {
      return (localStorage.getItem("flowplayer-vis-mode") as VisMode) || "bars";
    } catch {
      return "bars";
    }
  });

  const [modeIndicator, setModeIndicator] = useState<{ text: string; visible: boolean }>({
    text: "",
    visible: false,
  });

  const indicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audio data refs to avoid resetting drawing loop when audioData changes
  const audioDataRef = useRef<{ bins: number[] } | null>(null);
  const smoothBins = useRef<Float32Array>(new Float32Array(NUM_BINS));
  const binsData = useRef<Float32Array>(new Float32Array(NUM_BINS));
  const peaks = useRef<Float32Array>(new Float32Array(32)); // XP mode peak indicators
  
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // Listen to the Tauri event for incoming audio data.
  // ponytail: synchronous-ref pattern avoids the StrictMode double-mount race
  // where a stale .then(unsub => unsub()) from the first effect desubscribes
  // the listener of the second mount.
  useEffect(() => {
    if (isAndroid) return;
    let active = true;
    let unlisten: UnlistenFn | null = null;

    listen<{ bins: number[] }>("audio-data", (event) => {
      if (active) audioDataRef.current = event.payload;
    }).then((u) => {
      if (active) {
        unlisten = u;
      } else {
        u();
      }
    });

    return () => {
      active = false;
      if (unlisten) unlisten();
    };
  }, []);

  const cycleMode = useCallback(() => {
    setVisMode((current) => {
      const idx = MODE_LIST.indexOf(current);
      const next = MODE_LIST[(idx + 1) % MODE_LIST.length];
      try {
        localStorage.setItem("flowplayer-vis-mode", next);
      } catch {
        // Persisting the preference is optional (storage can be unavailable).
      }

      // Show temporary text indicator
      setModeIndicator({ text: MODE_LABELS[next], visible: true });
      if (indicatorTimer.current) clearTimeout(indicatorTimer.current);
      indicatorTimer.current = setTimeout(() => {
        setModeIndicator((prev) => ({ ...prev, visible: false }));
      }, 1500);

      return next;
    });
  }, []);

  // Main drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size the pixel buffer from the container. The canvas is absolutely
    // positioned, so its own size never feeds back into the layout.
    const container = canvas.parentElement ?? canvas;
    const resize = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(([entry]) => {
      resize(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(container);

    const rect = container.getBoundingClientRect();
    resize(rect.width, rect.height);

    let cancelled = false;

    const draw = (timestamp: number) => {
      if (cancelled) return;
      
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const data = audioDataRef.current;

      // Update values
      if (!playingRef.current) {
        const t = timestamp * 0.001;
        for (let i = 0; i < NUM_BINS; i++) {
          const idle = (Math.sin(t * 0.8 + i * 0.2) * 0.5 + 0.5) * 0.04 * (1 - (i / NUM_BINS) * 0.6);
          smoothBins.current[i] += (idle - smoothBins.current[i]) * 0.08;
        }
      } else if (data && data.bins) {
        for (let i = 0; i < NUM_BINS; i++) {
          binsData.current[i] = data.bins[i] ?? 0;
        }
        for (let i = 0; i < NUM_BINS; i++) {
          const target = binsData.current[i] ?? 0;
          smoothBins.current[i] += (target - smoothBins.current[i]) * 0.35;
        }
      } else {
        // Fade out when playing but no data
        for (let i = 0; i < NUM_BINS; i++) {
          smoothBins.current[i] *= 0.92;
        }
      }

      // Draw depending on active mode
      if (visMode === "bars") {
        // Modern Capsule Bars
        const gap = 2;
        const barWidth = (w - gap * (NUM_BINS - 1)) / NUM_BINS;
        if (barWidth <= 0) { frameRef.current = requestAnimationFrame(draw); return; }
        const radius = barWidth / 2;

        ctx.globalCompositeOperation = "lighter";
        const glowIntensity = smoothBins.current.reduce((a, b) => a + b, 0) / NUM_BINS;
        if (glowIntensity > 0.01) {
          const glowGrad = ctx.createLinearGradient(0, h * 0.6, 0, h);
          glowGrad.addColorStop(0, "rgba(74, 158, 255, 0)");
          glowGrad.addColorStop(1, `rgba(74, 158, 255, ${glowIntensity * 0.12})`);
          ctx.fillStyle = glowGrad;
          ctx.fillRect(0, h * 0.6, w, h * 0.4);
        }

        for (let i = 0; i < NUM_BINS; i++) {
          const amplitude = smoothBins.current[i];
          if (amplitude < 0.008) continue;

          const barH = amplitude * h * 0.85;
          const x = i * (barWidth + gap);
          const y = h - barH;

          const hue = (i / NUM_BINS) * 60 + 330;
          const sat = 80 + amplitude * 20;
          const light = 50 + amplitude * 25;
          const alpha = 0.7 + amplitude * 0.3;

          const grad = ctx.createLinearGradient(0, y, 0, h);
          grad.addColorStop(0, `hsla(${hue}, ${sat}%, ${light + 10}%, ${alpha})`);
          grad.addColorStop(1, `hsla(${hue}, ${sat - 10}%, ${light - 15}%, ${alpha * 0.7})`);
          ctx.fillStyle = grad;

          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + barWidth - radius, y);
          ctx.arcTo(x + barWidth, y, x + barWidth, y + radius, radius);
          ctx.lineTo(x + barWidth, h);
          ctx.lineTo(x, h);
          ctx.lineTo(x, y + radius);
          ctx.arcTo(x, y, x + radius, y, radius);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = `hsla(${hue}, ${sat + 10}%, ${light + 25}%, ${alpha * 0.5})`;
          ctx.beginPath();
          ctx.arc(x + barWidth / 2, y + radius, radius * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      } else if (visMode === "xp") {
        // Windows XP Segmented Equalizer style
        const numXPBars = 32;
        const gap = 3;
        const barWidth = (w - gap * (numXPBars - 1)) / numXPBars;
        
        const blockHeight = 4;
        const blockGap = 1.5;
        const totalBlockStep = blockHeight + blockGap;

        const gravity = 1.8; // Gravity for falling peaks
        const maxH = h * 0.9;

        for (let i = 0; i < numXPBars; i++) {
          // Merge two bins for a 32-bar display
          const binVal = Math.max(smoothBins.current[i * 2], smoothBins.current[i * 2 + 1]);
          const barH = binVal * maxH;

          const x = i * (barWidth + gap);
          const numBlocks = Math.floor(barH / totalBlockStep);

          // Draw stacked segments
          for (let j = 0; j < numBlocks; j++) {
            const blockY = h - (j * totalBlockStep) - blockHeight;
            const ratio = (j * totalBlockStep) / maxH;
            
            // Color segments: green -> yellow -> red
            if (ratio < 0.55) {
              ctx.fillStyle = "#33CC33"; // Windows XP Retro Green
            } else if (ratio < 0.82) {
              ctx.fillStyle = "#FFCC00"; // Retro Yellow/Orange
            } else {
              ctx.fillStyle = "#FF3300"; // Retro Red
            }

            ctx.fillRect(x, blockY, barWidth, blockHeight);
          }

          // Peak Falling cap
          let currentPeak = peaks.current[i] ?? 0;
          if (barH > currentPeak) {
            currentPeak = barH;
          } else {
            currentPeak = Math.max(0, currentPeak - gravity);
          }
          peaks.current[i] = currentPeak;

          if (currentPeak > 2) {
            const peakY = Math.min(h - 2, h - currentPeak);
            ctx.fillStyle = "#FFEB60"; // Soft glowing yellow peak cap
            ctx.fillRect(x, peakY, barWidth, 2);
          }
        }
      } else if (visMode === "oscilloscope") {
        // Retro oscilloscope waveform line
        ctx.strokeStyle = "rgba(0, 255, 136, 0.85)";
        ctx.shadowColor = "rgba(0, 255, 136, 0.8)";
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        const midY = h / 2;
        const resolution = Math.min(w, 200);

        for (let i = 0; i <= resolution; i++) {
          const ratio = i / resolution;
          const x = ratio * w;
          
          // Generate wave height by summing basic frequencies
          let waveOffset = 0;
          const limit = Math.min(NUM_BINS, 12);
          for (let j = 0; j < limit; j++) {
            const amp = smoothBins.current[j] ?? 0;
            // Modulate with overlapping sines
            waveOffset += Math.sin(ratio * Math.PI * (j + 1) * 3 + timestamp * 0.015) * amp * h * 0.16;
          }

          // Soften edges to fade into the boundaries
          const edgeDecline = Math.sin(ratio * Math.PI);
          const y = midY + waveOffset * edgeDecline;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // reset glow
      } else if (visMode === "circular") {
        // Circular spectrum
        const centerX = w / 2;
        const centerY = h / 2;
        
        // Base amplitude calculation to make the circle pulse
        const avgAmp = smoothBins.current.reduce((a, b) => a + b, 0) / NUM_BINS;
        const baseRadius = Math.min(w, h) * 0.18 + avgAmp * h * 0.12;

        ctx.strokeStyle = "rgba(94, 129, 172, 0.7)";
        ctx.fillStyle = "rgba(10, 10, 20, 0.4)";
        ctx.lineWidth = 2;
        
        // Inner circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const numRays = 48;
        for (let i = 0; i < numRays; i++) {
          const angle = (i / numRays) * Math.PI * 2;
          const binIndex = i % NUM_BINS;
          const amp = smoothBins.current[binIndex] * h * 0.45;

          const startX = centerX + Math.cos(angle) * baseRadius;
          const startY = centerY + Math.sin(angle) * baseRadius;
          const endX = centerX + Math.cos(angle) * (baseRadius + amp);
          const endY = centerY + Math.sin(angle) * (baseRadius + amp);

          const hue = (i / numRays) * 120 + 200; // Blue to Cyan gradient
          ctx.strokeStyle = `hsla(${hue}, 80%, 65%, 0.75)`;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
    };
  }, [visMode]);

  if (isAndroid) return <p>El visualizador de audio todavía no está disponible en Android.</p>;
  return (
    <div className="visualizer-container" style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        className="visualizer"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", cursor: "pointer" }}
        onClick={cycleMode}
        title="Click to change visualizer mode"
      />
      {modeIndicator.visible && (
        <div
          className="visualizer-indicator"
          style={{
            position: "absolute",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(20, 20, 30, 0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#E0E6ED",
            padding: "6px 14px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 600,
            pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            transition: "opacity 0.2s ease",
            zIndex: 10,
          }}
        >
          Visualizer: {modeIndicator.text}
        </div>
      )}
    </div>
  );
}
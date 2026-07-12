import { useRef, useEffect } from "react";

interface Props {
  playing: boolean;
}

export function Visualizer({ playing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let phase = 0;

    const draw = () => {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (!playing) {
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, w, h);
        frameRef.current = requestAnimationFrame(draw);
        return;
      }

      phase += 0.02;
      const barCount = 64;
      const barWidth = w / barCount;

      for (let i = 0; i < barCount; i++) {
        const amplitude = Math.sin(phase + i * 0.3) * 0.5 + 0.5;
        const height = amplitude * h * 0.8;
        const hue = (i / barCount) * 60 + 200;
        const lightness = 40 + amplitude * 20;

        const grad = ctx.createLinearGradient(0, h - height, 0, h);
        grad.addColorStop(0, `hsl(${hue}, 80%, ${lightness + 15}%)`);
        grad.addColorStop(1, `hsl(${hue}, 70%, ${lightness - 10}%)`);
        ctx.fillStyle = grad;

        const radius = Math.min(barWidth * 0.3, height * 0.2, 4);
        const x = i * barWidth + 1;
        const y = h - height;
        const bw = barWidth - 2;
        const bh = height;

        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + bw - radius, y);
        ctx.quadraticCurveTo(x + bw, y, x + bw, y + radius);
        ctx.lineTo(x + bw, y + bh);
        ctx.lineTo(x, y + bh);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
      }

      // Glow overlay at bottom
      const glowGrad = ctx.createLinearGradient(0, h * 0.7, 0, h);
      glowGrad.addColorStop(0, "rgba(74, 158, 255, 0)");
      glowGrad.addColorStop(1, `rgba(74, 158, 255, ${0.05 + Math.sin(phase * 2) * 0.03})`);
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, h * 0.7, w, h * 0.3);

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [playing]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={200}
      className="visualizer"
    />
  );
}

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

        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        ctx.fillRect(
          i * barWidth,
          h - height,
          barWidth - 1,
          height,
        );
      }

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

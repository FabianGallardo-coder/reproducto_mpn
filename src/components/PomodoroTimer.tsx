import { useState, useEffect, useCallback, useRef } from "react";

interface Props {
  onComplete?: () => void;
}

export function PomodoroTimer({ onComplete }: Props) {
  const WORK_MINUTES = 25;
  const BREAK_MINUTES = 5;

  const [seconds, setSeconds] = useState(WORK_MINUTES * 60);
  const [isWork, setIsWork] = useState(true);
  const [running, setRunning] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const reset = useCallback(() => {
    setSeconds(WORK_MINUTES * 60);
    setIsWork(true);
    setRunning(false);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (seconds === 0) {
      if (isWork) {
        setIsWork(false);
        setSeconds(BREAK_MINUTES * 60);
        onCompleteRef.current?.();
      } else {
        setIsWork(true);
        setSeconds(WORK_MINUTES * 60);
      }
    }
  }, [seconds, isWork]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="pomodoro">
      <div className="pomodoro__label">{isWork ? "Enfoque" : "Descanso"}</div>
      <div className="pomodoro__time">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </div>
      <div className="pomodoro__actions">
        <button onClick={() => setRunning(!running)} className="pomodoro__btn">
          {running ? "Pausar" : "Iniciar"}
        </button>
        <button onClick={reset} className="pomodoro__btn">Reiniciar</button>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";

interface Props {
  onComplete?: () => void;
}

export function PomodoroTimer({ onComplete }: Props) {
  const WORK_MINUTES = 25;
  const BREAK_MINUTES = 5;

  const [seconds, setSeconds] = useState(WORK_MINUTES * 60);
  const [isWork, setIsWork] = useState(true);
  const [running, setRunning] = useState(false);

  const reset = useCallback(() => {
    setSeconds(WORK_MINUTES * 60);
    setIsWork(true);
    setRunning(false);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(id);
          if (isWork) {
            setIsWork(false);
            setSeconds(BREAK_MINUTES * 60);
            onComplete?.();
          } else {
            setIsWork(true);
            setSeconds(WORK_MINUTES * 60);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, isWork, onComplete]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="pomodoro">
      <div className="pomodoro__label">{isWork ? "Work" : "Break"}</div>
      <div className="pomodoro__time">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </div>
      <div className="pomodoro__actions">
        <button onClick={() => setRunning(!running)} className="pomodoro__btn">
          {running ? "Pause" : "Start"}
        </button>
        <button onClick={reset} className="pomodoro__btn">Reset</button>
      </div>
    </div>
  );
}

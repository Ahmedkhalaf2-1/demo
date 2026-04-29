import { useState, useEffect } from 'react';

const TRIAL_DURATION_MINUTES = 15;
const TRIAL_DURATION_MS = TRIAL_DURATION_MINUTES * 60 * 1000;
const STORAGE_KEY = 'pharma_trial_start_time';

export function useTrialTimer() {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    // Get or set start time
    let startTimeStr = localStorage.getItem(STORAGE_KEY);
    let startTime: number;

    if (!startTimeStr) {
      startTime = Date.now();
      localStorage.setItem(STORAGE_KEY, startTime.toString());
    } else {
      startTime = parseInt(startTimeStr, 10);
    }

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const remaining = Math.max(0, TRIAL_DURATION_MS - elapsed);

      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        setIsExpired(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    timeLeft,
    isExpired,
    formattedTime: timeLeft !== null ? formatTime(timeLeft) : '--:--',
    progress: timeLeft !== null ? (timeLeft / TRIAL_DURATION_MS) * 100 : 100
  };
}

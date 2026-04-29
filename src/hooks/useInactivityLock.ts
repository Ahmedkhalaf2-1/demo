import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';

export function useInactivityLock() {
  const { isLocked, setLocked } = useAuthStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // Set 5 minutes inactivity timeout
    timerRef.current = setTimeout(() => {
      if (!useAuthStore.getState().isLocked) {
        setLocked(true);
      }
    }, 5 * 60 * 1000); // 5 minutes
  };

  useEffect(() => {
    // If the screen is already locked, clear existing timers and do nothing
    if (isLocked) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Define interaction listeners
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    // Initialize timer
    resetTimer();

    const handleInteraction = () => {
      resetTimer();
    };

    events.forEach(event => {
      window.addEventListener(event, handleInteraction);
    });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, handleInteraction);
      });
    };
  }, [isLocked]);
}

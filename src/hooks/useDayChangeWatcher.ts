import { useEffect, useRef } from 'react';
import { getLocalDateKey, isNewDay } from '../utils/time';
import { useSalesStore } from '../store/useSalesStore';
import { useInventoryStore } from '../store/useInventoryStore';

/**
 * useDayChangeWatcher
 *
 * Detects when the calendar day rolls over (midnight transition) and
 * automatically reloads store data so that:
 * - getTodaySales() immediately returns an empty set for the new day
 * - getDailySummary() chart builds correctly from the new day forward
 * - No stale "yesterday" data leaks into "today" views
 *
 * Implementation: polls every 60 seconds (not a tight loop) and compares
 * the stored dateKey against the current local dateKey.
 * At the exact transition a full store reload is triggered.
 */
export function useDayChangeWatcher() {
  const lastDateKey = useRef<string>(getLocalDateKey());

  useEffect(() => {
    const check = () => {
      const currentKey = getLocalDateKey();
      if (isNewDay(lastDateKey.current, currentKey)) {
        console.info(`[DayChange] Day rolled over from ${lastDateKey.current} → ${currentKey}. Reloading stores.`);
        lastDateKey.current = currentKey;
        // Reload all time-sensitive stores
        useSalesStore.getState().loadAll();
        useInventoryStore.getState().loadAll();
      }
    };

    // Check once a minute — low overhead, catches midnight within 60s
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);
}

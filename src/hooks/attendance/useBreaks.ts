import { useState, useEffect, useCallback } from 'react';
import { breakService, totalBreakMinutes, AttendanceBreak } from '../../services/break.service';
import { useToast } from '../../context/ToastContext';

/**
 * Breaks for the employee's open attendance session (dashboard Start / End Break).
 * Re-reads when the app returns to the foreground, and ticks every 30 s so the running
 * break's duration stays current.
 */
export const useBreaks = (attendanceId: string | undefined) => {
  const { showToast } = useToast();
  const [breaks, setBreaks] = useState<AttendanceBreak[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [now, setNow] = useState(new Date());

  const refresh = useCallback(async () => {
    if (!attendanceId) {
      setBreaks([]);
      return;
    }
    try {
      setBreaks(await breakService.getBreaks(attendanceId));
    } catch (e) {
      console.warn('[useBreaks] Load failed:', e);
    }
  }, [attendanceId]);

  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const openBreak = breaks.find(b => !b.endTime);

  useEffect(() => {
    if (!attendanceId) return;
    const timer = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(timer);
  }, [attendanceId]);

  const run = async (action: 'start' | 'end') => {
    if (!attendanceId || isBusy) return;
    setIsBusy(true);
    try {
      if (action === 'start') await breakService.startBreak(attendanceId);
      else await breakService.endBreak(attendanceId);
      setNow(new Date());
      await refresh();
    } catch (e: any) {
      showToast(e?.message || 'Could not update break. Please try again.', 'error');
      await refresh();
    } finally {
      setIsBusy(false);
    }
  };

  return {
    breaks,
    openBreak,
    totalMinutes: totalBreakMinutes(breaks, now),
    isBusy,
    startBreak: () => run('start'),
    endBreak: () => run('end'),
  };
};

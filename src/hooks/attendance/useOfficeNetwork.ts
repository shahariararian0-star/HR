import { useState, useEffect, useCallback, useRef } from 'react';
import { officeWifiService } from '../../services/officeWifi.service';

/**
 * Office Wi-Fi Check-in status for the attendance screen.
 *
 * Reads the org setting first; when the feature is OFF it never calls the edge function and
 * always reports allowed, so organizations that don't use it see no change. When ON it asks
 * office-network-status (sending current GPS, needed before any office IP is learned) on open,
 * when the app returns to the foreground, on online/offline changes, and every 60 seconds.
 *
 * A failed status call does not disable the button: the server re-checks every punch anyway,
 * so a flaky status request should not block someone who is actually in the office.
 */
const RECHECK_INTERVAL_MS = 60 * 1000;

export const useOfficeNetwork = (
  location: { lat: number; lng: number } | null,
  dutyType: 'OFFICE' | 'FACTORY',
) => {
  const [enabled, setEnabled] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const locationRef = useRef(location);
  const dutyTypeRef = useRef(dutyType);
  locationRef.current = location;
  dutyTypeRef.current = dutyType;

  const check = useCallback(async () => {
    setIsChecking(true);
    try {
      const on = await officeWifiService.isEnabled();
      setEnabled(on);
      if (!on) {
        setAllowed(true);
        return;
      }
      const loc = locationRef.current;
      const status = await officeWifiService.getStatus({
        gps: loc ? { lat: loc.lat, lng: loc.lng } : null,
        dutyType: dutyTypeRef.current,
      });
      setEnabled(status.enabled);
      setAllowed(status.allowed);
    } catch (e) {
      console.warn('[OfficeNetwork] Status check failed:', e);
      setAllowed(true);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Initial check, and again when the first GPS fix arrives or the duty type changes.
  const hasLocation = location !== null;
  useEffect(() => {
    check();
  }, [check, hasLocation, dutyType]);

  // Foreground, network changes, and a periodic re-check — only while the feature is ON.
  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', check);
    window.addEventListener('offline', check);
    const timer = setInterval(check, RECHECK_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', check);
      window.removeEventListener('offline', check);
      clearInterval(timer);
    };
  }, [enabled, check]);

  return { enabled, allowed, isChecking, check };
};

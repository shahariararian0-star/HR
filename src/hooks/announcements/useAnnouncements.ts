
import { useState, useEffect, useCallback, useMemo } from 'react';
import { hrService } from '../../services/hrService';
import { supabase } from '../../services/supabase';
import { Announcement, User } from '../../types';

export function useAnnouncements(user: User) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const data = await hrService.getAnnouncements();
      setAnnouncements(data);
    } catch (e) {
      console.error('[useAnnouncements] Fetch failed', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Subscribe for reactive updates
  useEffect(() => {
    const unsub = hrService.subscribe(() => {
      fetchAnnouncements();
    });
    return unsub;
  }, [fetchAnnouncements]);

  // Supabase real-time subscription — shows announcements posted by other users without a
  // page refresh. RLS limits events to the user's own organization (migration 0044).
  useEffect(() => {
    // Unique name per hook instance: the dashboard widget and the page can be mounted together.
    const channel = supabase
      .channel(`announcements-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'announcements' },
        () => fetchAnnouncements(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel as any).catch(() => {});
    };
  }, [fetchAnnouncements]);

  const visibleAnnouncements = useMemo(() => {
    const now = new Date();
    return announcements.filter(a => {
      // Filter expired
      if (a.expiresAt && new Date(a.expiresAt) < now) return false;
      // Filter by target roles (empty = everyone)
      if (a.targetRoles && a.targetRoles.length > 0 && !a.targetRoles.includes(user.role)) return false;
      return true;
    });
  }, [announcements, user.role]);

  return { announcements, visibleAnnouncements, isLoading, refresh: fetchAnnouncements };
}

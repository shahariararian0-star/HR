-- Migration 0044: Realtime for notifications and announcements
--
-- useNotifications and useAnnouncements subscribe to postgres_changes, but Supabase only
-- streams changes for tables in the supabase_realtime publication, and no migration ever
-- added them — so on a fresh project new notifications only appeared after a page refresh.
--
-- Realtime still applies each table's RLS to every subscriber: a user only receives
-- notification rows they can select (their own), and announcements of their organization.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'announcements'
  ) then
    alter publication supabase_realtime add table public.announcements;
  end if;
end $$;

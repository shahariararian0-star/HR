import { supabase, isSupabaseConfigured } from './supabase';

// Attendance breaks (migration 0045). Start / end go through the start_break / end_break RPCs,
// which use the server clock and only accept the caller's own open session. Checking out closes
// a running break automatically (database trigger).

export interface AttendanceBreak {
  id: string;
  attendanceId: string;
  employeeId: string;
  startTime: string;
  endTime?: string;
}

const mapBreak = (r: any): AttendanceBreak => ({
  id: r.id,
  attendanceId: r.attendance_id,
  employeeId: r.employee_id,
  startTime: r.start_time,
  endTime: r.end_time || undefined,
});

function friendlyError(error: any, fallback: string): Error {
  const message = String(error?.message || '');
  // RPC errors are "CODE: Human message" — show the human part.
  const match = message.match(/^[A-Z_]+: (.+)$/);
  return new Error(match ? match[1] : message || fallback);
}

/** Minutes spent on breaks; a running break counts up to `now`. */
export function totalBreakMinutes(breaks: AttendanceBreak[], now: Date = new Date()): number {
  const ms = breaks.reduce((sum, b) => {
    const start = new Date(b.startTime).getTime();
    const end = b.endTime ? new Date(b.endTime).getTime() : now.getTime();
    return sum + Math.max(0, end - start);
  }, 0);
  return Math.floor(ms / 60000);
}

export function formatBreakMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export const breakService = {
  async getBreaks(attendanceId: string): Promise<AttendanceBreak[]> {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await supabase
      .from('attendance_breaks')
      .select('*')
      .eq('attendance_id', attendanceId)
      .order('start_time', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapBreak);
  },

  /** All breaks of an employee on a date — attendance views merge a day's records into one row. */
  async getBreaksForDay(employeeId: string, date: string): Promise<AttendanceBreak[]> {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await supabase
      .from('attendance_breaks')
      .select('*, attendance!inner(date)')
      .eq('employee_id', employeeId)
      .eq('attendance.date', date)
      .order('start_time', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapBreak);
  },

  async startBreak(attendanceId: string): Promise<AttendanceBreak> {
    const { data, error } = await supabase.rpc('start_break', { p_attendance_id: attendanceId });
    if (error) throw friendlyError(error, 'Could not start break');
    return mapBreak(data);
  },

  async endBreak(attendanceId: string): Promise<AttendanceBreak> {
    const { data, error } = await supabase.rpc('end_break', { p_attendance_id: attendanceId });
    if (error) throw friendlyError(error, 'Could not end break');
    return mapBreak(data);
  },
};

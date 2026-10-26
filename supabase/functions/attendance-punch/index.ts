// StaffCove — Attendance Punch Edge Function (Office Wi-Fi Check-in)
// Requires a signed-in caller (JWT verified by the gateway).
//
// The app sends clock in / out here instead of writing the attendance table directly whenever
// its organization has Office Wi-Fi Check-in ON. The office network check runs on the request's
// real source IP (never one from the body); the write uses the service role, which the
// attendance guard trigger (migration 0043) lets through.
//
// POST { action: 'clock_in', record: { date, checkIn, status, remarks, location: { lat, lng, address }, dutyType, employeeName } }
//   checkIn is the ISO timestamp the app already computes. Returns { id, networkCheck }.
// POST { action: 'clock_out', attendanceId, checkOut, remarks, gps: { lat, lng } }
//   Only the caller's own open record. Returns { id }.
// 403 { error: 'OFFICE_WIFI_REQUIRED', message } when the network check fails.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { evaluateOfficeNetwork, recordOfficeNetwork, parseGps } from '../_shared/officeWifi.ts';
import { OFFICE_WIFI_REQUIRED_MESSAGE } from '../_shared/officeNetwork.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'EARLY_OUT', 'HALF_DAY'];
const DUTY_TYPES = ['OFFICE', 'FACTORY'];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const wifiRequired = () => json(403, { error: 'OFFICE_WIFI_REQUIRED', message: OFFICE_WIFI_REQUIRED_MESSAGE });

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'Missing Authorization header' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: { user: caller }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !caller) return json(401, { error: 'Invalid token' });

  const { data: profile } = await admin
    .from('profiles')
    .select('role, organization_id, name')
    .eq('id', caller.id)
    .single();
  if (!profile?.organization_id) return json(403, { error: 'Profile or organization not found' });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  try {
    if (body.action === 'clock_in') {
      const record = body.record ?? {};
      if (!isIsoTimestamp(record.checkIn) || typeof record.date !== 'string') {
        return json(400, { error: 'Missing date or check-in time' });
      }
      const dutyType = DUTY_TYPES.includes(record.dutyType) ? record.dutyType : 'OFFICE';
      const status = ATTENDANCE_STATUSES.includes(record.status) ? record.status : 'PRESENT';
      const gps = parseGps(record.location);

      const { decision, clientIp } = await evaluateOfficeNetwork(admin, req, {
        orgId: profile.organization_id, role: profile.role, dutyType, gps,
      });
      if (!decision.allowed) return wifiRequired();

      // Same columns the app writes today (attendance.service buildAttendancePayload),
      // with identity taken from the token rather than the body.
      const { data: created, error } = await admin
        .from('attendance')
        .insert({
          employee_id: caller.id,
          employee_name: record.employeeName || profile.name || '',
          date: record.date,
          check_in: record.checkIn,
          status,
          remarks: typeof record.remarks === 'string' ? record.remarks : '',
          location: record.location?.address || '',
          latitude: gps?.lat ?? 0,
          longitude: gps?.lng ?? 0,
          duty_type: dutyType,
          organization_id: profile.organization_id,
          network_check: decision.networkCheck,
          client_ip: clientIp,
        })
        .select('id')
        .single();
      if (error || !created) throw new Error(error?.message || 'Could not save check-in');

      await recordOfficeNetwork(admin, profile.organization_id, decision, caller.id);
      return json(200, { id: created.id, networkCheck: decision.networkCheck });
    }

    if (body.action === 'clock_out') {
      if (!isIsoTimestamp(body.checkOut)) return json(400, { error: 'Missing check-out time' });

      const { data: row } = await admin
        .from('attendance')
        .select('id, employee_id, duty_type, check_out')
        .eq('id', body.attendanceId)
        .maybeSingle();
      if (!row || row.employee_id !== caller.id) return json(404, { error: 'Attendance record not found' });
      if (row.check_out) return json(409, { error: 'Already checked out' });

      const { decision } = await evaluateOfficeNetwork(admin, req, {
        orgId: profile.organization_id, role: profile.role, dutyType: row.duty_type, gps: parseGps(body.gps),
      });
      if (!decision.allowed) return wifiRequired();

      const updates: Record<string, unknown> = { check_out: body.checkOut };
      if (typeof body.remarks === 'string') updates.remarks = body.remarks;
      const { error } = await admin.from('attendance').update(updates).eq('id', row.id);
      if (error) throw new Error(error.message);

      await recordOfficeNetwork(admin, profile.organization_id, decision, caller.id);
      return json(200, { id: row.id });
    }

    return json(400, { error: 'Unknown action' });
  } catch (e: any) {
    console.error('[attendance-punch]', e?.message || e);
    return json(500, { error: e?.message || 'Attendance punch failed' });
  }
});

import { createServerFn } from '@tanstack/react-start'

import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export type LeadNotification = {
  message_id: string | null
  status: string
  error_message: string | null
  created_at: string
  lead_id: string | null
  lead_email: string | null
}

/**
 * Returns the latest new-lead notification entry per email, so the CRM can
 * show whether each lead's alert was queued, sent, or failed. email_send_log
 * is service-role only, so we read it with the admin client after confirming
 * the caller is an authenticated team member.
 */
export const getLeadNotifications = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<LeadNotification[]> => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data, error } = await supabaseAdmin
      .from('email_send_log')
      .select('message_id, status, error_message, created_at, metadata')
      .eq('template_name', 'new-lead-notification')
      .order('created_at', { ascending: false })
      .limit(2000)

    if (error) throw error

    // Deduplicate: keep the latest row per message_id (one email = many rows).
    const seen = new Set<string>()
    const result: LeadNotification[] = []
    for (const row of data ?? []) {
      const key = row.message_id ?? row.created_at
      if (seen.has(key)) continue
      seen.add(key)
      const meta = (row.metadata ?? {}) as Record<string, unknown>
      result.push({
        message_id: row.message_id,
        status: row.status,
        error_message: row.error_message,
        created_at: row.created_at,
        lead_id: typeof meta.lead_id === 'string' ? meta.lead_id : null,
        lead_email: typeof meta.lead_email === 'string' ? meta.lead_email : null,
      })
    }
    return result
  })

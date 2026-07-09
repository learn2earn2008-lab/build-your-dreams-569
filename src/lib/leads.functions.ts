import { createServerFn } from '@tanstack/react-start'

import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export type LeadNotificationError = {
  message?: string
  status?: number | string
  code?: string
  retry_after_seconds?: number
  body?: string
  response?: string
}

export type LeadNotification = {
  message_id: string | null
  status: string
  error_message: string | null
  error_detail: LeadNotificationError | null
  created_at: string
  lead_id: string | null
  lead_email: string | null
}

/**
 * Returns the latest new-lead notification per email so the CRM can show
 * whether each lead's alert was queued, sent, or failed. A single email
 * produces several rows (pending, then sent/failed/dlq) sharing a message_id;
 * lead correlation lives on the pending row's metadata while the structured
 * error payload lives on the failure row's metadata, so we merge across rows.
 * email_send_log is service-role only, so we read it with the admin client
 * after confirming the caller is an authenticated team member.
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

    // Rows arrive newest-first. Group by message_id, keeping the latest status
    // while backfilling lead info and error payload from whichever row has it.
    const byMessage = new Map<string, LeadNotification>()
    const order: string[] = []

    for (const row of data ?? []) {
      const key = row.message_id ?? row.created_at
      const meta = (row.metadata ?? {}) as Record<string, unknown>
      const leadId = typeof meta.lead_id === 'string' ? meta.lead_id : null
      const leadEmail = typeof meta.lead_email === 'string' ? meta.lead_email : null
      const errorDetail =
        meta.error && typeof meta.error === 'object'
          ? (meta.error as LeadNotificationError)
          : null

      const existing = byMessage.get(key)
      if (!existing) {
        order.push(key)
        byMessage.set(key, {
          message_id: row.message_id,
          status: row.status,
          error_message: row.error_message,
          error_detail: errorDetail,
          created_at: row.created_at,
          lead_id: leadId,
          lead_email: leadEmail,
        })
        continue
      }
      // Latest row already set status/created_at; backfill missing fields.
      if (!existing.lead_id && leadId) existing.lead_id = leadId
      if (!existing.lead_email && leadEmail) existing.lead_email = leadEmail
      if (!existing.error_message && row.error_message)
        existing.error_message = row.error_message
      if (!existing.error_detail && errorDetail) existing.error_detail = errorDetail
    }

    return order.map((k) => byMessage.get(k)!)
  })

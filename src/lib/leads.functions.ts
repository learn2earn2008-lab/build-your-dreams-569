import { createServerFn } from '@tanstack/react-start'

import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export type RetryResult = { success: boolean; reason?: string }
export type BulkRetryResult = {
  requeued: number
  suppressed: number
  failed: number
  notFound: number
}


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

/**
 * Re-queues the new-lead notification for a single lead after a failed or
 * suppressed send. Runs as an authenticated team member; reads the lead with
 * the admin client (leads/email_send_log are service-role only) and dispatches
 * a fresh send with a unique idempotency key so the queue treats it as new.
 */
export const retryLeadNotification = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { leadId: string }) => data)
  .handler(async ({ data }): Promise<RetryResult> => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { dispatchTransactionalEmail } = await import('@/lib/email/dispatch.server')
    const { siteConfig } = await import('@/lib/site-config')

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .select('id, name, email, phone, source')
      .eq('id', data.leadId)
      .maybeSingle()

    if (error) throw error
    if (!lead) return { success: false, reason: 'lead_not_found' }

    const result = await dispatchTransactionalEmail(supabaseAdmin, {
      templateName: 'new-lead-notification',
      recipientEmail: siteConfig.leadNotificationEmail,
      idempotencyKey: `new-lead-retry-${lead.email.toLowerCase()}-${Date.now()}`,
      metadata: {
        lead_id: lead.id,
        lead_email: lead.email,
        lead_name: lead.name,
        source: lead.source,
        retried: true,
      },
      templateData: {
        name: lead.name,
        email: lead.email,
        phone: lead.phone || undefined,
        source: lead.source,
        submittedAt: new Date().toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      },
    })

    return { success: result.success, reason: result.reason }
  })

/**
 * Bulk variant of retryLeadNotification: re-queues the new-lead notification
 * for many leads at once (used by the CRM bulk "Retry failed" action). Reads
 * the leads with the admin client after confirming the caller is an
 * authenticated team member, then dispatches each with a unique idempotency
 * key. Suppressed recipients are counted separately since sending is refused.
 */
export const retryLeadNotifications = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { leadIds: string[] }) => data)
  .handler(async ({ data }): Promise<BulkRetryResult> => {
    const ids = Array.from(new Set(data.leadIds)).filter(Boolean).slice(0, 200)
    const result: BulkRetryResult = {
      requeued: 0,
      suppressed: 0,
      failed: 0,
      notFound: 0,
    }
    if (ids.length === 0) return result

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { dispatchTransactionalEmail } = await import('@/lib/email/dispatch.server')
    const { siteConfig } = await import('@/lib/site-config')

    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('id, name, email, phone, source')
      .in('id', ids)

    if (error) throw error

    const found = new Map((leads ?? []).map((l) => [l.id, l]))
    result.notFound = ids.filter((id) => !found.has(id)).length

    for (const lead of leads ?? []) {
      try {
        const r = await dispatchTransactionalEmail(supabaseAdmin, {
          templateName: 'new-lead-notification',
          recipientEmail: siteConfig.leadNotificationEmail,
          idempotencyKey: `new-lead-retry-${lead.email.toLowerCase()}-${Date.now()}-${lead.id}`,
          metadata: {
            lead_id: lead.id,
            lead_email: lead.email,
            lead_name: lead.name,
            source: lead.source,
            retried: true,
          },
          templateData: {
            name: lead.name,
            email: lead.email,
            phone: lead.phone || undefined,
            source: lead.source,
            submittedAt: new Date().toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
          },
        })
        if (r.success) result.requeued++
        else if (r.reason === 'email_suppressed') result.suppressed++
        else result.failed++
      } catch {
        result.failed++
      }
    }

    return result
  })

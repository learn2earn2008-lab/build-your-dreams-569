import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { siteConfig } from '@/lib/site-config'

const leadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  source: z.string().trim().max(100).optional(),
})

export const Route = createFileRoute('/api/public/leads')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          console.error('Missing Supabase server configuration')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        let parsed
        try {
          parsed = leadSchema.parse(await request.json())
        } catch {
          return Response.json({ error: 'Invalid submission' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, serviceKey)
        const source = parsed.source || 'landing_page'

        const { data: inserted, error: insertError } = await supabase
          .from('leads')
          .insert({
            name: parsed.name,
            email: parsed.email,
            phone: parsed.phone || null,
            source,
          })
          .select('id')
          .single()

        if (insertError) {
          console.error('Failed to insert lead', { error: insertError })
          return Response.json({ error: 'Failed to save your details' }, { status: 500 })
        }

        // Fire the owner notification. Never fail the submission if the email
        // step has trouble — the lead is already safely recorded.
        try {
          const { dispatchTransactionalEmail } = await import('@/lib/email/dispatch.server')
          const result = await dispatchTransactionalEmail(supabase, {
            templateName: 'new-lead-notification',
            recipientEmail: siteConfig.leadNotificationEmail,
            idempotencyKey: `new-lead-${parsed.email.toLowerCase()}-${Date.now()}`,
            metadata: {
              lead_id: inserted.id,
              lead_email: parsed.email,
              lead_name: parsed.name,
              source,
            },
            templateData: {
              name: parsed.name,
              email: parsed.email,
              phone: parsed.phone || undefined,
              source,
              submittedAt: new Date().toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            },
          })
          if (!result.success) {
            console.warn('Lead saved but notification not sent', { reason: result.reason })
          }
        } catch (err) {
          console.error('Lead notification dispatch threw', { error: err })
        }


        return Response.json({ success: true })
      },
    },
  },
})

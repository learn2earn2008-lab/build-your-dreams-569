import * as React from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

const SITE_NAME = 'Freedom Legacy Elevation Group'
// Verified sender subdomain FQDN delegated to Lovable's nameservers.
const SENDER_DOMAIN = 'notify.freedomlegacyelevationframework.com'
// Domain shown in the From: header (cosmetic).
const FROM_DOMAIN = 'freedomlegacyelevationframework.com'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface DispatchResult {
  success: boolean
  reason?: string
}

/**
 * Server-only helper that renders a registered template and enqueues it for
 * delivery using a service-role Supabase client. Used by public action routes
 * (e.g. the lead-capture form) that cannot present a user JWT to the main
 * authenticated /lovable/email/transactional/send route.
 */
export async function dispatchTransactionalEmail(
  supabase: SupabaseClient,
  params: {
    templateName: string
    recipientEmail: string
    idempotencyKey?: string
    templateData?: Record<string, any>
    metadata?: Record<string, any>
  },
): Promise<DispatchResult> {
  const { templateName, recipientEmail } = params
  const templateData = params.templateData ?? {}
  const metadata = params.metadata ?? null
  const messageId = crypto.randomUUID()
  const idempotencyKey = params.idempotencyKey ?? messageId

  const { TEMPLATES } = await import('@/lib/email-templates/registry')
  const template = TEMPLATES[templateName]
  if (!template) {
    console.error('Template not found in registry', { templateName })
    return { success: false, reason: 'template_not_found' }
  }

  const effectiveRecipient = template.to || recipientEmail
  if (!effectiveRecipient) {
    return { success: false, reason: 'recipient_required' }
  }
  const normalizedEmail = effectiveRecipient.toLowerCase()

  // Suppression check (fail-closed)
  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (suppressionError) {
    console.error('Suppression check failed — refusing to send', { error: suppressionError })
    return { success: false, reason: 'suppression_check_failed' }
  }
  if (suppressed) {
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
      metadata,
    })
    return { success: false, reason: 'email_suppressed' }
  }

  // Get or create unsubscribe token (one per email)
  let unsubscribeToken: string
  const { data: existingToken } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    unsubscribeToken = generateToken()
    await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true },
      )
    const { data: storedToken } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()
    if (!storedToken) {
      return { success: false, reason: 'token_error' }
    }
    unsubscribeToken = storedToken.token
  } else {
    return { success: false, reason: 'email_suppressed' }
  }

  // Render
  const { render } = await import('@react-email/render')
  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const plainText = await render(element, { plainText: true })
  const resolvedSubject =
    typeof template.subject === 'function' ? template.subject(templateData) : template.subject

  // Log pending before enqueue
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: 'pending',
    metadata,
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue email', { error: enqueueError, templateName })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
      metadata,
    })
    return { success: false, reason: 'enqueue_failed' }
  }

  return { success: true }
}

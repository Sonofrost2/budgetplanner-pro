import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0'

// Twilio posts application/x-www-form-urlencoded with fields including:
// MessageSid, MessageStatus (queued|sent|delivered|failed|undelivered),
// ErrorCode, ErrorMessage. We update the matching sms_send_logs row.
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  try {
    const form = await req.formData()
    const sid = String(form.get('MessageSid') || form.get('SmsSid') || '')
    const status = String(form.get('MessageStatus') || form.get('SmsStatus') || '').toLowerCase()
    const errorCode = form.get('ErrorCode') ? String(form.get('ErrorCode')) : null
    const errorMessage = form.get('ErrorMessage') ? String(form.get('ErrorMessage')) : null

    if (!sid || !status) {
      return new Response('Bad request', { status: 400 })
    }

    const adminDb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const now = new Date().toISOString()
    const update: Record<string, unknown> = {
      status,
      last_status_at: now,
    }
    if (status === 'queued') update.status_queued_at = now
    if (status === 'sent') update.status_sent_at = now
    if (status === 'delivered') update.status_delivered_at = now
    if (status === 'failed') {
      update.status_failed_at = now
      if (errorCode) update.error_code = errorCode
      if (errorMessage) update.error_message = errorMessage
    }
    if (status === 'undelivered') {
      update.status_undelivered_at = now
      if (errorCode) update.error_code = errorCode
      if (errorMessage) update.error_message = errorMessage
    }

    const { error } = await adminDb
      .from('sms_send_logs')
      .update(update)
      .eq('twilio_sid', sid)

    if (error) {
      console.error('twilio-status-webhook update error:', error.message)
      return new Response('Update failed', { status: 500 })
    }
    return new Response('ok', { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('twilio-status-webhook error:', message)
    return new Response('error', { status: 500 })
  }
})
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { to, body, template_id } = await req.json()
    if (!to || !body) {
      return new Response(JSON.stringify({ error: 'Missing "to" or "body"' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Service-role client used solely for writing to the audit log table
    const adminDb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!
    // Prefer branded Alphanumeric Sender ID ("BudgetPlanner-Pro") so recipients
    // never see the raw Twilio number. Falls back to the long-code if not set.
    // Note: Alphanumeric sender IDs are 1-way only (no replies) and require
    // destination-country support (CI/+225 OK, US/CA NOT supported).
    const senderId = Deno.env.get('TWILIO_SMS_SENDER_ID')?.trim()
    const fromNumber = senderId && senderId.length > 0
      ? senderId
      : Deno.env.get('TWILIO_PHONE_NUMBER')!

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    // Public webhook URL for delivery status callbacks
    const statusCallbackUrl = `${Deno.env.get('SUPABASE_URL')!}/functions/v1/twilio-status-webhook`

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: body,
        StatusCallback: statusCallbackUrl,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Twilio error:', data)
      await adminDb.from('sms_send_logs').insert({
        sent_by: user.id,
        recipient: to,
        template_id: template_id ?? null,
        body,
        twilio_sid: null,
        status: 'failed',
        error_message: data.message ?? 'Twilio error',
        error_code: data.code ? String(data.code) : null,
      })
      return new Response(JSON.stringify({ error: data.message || 'Twilio error', code: data.code }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await adminDb.from('sms_send_logs').insert({
      sent_by: user.id,
      recipient: to,
      template_id: template_id ?? null,
      body,
      twilio_sid: data.sid ?? null,
      status: data.status ?? 'sent',
      status_queued_at: new Date().toISOString(),
      last_status_at: new Date().toISOString(),
    })

    return new Response(JSON.stringify({ success: true, sid: data.sid }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('send-sms error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

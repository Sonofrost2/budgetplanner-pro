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

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { to, body, template_id } = await req.json()
    if (!to || !body) {
      return new Response(JSON.stringify({ error: 'Missing "to" or "body"' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminDb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!
    // WhatsApp requires a number explicitly enabled for WhatsApp (sandbox or approved sender),
    // which is generally NOT the same as TWILIO_PHONE_NUMBER (SMS-only).
    const whatsappFromRaw = Deno.env.get('TWILIO_WHATSAPP_FROM') || Deno.env.get('TWILIO_PHONE_NUMBER')
    if (!whatsappFromRaw) {
      return new Response(JSON.stringify({ error: 'TWILIO_WHATSAPP_FROM not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    // WhatsApp uses whatsapp: prefix on both From and To numbers
    const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
    const whatsappFrom = whatsappFromRaw.startsWith('whatsapp:') ? whatsappFromRaw : `whatsapp:${whatsappFromRaw}`

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: whatsappTo,
        From: whatsappFrom,
        Body: body,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Twilio WhatsApp error:', data)
      await adminDb.from('sms_send_logs').insert({
        sent_by: user.id, recipient: to, template_id: template_id ?? null,
        body, twilio_sid: null, status: 'failed', channel: 'whatsapp',
        error_message: data.message ?? 'Twilio error',
        error_code: data.code ? String(data.code) : null,
      })
      return new Response(JSON.stringify({ error: data.message || 'Twilio error', code: data.code }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await adminDb.from('sms_send_logs').insert({
      sent_by: user.id, recipient: to, template_id: template_id ?? null,
      body, twilio_sid: data.sid ?? null, status: data.status ?? 'sent',
      channel: 'whatsapp',
      status_queued_at: new Date().toISOString(),
      last_status_at: new Date().toISOString(),
    })

    return new Response(JSON.stringify({ success: true, sid: data.sid }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('send-whatsapp error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

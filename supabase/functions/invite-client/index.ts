import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SITE_URL = 'https://box-flow-eight.vercel.app'

// Gmail API helper
async function getGmailAccessToken(): Promise<string> {
  const clientId = Deno.env.get('GMAIL_CLIENT_ID')!
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET')!
  const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN')!

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = await resp.json()
  if (!data.access_token) {
    throw new Error(`Gmail token refresh failed: ${JSON.stringify(data)}`)
  }
  return data.access_token
}

async function sendGmail(to: string, subject: string, htmlBody: string) {
  const accessToken = await getGmailAccessToken()

  const rawMessage = [
    `From: BoxFlow <boxflow58@gmail.com>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    htmlBody,
  ].join('\r\n')

  // Base64url encode
  const encoder = new TextEncoder()
  const bytes = encoder.encode(rawMessage)
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64 }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Gmail send failed: ${resp.status} ${err}`)
  }

  return await resp.json()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const logs: string[] = []
  const log = (msg: string) => { console.log(msg); logs.push(msg) }

  try {
    const { email, trainer_id } = await req.json()
    log(`[invite] Request: email=${email}, trainer_id=${trainer_id}`)

    if (!email || !trainer_id) {
      return new Response(
        JSON.stringify({ error: 'email and trainer_id are required', logs }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Store pending invite
    const { error: pendingErr } = await supabaseAdmin.from('pending_invites').insert(
      { email: email.toLowerCase(), trainer_id }
    )
    log(`[invite] pending_invites insert: ${pendingErr ? 'SKIPPED: ' + pendingErr.message : 'OK'}`)

    // Get trainer name for the email
    const { data: trainerData } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', trainer_id)
      .single()
    const trainerName = trainerData?.full_name || 'Your trainer'

    // Generate signup/login link with email
    const encodedEmail = encodeURIComponent(email.toLowerCase())
    const signupLink = `${SITE_URL}/login?invited_by=${trainer_id}&email=${encodedEmail}`

    // Send invite email via Gmail API
    const subject = `${trainerName} invited you to BoxFlow`
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #6366f1;">You're Invited to BoxFlow! 💪</h2>
        <p><strong>${trainerName}</strong> has invited you to join BoxFlow as their client.</p>
        <p>Click the button below to get started:</p>
        <a href="${signupLink}" 
           style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; 
                  border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Join BoxFlow
        </a>
        <p style="color: #666; font-size: 14px;">Or copy this link: ${signupLink}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">BoxFlow — Fitness Coaching Platform</p>
      </div>
    `

    log('[invite] Sending email via Gmail API...')
    await sendGmail(email.toLowerCase(), subject, htmlBody)
    log('[invite] Gmail send OK')

    return new Response(
      JSON.stringify({ success: true, type: 'gmail_invite', logs }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    log(`[invite] EXCEPTION: ${String(err)}`)
    return new Response(
      JSON.stringify({ error: String(err), logs }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

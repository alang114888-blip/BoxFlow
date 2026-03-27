import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SITE_URL = 'https://box-flow-eight.vercel.app'

async function getGmailAccessToken(): Promise<string> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GMAIL_CLIENT_ID')!,
      client_secret: Deno.env.get('GMAIL_CLIENT_SECRET')!,
      refresh_token: Deno.env.get('GMAIL_REFRESH_TOKEN')!,
      grant_type: 'refresh_token',
    }),
  })
  const data = await resp.json()
  if (!data.access_token) throw new Error('Gmail token refresh failed')
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

  const encoder = new TextEncoder()
  const bytes = encoder.encode(rawMessage)
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: base64 }),
  })
  if (!resp.ok) throw new Error(`Gmail send failed: ${resp.status}`)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email } = await req.json()
    if (!email) {
      return new Response(JSON.stringify({ error: 'email required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email.toLowerCase(),
      options: { redirectTo: `${SITE_URL}/reset-password` },
    })

    if (linkErr) throw linkErr

    const resetLink = data?.properties?.action_link
    if (!resetLink) throw new Error('Failed to generate reset link')

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #7c3bed;">Reset Your Password</h2>
        <p>You requested a password reset for your BoxFlow account.</p>
        <p>Click the button below to set a new password:</p>
        <a href="${resetLink}"
           style="display: inline-block; background: #7c3bed; color: white; padding: 12px 24px;
                  border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this, ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">BoxFlow — Fitness Coaching Platform</p>
      </div>
    `

    await sendGmail(email.toLowerCase(), 'Reset your BoxFlow password', htmlBody)

    return new Response(JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SITE_URL = 'https://box-flow-eight.vercel.app'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const logs: string[] = []
  const log = (msg: string) => { console.log(msg); logs.push(msg) }

  try {
    const { email, trainer_id } = await req.json()
    log(`[invite] Request: email=${email}, trainer_id=${trainer_id}`)
    log(`[invite] SUPABASE_URL exists: ${!!Deno.env.get('SUPABASE_URL')}`)
    log(`[invite] SERVICE_ROLE_KEY exists: ${!!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`)

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

    // Store pending invite (insert, ignore duplicates)
    const { error: pendingErr } = await supabaseAdmin.from('pending_invites').insert(
      { email: email.toLowerCase(), trainer_id }
    )
    log(`[invite] pending_invites insert: ${pendingErr ? 'SKIPPED: ' + pendingErr.message : 'OK'}`)

    // Try invite (new user) first
    log('[invite] Trying inviteUserByEmail...')
    const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.toLowerCase(),
      {
        redirectTo: `${SITE_URL}/onboarding`,
        data: { role: 'client', invited_by_trainer: trainer_id },
      }
    )
    log(`[invite] inviteUserByEmail result: ${inviteErr ? 'FAILED: ' + inviteErr.message : 'OK, user=' + inviteData?.user?.id}`)

    if (inviteErr) {
      // User already exists → send magic link OTP
      log('[invite] Trying signInWithOtp fallback...')
      const { error: otpErr } = await supabaseAdmin.auth.signInWithOtp({
        email: email.toLowerCase(),
        options: {
          emailRedirectTo: `${SITE_URL}/onboarding`,
          data: { role: 'client', invited_by_trainer: trainer_id },
          shouldCreateUser: false,
        },
      })
      log(`[invite] signInWithOtp result: ${otpErr ? 'FAILED: ' + otpErr.message : 'OK'}`)

      if (otpErr) {
        // Last resort: try with shouldCreateUser: true
        log('[invite] Trying signInWithOtp with shouldCreateUser=true...')
        const { error: otp2Err } = await supabaseAdmin.auth.signInWithOtp({
          email: email.toLowerCase(),
          options: {
            emailRedirectTo: `${SITE_URL}/onboarding`,
            data: { role: 'client', invited_by_trainer: trainer_id },
            shouldCreateUser: true,
          },
        })
        log(`[invite] signInWithOtp(create) result: ${otp2Err ? 'FAILED: ' + otp2Err.message : 'OK'}`)

        if (otp2Err) {
          // Log error to error_logs table
          try {
            await supabaseAdmin.from('error_logs').insert({
              action: 'invite_client',
              error_message: `All methods failed. invite: ${inviteErr.message}, otp: ${otpErr.message}, otp2: ${otp2Err.message}`,
              error_details: { email, trainer_id, logs },
            })
          } catch (_) { /* ignore logging errors */ }

          return new Response(
            JSON.stringify({ error: otp2Err.message, logs }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      return new Response(
        JSON.stringify({ success: true, type: 'existing_user', logs }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    log('[invite] Success: new user invited')
    return new Response(
      JSON.stringify({ success: true, type: 'new_user', logs }),
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

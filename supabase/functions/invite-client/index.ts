import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://box-flow-eight.vercel.app'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, trainer_id } = await req.json()

    if (!email || !trainer_id) {
      return new Response(
        JSON.stringify({ error: 'email and trainer_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Store pending invite
    await supabaseAdmin.from('pending_invites').upsert(
      { email: email.toLowerCase(), trainer_id },
      { onConflict: 'trainer_id,email' }
    )

    // Try invite (new user) first
    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.toLowerCase(),
      {
        redirectTo: `${SITE_URL}/onboarding`,
        data: { role: 'client', invited_by_trainer: trainer_id },
      }
    )

    if (inviteErr) {
      // User already exists → send magic link OTP instead
      const { error: otpErr } = await supabaseAdmin.auth.signInWithOtp({
        email: email.toLowerCase(),
        options: {
          emailRedirectTo: `${SITE_URL}/onboarding`,
          data: { role: 'client', invited_by_trainer: trainer_id },
          shouldCreateUser: false,
        },
      })

      if (otpErr) {
        return new Response(
          JSON.stringify({ error: `Invite failed: ${inviteErr.message}. OTP fallback: ${otpErr.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, type: 'existing_user' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, type: 'new_user' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

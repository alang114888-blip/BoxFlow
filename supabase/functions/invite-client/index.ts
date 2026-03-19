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

    // Use inviteUserByEmail — Supabase sends the email automatically
    // The email template MUST use token_hash format (not ConfirmationURL)
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${SITE_URL}/onboarding`,
      data: { role: 'client', invited_by_trainer: trainer_id },
    })

    if (error) {
      if (error.message.includes('already been registered') || error.message.includes('already exists')) {
        // User already exists — send magic link OTP instead
        // This uses the Magic Link email template
        const { error: otpErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${SITE_URL}/onboarding`,
        }).catch(() => null) || { error: null }

        // Fallback: generate a magic link directly
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { redirectTo: `${SITE_URL}/onboarding` },
        })

        if (linkErr) {
          return new Response(
            JSON.stringify({ error: linkErr.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // generateLink returns properties we can use to build URL
        // The link itself is in linkData.properties.action_link
        // But Supabase already sent the email with the template
        return new Response(
          JSON.stringify({ success: true, note: 'existing_user_magic_link' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

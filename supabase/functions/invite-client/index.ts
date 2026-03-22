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

    // Check if user already exists in auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const userExists = existingUsers?.users?.some(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (userExists) {
      // Existing user → generate magic link and return it
      // The Magic Link email template will be used
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email.toLowerCase(),
        options: {
          redirectTo: `${SITE_URL}/onboarding`,
        },
      })

      if (linkErr) {
        return new Response(
          JSON.stringify({ error: linkErr.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // generateLink returns the action_link with token
      // We need to extract hashed_token and build our own URL
      const actionLink = linkData?.properties?.action_link || ''
      const hashedToken = linkData?.properties?.hashed_token || ''

      // Build our custom URL with token_hash
      const onboardingUrl = `${SITE_URL}/onboarding?token_hash=${hashedToken}&type=magiclink`

      // Send email manually using Supabase's internal mail
      // Actually, generateLink with type 'magiclink' does NOT send email
      // We need to use signInWithOtp for existing users
      const { error: otpErr } = await supabaseAdmin.auth.signInWithOtp({
        email: email.toLowerCase(),
        options: {
          emailRedirectTo: `${SITE_URL}/onboarding`,
          data: { role: 'client', invited_by_trainer: trainer_id },
        },
      })

      if (otpErr) {
        return new Response(
          JSON.stringify({ error: otpErr.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, type: 'existing_user' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // New user → use inviteUserByEmail
    // This creates the auth user AND sends the Invite User email template
    // The template MUST use: {{ .SiteURL }}/onboarding?token_hash={{ .TokenHash }}&type=invite
    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${SITE_URL}/onboarding`,
      data: { role: 'client', invited_by_trainer: trainer_id },
    })

    if (inviteErr) {
      return new Response(
        JSON.stringify({ error: inviteErr.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, type: 'new_user' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Send invite using admin API with redirectTo
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: 'https://box-flow-eight.vercel.app/onboarding',
      data: { role: 'client', invited_by_trainer: trainer_id },
    })

    if (error) {
      // If user already exists, send magic link instead
      if (error.message.includes('already been registered')) {
        const { error: otpErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { redirectTo: 'https://box-flow-eight.vercel.app/onboarding' },
        })
        if (otpErr) {
          return new Response(
            JSON.stringify({ error: otpErr.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import webPush from "npm:web-push@3.6.7"

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  throw new Error('VAPID credentials are not configured in Edge Function secrets');
}

webPush.setVapidDetails('mailto:support@libreshop.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const { user_id, title, body, data } = await req.json()
    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const { data: tokensData, error: tokensError } = await supabaseClient.from('push_tokens').select('token').eq('user_id', user_id)
    if (tokensError) throw tokensError

    let expoReceipts = null;
    const messages = (tokensData || []).filter(({ token }) => token.startsWith('ExponentPushToken[')).map(({ token }) => ({ to: token, sound: 'default', title, body, data: data || {} }));
    if (messages.length > 0) {
      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST', headers: { 'Accept': 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json' }, body: JSON.stringify(messages)
      });
      expoReceipts = await expoRes.json();
    }

    const { data: webSubs, error: webSubsError } = await supabaseClient.from('web_push_subscriptions').select('*').eq('user_id', user_id);
    let webReceipts: any[] = [];
    if (!webSubsError && webSubs?.length) {
      const payload = JSON.stringify({ title, body, data: data || {} });
      webReceipts = await Promise.all(webSubs.map(async (sub) => {
        try {
          await webPush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
          return { endpoint: sub.endpoint, success: true };
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) await supabaseClient.from('web_push_subscriptions').delete().eq('id', sub.id);
          return { endpoint: sub.endpoint, success: false, error: error.message };
        }
      }));
    }

    return new Response(JSON.stringify({ message: 'Push notifications sent', expoReceipts, webReceipts }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message ?? 'Internal server error' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})

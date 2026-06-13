import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import webPush from "npm:web-push@3.6.7"

const VAPID_PUBLIC_KEY = 'BACkyGyicWJ1RoTJbHQsKTfLxTiLvl95OmPFQA9gue65hLQkELvND-OBuMgCo57srhUvoLgbnpUsqPJVvn79_XI';
const VAPID_PRIVATE_KEY = 'TYDHxyn8HCKoBTy6_9wjVItBJG34J8qaUoa7ZE-VkHQ';

webPush.setVapidDetails(
  'mailto:support@libreshop.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id, title, body, data } = await req.json()

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch tokens for user
    const { data: tokensData, error: tokensError } = await supabaseClient
      .from('push_tokens')
      .select('token')
      .eq('user_id', user_id)

    if (tokensError) {
      throw tokensError
    }

    if (!tokensData || tokensData.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No push tokens found for user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Prepare Expo push messages
    let expoReceipts = null;
    const messages = []
    for (const tokenObj of tokensData || []) {
      if (!tokenObj.token.startsWith('ExponentPushToken[')) {
        continue;
      }
      messages.push({
        to: tokenObj.token,
        sound: 'default',
        title: title,
        body: body,
        data: data || {},
      })
    }

    if (messages.length > 0) {
      // Send to Expo Push API
      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      expoReceipts = await expoRes.json();
    }

    // --- 2. WEB PUSH NOTIFICATIONS ---
    const { data: webSubs, error: webSubsError } = await supabaseClient
      .from('web_push_subscriptions')
      .select('*')
      .eq('user_id', user_id);

    let webReceipts: any[] = [];
    if (!webSubsError && webSubs && webSubs.length > 0) {
      const payload = JSON.stringify({
        title,
        body,
        data: data || {}
      });

      const promises = webSubs.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };
        try {
          await webPush.sendNotification(pushSubscription, payload);
          return { endpoint: sub.endpoint, success: true };
        } catch (error: any) {
          console.error('Web Push Error for endpoint:', sub.endpoint, error);
          if (error.statusCode === 410 || error.statusCode === 404) {
            // L'abonnement a expiré ou n'est plus valide, on le supprime
            await supabaseClient.from('web_push_subscriptions').delete().eq('id', sub.id);
          }
          return { endpoint: sub.endpoint, success: false, error: error.message };
        }
      });

      webReceipts = await Promise.all(promises);
    }

    if (messages.length === 0 && webReceipts.length === 0) {
       return new Response(
        JSON.stringify({ message: 'No valid push tokens found for user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({ message: 'Push notifications sent', expoReceipts, webReceipts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

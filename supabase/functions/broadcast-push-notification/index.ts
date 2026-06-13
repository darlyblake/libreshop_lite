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
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { role, title, body, data, type } = await req.json()

    if (!role || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 1. Fetch users with role
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('id')
      .eq('role', role)

    if (usersError) throw usersError

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No users found for this role' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 2. Prepare notifications to insert into DB
    const notificationsToInsert = users.map(u => ({
      user_id: u.id,
      title: title,
      body: body,
      type: type || 'admin',
      data: data || {},
      read: false,
    }))

    // 3. Bulk insert into notifications table
    const { error: insertError } = await supabaseClient
      .from('notifications')
      .insert(notificationsToInsert)

    if (insertError) throw insertError

    // 4. Fetch push tokens for these users
    const userIds = users.map(u => u.id)
    const { data: tokensData, error: tokensError } = await supabaseClient
      .from('push_tokens')
      .select('user_id, token')
      .in('user_id', userIds)

    if (tokensError) throw tokensError

    let receipts = null

    if (tokensData && tokensData.length > 0) {
      // 5. Send Push via Expo
      const messages = tokensData
        .filter(t => t.token.startsWith('ExponentPushToken['))
        .map(t => ({
          to: t.token,
          sound: 'default',
          title: title,
          body: body,
          data: data || {},
        }))

      if (messages.length > 0) {
        // Expo limit is 100 per request, so chunk it if necessary
        const CHUNK_SIZE = 100;
        const allReceipts = [];
        
        for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
          const chunk = messages.slice(i, i + CHUNK_SIZE);
          const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(chunk),
          })
          const expoReceipts = await expoRes.json()
          allReceipts.push(expoReceipts)
        }
        receipts = allReceipts
      }
    }

    // 6. Fetch and send Web Push
    let webReceipts: any[] = [];
    const { data: webSubs, error: webSubsError } = await supabaseClient
      .from('web_push_subscriptions')
      .select('*')
      .in('user_id', userIds);

    if (!webSubsError && webSubs && webSubs.length > 0) {
      const payload = JSON.stringify({
        title,
        body,
        data: data || {}
      });

      // To avoid overwhelming the service or V8 isolates, chunk the promises
      const CHUNK_SIZE = 50;
      for (let i = 0; i < webSubs.length; i += CHUNK_SIZE) {
        const chunk = webSubs.slice(i, i + CHUNK_SIZE);
        const promises = chunk.map(async (sub) => {
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
            if (error.statusCode === 410 || error.statusCode === 404) {
              await supabaseClient.from('web_push_subscriptions').delete().eq('id', sub.id);
            }
            return { endpoint: sub.endpoint, success: false, error: error.message };
          }
        });
        
        const chunkReceipts = await Promise.all(promises);
        webReceipts.push(...chunkReceipts);
      }
    }

    return new Response(
      JSON.stringify({ message: 'Broadcast successful', receipts, webReceipts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

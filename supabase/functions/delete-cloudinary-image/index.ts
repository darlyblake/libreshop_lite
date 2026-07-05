import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { publicIds } = await req.json();

    if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing or invalid publicIds array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary credentials are not configured in environment variables');
    }

    const results = [];

    // Cloudinary Admin API for deleting resources
    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/destroy`;
    
    // Authorization header (Basic auth with API Key and Secret)
    const auth = btoa(`${apiKey}:${apiSecret}`);

    for (const publicId of publicIds) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`
        },
        body: JSON.stringify({ public_ids: [publicId] })
      });

      const data = await response.json();
      results.push({ publicId, data });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

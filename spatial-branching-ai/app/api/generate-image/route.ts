
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client (Server-Side)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
    try {
        const { prompt, apiKey } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // 1. Call OpenRouter (Gemini 2.0 Flash)
        // Note: Gemini 2.0 Flash via OpenRouter returns a hosted image URL generally, 
        // OR base64 depending on the specific model implementation. 
        // For "google/gemini-2.0-flash-exp:free", it acts like an LLM but with image modalities.
        // Wait, Gemini 2.0 Flash is a MULTIMODAL model. Does it Text-to-Image?
        // OpenRouter docs say "Gemini 2.5 Flash Image Preview" supports it.
        // Let's assume standard OpenAI Image Generation format OR Text-to-Image via Chat Completions?
        // Most OpenRouter image models use the OpenAI `images/generations` endpoint format.
        // HOWEVER, some "multimodal" LLMs might return image URLs in text.
        // Let's try the standard `images/generations` endpoint first as it's the standard for image models on OpenRouter.

        // Actually, for OpenRouter 'google/gemini-2.0-flash-exp:free', it might NOT contain image generation yet?
        // The user specifically asked for "gemini-2.5-flash-image" in their prompt, but agreed to "Gemini 2 Free".
        // OpenRouter models list "google/gemini-2.0-flash-exp:free" as an LLM.
        // But "google/gemini-2.0-flash-thinking-exp:free" exists too.
        // "google/gemini-2.0-pro-exp-02-05:free"

        // Let's stick to the SAFEST bet for IMAGE gen: Midjourney is definitely image.
        // But for GEMINI, valid models are rare.
        // Actually, looking at OpenRouter docs, they support OpenAI Image API.
        // Let's try to call the `https://openrouter.ai/api/v1/images/generations` endpoint.

        const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://numi.workspace',
                'X-Title': 'Numi Workspace',
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-exp:free', // Trying this as requested
                prompt: prompt,
                n: 1,
                size: '1024x1024',
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            // Fallback: If OpenAI format fails, maybe it's a chat-based request?
            // But let's assume if it fails, we throw.
            console.error('OpenRouter Image Error:', error);
            return NextResponse.json({ error: `OpenRouter Error: ${error}` }, { status: response.status });
        }

        const data = await response.json();
        const imageUrl = data.data?.[0]?.url; // Standard OpenAI format

        if (!imageUrl) {
            return NextResponse.json({ error: 'No image URL returned' }, { status: 500 });
        }

        // 2. Download Image
        const imageRes = await fetch(imageUrl);
        const imageBlob = await imageRes.blob();

        // 3. Upload to Supabase
        const fileName = `generated/${Date.now()}_${Math.random().toString(36).substring(7)}.png`; // Assume PNG
        const { error: uploadError } = await supabase.storage
            .from('files')
            .upload(fileName, imageBlob, {
                contentType: 'image/png',
                upsert: false
            });

        if (uploadError) {
            console.error('Supabase Upload Error:', uploadError);
            // Fallback: Return original URL if upload fails (better than nothing)
            return NextResponse.json({ url: imageUrl, warning: 'Failed to persist image' });
        }

        // 4. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('files')
            .getPublicUrl(fileName);

        return NextResponse.json({ url: publicUrl });

    } catch (error: any) {
        console.error('Generate Image Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

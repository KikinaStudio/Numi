import { NextResponse } from 'next/server';

// export const runtime = 'edge'; // Disabled to support large Base64 responses

export async function POST(req: Request) {
    try {
        const body = await req.json();
        let { prompt, apiKey, model } = body;

        // Fallback to server-side env key if not provided by client
        if (!apiKey) {
            apiKey = process.env.OPENROUTER_API_KEY;
        }

        if (!apiKey) {
            return NextResponse.json({ error: 'OpenRouter API key is missing. Set it in Settings or Environment.' }, { status: 401 });
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://numi.app',
                'X-Title': 'Numi',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model || 'black-forest-labs/flux.2-klein-4b',
                messages: [
                    { role: 'user', content: prompt }
                ],
                // OpenRouter specific: indicate we expect an image back
                modalities: ["image", "text"],
            }),
        });

        const rawText = await response.text();
        console.log('[Image API] Response Status:', response.status);
        console.log('[Image API] Raw Body Length:', rawText.length);
        console.log('[Image API] Raw Body Start:', rawText.substring(0, 500));

        if (!response.ok) {
            return NextResponse.json({ error: `Provider Error (${response.status}): ${rawText.substring(0, 200)}` }, { status: response.status });
        }

        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            console.error('[Image API] JSON Parse Failed');
            return NextResponse.json({ error: 'Failed to parse provider response' }, { status: 500 });
        }

        const message = data.choices?.[0]?.message;
        if (!message) {
            return NextResponse.json({ error: 'No message in response' }, { status: 500 });
        }

        // OpenRouter Flux returns image in several possible non-standard fields:
        // 1. message.content (Standard)
        // 2. message.url (Direct)
        // 3. message.image_url.url
        // 4. message.images[0].image_url.url
        const url = message.content ||
            message.url ||
            message.image_url?.url ||
            message.images?.[0]?.image_url?.url ||
            message.images?.[0]?.url;

        if (!url) {
            console.error('[Image API] Missing Image Data. Keys:', Object.keys(message));
            return NextResponse.json({ error: 'No image content returned from provider' }, { status: 500 });
        }

        // If it's markdown, extract it. If it's raw base64/url, use it.
        const markdownMatch = typeof url === 'string' ? url.match(/\!\[.*?\]\((.*?)\)/) : null;
        const finalUrl = markdownMatch ? markdownMatch[1] : url;

        // Return in OpenAI Image format for frontend compatibility
        return NextResponse.json({
            data: [{ url: finalUrl }]
        });

    } catch (error: any) {
        console.error('[Image API Exception]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

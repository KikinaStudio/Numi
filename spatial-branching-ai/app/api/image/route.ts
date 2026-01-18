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

        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            console.error('[Image API] Missing content. Full structure keys:', Object.keys(data));
            if (data.choices?.[0]) {
                console.error('[Image API] Choice keys:', Object.keys(data.choices[0]));
                console.error('[Image API] Message keys:', Object.keys(data.choices[0].message || {}));
            }
            return NextResponse.json({ error: 'No content returned from provider' }, { status: 500 });
        }

        // Extract URL from markdown format if present: ![desc](url)
        // Note: If content IS the base64 url, match will check it but fail, falling back to usage as url.
        const markdownMatch = content.match(/\!\[.*?\]\((.*?)\)/);
        const url = markdownMatch ? markdownMatch[1] : content;

        // Return in OpenAI Image format for frontend compatibility
        return NextResponse.json({
            data: [{ url: url }]
        });

    } catch (error: any) {
        console.error('[Image API Exception]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

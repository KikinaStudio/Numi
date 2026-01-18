
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
    try {
        const { prompt, apiKey, model } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://numi.app', // Required by OpenRouter
                'X-Title': 'Numi', // Required by OpenRouter
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model || 'black-forest-labs/flux.2-klein-4b',
                prompt: prompt,
                // Flux models on OpenRouter typically support standard OpenAI image params
                // But some free providers might return a URL directly or b64.
                // We'll request 1 image.
                n: 1,
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('[Image API Error]', text);
            return NextResponse.json({ error: `Provider Error: ${text}` }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('[Image API Exception]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

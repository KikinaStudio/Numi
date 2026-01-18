
import { NextResponse } from 'next/server';

export const runtime = 'edge';

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

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // OpenRouter uses the CHAT endpoint for images with Flux
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

        if (!response.ok) {
            const text = await response.text();
            console.error('[Image API Error]', text);
            return NextResponse.json({ error: `Provider Error: ${text}` }, { status: response.status });
        }

        const data = await response.json();
        console.log('[Image API Response]', JSON.stringify(data, null, 2));
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            return NextResponse.json({ error: 'No content returned from provider' }, { status: 500 });
        }

        // Extract URL from markdown format if present: ![desc](url)
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

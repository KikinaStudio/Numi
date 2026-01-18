import { NextResponse } from 'next/server';
import OpenAI from 'openai';

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

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const openai = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: apiKey,
            defaultHeaders: {
                'HTTP-Referer': 'https://numi.app',
                'X-Title': 'Numi',
            }
        });

        const completion = await openai.chat.completions.create({
            model: model || 'black-forest-labs/flux.2-klein-4b',
            messages: [
                { role: 'user', content: prompt }
            ],
            // Ensure no max_tokens limit cuts off the base64
        });

        const content = completion.choices[0]?.message?.content;

        if (!content) {
            console.error('Available keys:', Object.keys(completion.choices[0]?.message || {}));
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

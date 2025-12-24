import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'edge';

// Message type for OpenRouter API
interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// Request body type
interface ChatRequestBody {
    messages: Message[];
    model?: string;
    apiKey?: string;
    provider?: string;
    stream?: boolean;
    temperature?: number;
    maxTokens?: number;
}

export async function POST(request: NextRequest) {
    try {
        const body: ChatRequestBody = await request.json();
        const { messages, model = 'openai/gpt-4o-mini', stream = true, temperature = 0.7, maxTokens, provider } = body;

        // Validate messages
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: 'Messages array is required and must not be empty' },
                { status: 400 }
            );
        }

        // Get API key from body or environment
        // Logic: 
        // 1. Check body (User's custom key) -> 2. Check env (Server default)
        // Note: For 'openai' provider, we need an OpenAI key. For 'openrouter', we need OpenRouter key.
        let apiKey = body.apiKey;

        // If no custom key provided, fall back to server default (OpenRouter)
        if (!apiKey) {
            apiKey = process.env.OPENROUTER_API_KEY;
        }

        if (!apiKey) {
            // If we are trying to use OpenAI direct but no key, error out
            if (provider === 'openai') {
                return NextResponse.json(
                    { error: 'OpenAI API key required. Please set it in Settings.' },
                    { status: 401 }
                );
            }
            // For OpenRouter fallback
            return NextResponse.json(
                { error: 'OpenRouter API key not configured. Please set OPENROUTER_API_KEY in environment or Settings.' },
                { status: 500 }
            );
        }

        // Determine Base URL and Model Name
        let baseURL = 'https://openrouter.ai/api/v1';
        let effectiveModel = model;
        const defaultHeaders: Record<string, string> = {
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
            'X-Title': 'Spatial Branching AI',
        };

        if (provider === 'openai') {
            baseURL = 'https://api.openai.com/v1';
            // OpenAI expects 'gpt-4o', not 'openai/gpt-4o'
            effectiveModel = model.replace('openai/', '');
            // Remove OpenRouter specific headers to avoid confusion (optional but good practice)
            delete defaultHeaders['HTTP-Referer'];
            delete defaultHeaders['X-Title'];
        }

        // Create OpenAI client
        const openai = new OpenAI({
            baseURL,
            apiKey,
            defaultHeaders,
        });

        if (stream) {
            // Streaming response
            const streamResponse = await openai.chat.completions.create({
                model: effectiveModel,
                messages,
                temperature,
                max_tokens: maxTokens,
                stream: true,
            });

            // Convert to ReadableStream for SSE
            const encoder = new TextEncoder();
            const readableStream = new ReadableStream({
                async start(controller) {
                    try {
                        for await (const chunk of streamResponse) {
                            const content = chunk.choices[0]?.delta?.content || '';
                            if (content) {
                                // SSE format
                                const data = `data: ${JSON.stringify({ content })}\n\n`;
                                controller.enqueue(encoder.encode(data));
                            }
                        }
                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                        controller.close();
                    } catch (error) {
                        controller.error(error);
                    }
                },
            });

            return new Response(readableStream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        } else {
            // Non-streaming response
            const completion = await openai.chat.completions.create({
                model,
                messages,
                temperature,
                max_tokens: maxTokens,
            });

            return NextResponse.json({
                content: completion.choices[0]?.message?.content || '',
                usage: completion.usage,
                model: completion.model,
            });
        }
    } catch (error: any) {
        console.error('Chat API error:', error);

        // Handle specific OpenAI/OpenRouter errors
        if (error?.status === 401) {
            return NextResponse.json(
                { error: 'Invalid API key' },
                { status: 401 }
            );
        }

        if (error?.status === 429) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: error?.message || 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

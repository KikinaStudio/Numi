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
    stream?: boolean;
    temperature?: number;
    maxTokens?: number;
}

export async function POST(request: NextRequest) {
    try {
        const body: ChatRequestBody = await request.json();
        const { messages, model = 'openai/gpt-4o-mini', stream = true, temperature = 0.7, maxTokens } = body;

        // Validate messages
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: 'Messages array is required and must not be empty' },
                { status: 400 }
            );
        }

        // Get API key from environment
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'OpenRouter API key not configured. Please set OPENROUTER_API_KEY in your environment.' },
                { status: 500 }
            );
        }

        // Create OpenAI client configured for OpenRouter
        const openai = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey,
            defaultHeaders: {
                'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
                'X-Title': 'Spatial Branching AI',
            },
        });

        if (stream) {
            // Streaming response
            const streamResponse = await openai.chat.completions.create({
                model,
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

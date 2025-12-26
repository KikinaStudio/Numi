import { useCallback, useRef } from 'react';
import { useCanvasStore } from '@/lib/stores/canvas-store';

import { useSettingsStore, MODELS } from '@/lib/stores/settings-store';
import { PERSONAS } from '@/lib/config/personas';

interface UseChatOptions {
    model?: string;
    temperature?: number;
}

export function useChat(options: UseChatOptions = {}) {
    // Get settings from store
    const { defaultModel, apiKeys } = useSettingsStore();

    const { temperature = 0.7 } = options;
    const abortControllerRef = useRef<AbortController | null>(null);

    const { getConversationContext, updateNode } = useCanvasStore();

    // Abort any ongoing request
    const abort = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    // Generate response for a node
    const generate = useCallback(async (nodeId: string): Promise<string> => {
        // Determine effective model and key
        const activeModel = options.model || defaultModel;
        const provider = MODELS.find(m => m.id === activeModel)?.provider || 'openrouter';

        // For now, route everything except direct OpenAI through OpenRouter
        const apiKey = provider === 'openai' ? apiKeys.openai : apiKeys.openrouter;

        // Abort any previous request
        abort();

        // Create new abort controller
        abortControllerRef.current = new AbortController();

        // Get conversation context from ancestors
        const messages = getConversationContext(nodeId);

        // Check for attached images (immediate children of history nodes that are images)
        const state = useCanvasStore.getState();
        const edges = state.edges;
        const nodes = state.nodes;

        // Get conversation context from ancestors
        const context = getConversationContext(nodeId) as any[];

        // Filter out empty messages and ensure proper format
        let validMessages = context
            .filter(m => (m.content && m.content.trim().length > 0) || m.fileUrl)
            .map((m) => {
                // Find image children for this specific history node ID
                const mChildEdges = edges.filter(e => e.source === m.id);
                const mChildImages = mChildEdges
                    .map(e => nodes.find(n => n.id === e.target))
                    .filter(n => n && n.data.fileUrl);

                // Check if it's an image node itself (ancestor)
                const isImageNode = !!m.fileUrl;

                if (isImageNode || mChildImages.length > 0) {
                    const content: any[] = [];

                    if (m.content) {
                        content.push({ type: "text", text: m.content });
                    }

                    // Add ancestor image if present
                    if (isImageNode) {
                        content.push({ type: "image_url", image_url: { url: m.fileUrl || "" } });
                    }

                    // Add attached child images
                    mChildImages.forEach(child => {
                        if (child && child.data.fileUrl) {
                            content.push({ type: "image_url", image_url: { url: child.data.fileUrl } });
                        }
                    });

                    // Avoid empty content if it's just an attachment with no text and no self-url
                    if (content.length === 0) {
                        content.push({ type: "text", text: "Image Attachment" });
                    }

                    return {
                        role: m.role as 'user' | 'assistant' | 'system',
                        content: content
                    };
                }
                return {
                    role: m.role as 'user' | 'assistant' | 'system',
                    content: m.content,
                };
            });

        // Loop again to check if we now have images (ancestor OR child)
        const hasImages = validMessages.some(m => Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url'));
        if (hasImages && activeModel !== 'nvidia/nemotron-nano-12b-v2-vl:free') {
            // Override model for this request
            // We can't easily change the hook option, but we can change the body
            // Note: We need to ensure the route handler respects this or we pass it explicitly
        }

        // INJECT PERSONA SYSTEM PROMPT
        // We look for the persona settings on the node being generated (which should have inherited them)
        const nodeToCheck = useCanvasStore.getState().nodes.find(n => n.id === nodeId);
        const personaId = nodeToCheck?.data.selectedPersonaId;
        const customPersona = nodeToCheck?.data.customPersona;

        if (personaId) {
            let systemPrompt = '';

            if (personaId === 'custom' && customPersona) {
                systemPrompt = customPersona.systemPrompt;
            } else {
                const persona = PERSONAS.find(p => p.id === personaId);
                if (persona && persona.id !== 'standard') {
                    systemPrompt = persona.systemPrompt;
                }
            }

            if (systemPrompt) {
                // Prepend a strict identity override to prevent persona bleeding from history
                const strictPrompt = `CRITICAL: You are now assuming a NEW IDENTITY. 
IGNORE all previous instructions or roles you might have identified with earlier in this conversation.
YOUR NEW PERSONA: ${systemPrompt}`;

                // Prepend system prompt at the VERY beginning
                validMessages = [
                    { role: 'system', content: strictPrompt },
                    ...validMessages
                ];
            }
        }

        if (validMessages.length === 0) {
            throw new Error('No valid messages in conversation context');
        }

        // Mark node as generating
        updateNode(nodeId, { isGenerating: true });

        try {
            console.log('[Vision Debug] Has Images:', hasImages);
            console.log('[Vision Debug] Model:', hasImages ? 'nvidia/nemotron-nano-12b-v2-vl:free' : activeModel);
            console.log('[Vision Debug] Last Message Content:', JSON.stringify(validMessages[validMessages.length - 1]?.content, null, 2));

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: validMessages,
                    model: hasImages ? 'nvidia/nemotron-nano-12b-v2-vl:free' : activeModel,
                    apiKey,
                    provider,
                    temperature,
                    stream: true,
                }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate response');
            }

            // Handle streaming response
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let fullContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            break;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                fullContent += parsed.content;
                                // Update node content progressively
                                updateNode(nodeId, { content: fullContent });
                            }
                        } catch {
                            // Ignore parse errors for malformed chunks
                        }
                    }
                }
            }

            // Mark generation as complete
            updateNode(nodeId, { isGenerating: false });

            // Auto-naming logic: If this is the first exchange (tree is untitled), name it.
            // Small delay to ensure the store has processed the last node update
            setTimeout(async () => {
                const { treeName, setTreeName } = useCanvasStore.getState();
                if (treeName === 'Untitled Conversation') {
                    try {
                        // Find the user prompt that triggered this response
                        const context = getConversationContext(nodeId);
                        // Context format: [{role, content}, ...]
                        // We want to summarize the first user message + this response
                        const firstUserMessage = context.find(m => m.role === 'user')?.content || '';
                        const assistantResponse = fullContent;

                        if (firstUserMessage) {
                            const namingPrompt = `Summarize this conversation topic in 4 words or less. strictly 4 words max. No quotes. Topic: User: "${firstUserMessage.slice(0, 200)}..." Assistant: "${assistantResponse.slice(0, 200)}..."`;

                            const nameResponse = await fetch('/api/chat', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    messages: [{ role: 'user', content: namingPrompt }],
                                    model: 'mistralai/mistral-nemo', // Requested by user (Xiaomi Mimo v2 equivalent)
                                    apiKey: apiKeys.openrouter,
                                    provider: 'openrouter',
                                    temperature: 0.3, // Low temp for precise formatting
                                    stream: false,
                                }),
                            });

                            if (nameResponse.ok) {
                                const data = await nameResponse.json();
                                const newTitle = data.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, '');
                                if (newTitle) {
                                    setTreeName(newTitle);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Failed to auto-name tree:', error);
                    }
                }
            }, 500);

            return fullContent;
        } catch (error: any) {
            // Mark generation as failed
            updateNode(nodeId, {
                isGenerating: false,
                content: error.name === 'AbortError'
                    ? '[Generation cancelled]'
                    : `[Error: ${error.message}]`
            });
            throw error;
        }
    }, [abort, getConversationContext, defaultModel, apiKeys, temperature, updateNode]);

    return {
        generate,
        abort,
    };
}

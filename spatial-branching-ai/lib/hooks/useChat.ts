import { useCallback, useRef } from 'react';
import { useCanvasStore } from '@/lib/stores/canvas-store';

import { useSettingsStore, MODELS } from '@/lib/stores/settings-store';
import { PERSONAS } from '@/lib/config/personas';

// Helper for Audio B64
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

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
        // Limit total images to avoid 400 Bad Request (Max 10 images)
        const MAX_IMAGES = 10;
        let imageCount = 0;
        const seenImages = new Set<string>();

        // Filter out empty messages and ensure proper format
        let validMessages = (await Promise.all(context
            .reverse() // Process from newest to oldest to prioritize recent images
            .map(async (m) => {
                // Find image/audio/video children for deep branching context
                const mChildEdges = edges.filter(e => e.source === m.id);
                const mChildFiles = mChildEdges
                    .map(e => nodes.find(n => n.id === e.target))
                    .filter(n => n && (n.data.fileUrl || n.data.pdfPages || n.data.videoFrames));

                const content: any[] = [];
                let hasVisualContent = false;
                let hasAudioContent = false;
                let hasVideoContent = false;

                // 1. Add Attached Children Files
                for (const child of mChildFiles) {
                    if (!child) continue;

                    const isAudio = child.data.mimeType?.startsWith('audio/');

                    // Handle PDF Pages
                    if (child.data.pdfPages && child.data.pdfPages.length > 0) {
                        child.data.pdfPages.forEach(pageUrl => {
                            if (imageCount < MAX_IMAGES && !seenImages.has(pageUrl)) {
                                content.push({ type: "image_url", image_url: { url: pageUrl } });
                                seenImages.add(pageUrl);
                                imageCount++;
                                hasVisualContent = true;
                            }
                        });
                    }
                    // Handle Video Frames (Vision)
                    else if (child.data.videoFrames && child.data.videoFrames.length > 0) {
                        content.push({ type: "text", text: "CONTEXT: The following images are keyframes extracted from the video. Please treat them as the video's visual content." });
                        child.data.videoFrames.forEach(frameUrl => {
                            if (imageCount < MAX_IMAGES && !seenImages.has(frameUrl)) {
                                content.push({ type: "image_url", image_url: { url: frameUrl } });
                                seenImages.add(frameUrl);
                                imageCount++;
                                hasVideoContent = true;
                            }
                        });
                    }
                    // Handle Single Files
                    else if (child.data.fileUrl) {
                        if (isAudio) {
                            try {
                                const response = await fetch(child.data.fileUrl);
                                const blob = await response.blob();
                                const b64 = await blobToBase64(blob);
                                // Default to mp3 if unknown, assuming Voxtral handles standard formats
                                const format = child.data.mimeType?.split('/')[1] || 'mp3';
                                content.push({
                                    type: "input_audio",
                                    input_audio: {
                                        data: b64,
                                        format: format === 'mpeg' ? 'mp3' : format
                                    }
                                });
                                hasAudioContent = true;
                            } catch (e) {
                                console.error('Audio fetch failed', e);
                                content.push({ type: "text", text: `[Audio Context (Failed to load): ${child.data.fileUrl}]` });
                            }
                        } else if (child.data.mimeType?.startsWith('video/')) {
                            content.push({ type: "text", text: `[Video Input: ${child.data.fileUrl}]` });
                            hasVideoContent = true;
                        } else if (imageCount < MAX_IMAGES && !seenImages.has(child.data.fileUrl)) {
                            content.push({ type: "image_url", image_url: { url: child.data.fileUrl } });
                            seenImages.add(child.data.fileUrl);
                            imageCount++;
                            hasVisualContent = true;
                        }
                    }
                }

                // 2. Add Node's Own File (Ancestor)
                if (m.fileUrl || m.pdfPages || m.videoFrames) {
                    const isAudio = m.mimeType?.startsWith('audio/');
                    const isVideo = m.mimeType?.startsWith('video/');

                    if (m.pdfPages && m.pdfPages.length > 0) {
                        m.pdfPages.forEach((pageUrl: string) => {
                            if (imageCount < MAX_IMAGES && !seenImages.has(pageUrl)) {
                                content.push({ type: "image_url", image_url: { url: pageUrl } });
                                seenImages.add(pageUrl);
                                imageCount++;
                                hasVisualContent = true;
                            }
                        });
                    } else if (m.videoFrames && m.videoFrames.length > 0) {
                        content.push({ type: "text", text: "CONTEXT: The following images are keyframes extracted from the video. Please treat them as the video's visual content." });
                        m.videoFrames.forEach((frameUrl: string) => {
                            if (imageCount < MAX_IMAGES && !seenImages.has(frameUrl)) {
                                content.push({ type: "image_url", image_url: { url: frameUrl } });
                                seenImages.add(frameUrl);
                                imageCount++;
                                hasVideoContent = true;
                            }
                        });
                    } else if (m.fileUrl) {
                        if (isAudio) {
                            try {
                                const response = await fetch(m.fileUrl);
                                const blob = await response.blob();
                                const b64 = await blobToBase64(blob);
                                const format = m.mimeType?.split('/')[1] || 'mp3';
                                content.push({
                                    type: "input_audio",
                                    input_audio: {
                                        data: b64,
                                        format: format === 'mpeg' ? 'mp3' : format
                                    }
                                });
                                hasAudioContent = true;
                            } catch (e) {
                                content.push({ type: "text", text: `[Audio Context (Failed to load): ${m.fileUrl}]` });
                            }
                        } else if (isVideo) {
                            content.push({ type: "text", text: `[Video Input: ${m.fileUrl}]` });
                            hasVideoContent = true;
                        } else if (imageCount < MAX_IMAGES && !seenImages.has(m.fileUrl)) {
                            content.push({ type: "image_url", image_url: { url: m.fileUrl } });
                            seenImages.add(m.fileUrl);
                            imageCount++;
                            hasVisualContent = true;
                        }
                    }
                }

                // 3. Add Text content always
                if (m.content) {
                    content.push({ type: "text", text: m.content });
                } else if ((hasVisualContent || hasAudioContent || hasVideoContent) && content.length > 0) {
                    content.push({ type: "text", text: "Media Attachment" });
                }

                // If no content, return null to filter
                if (content.length === 0) return null;

                const textParts = content.filter(c => c.type === 'text');
                const imageParts = content.filter(c => c.type === 'image_url');
                const audioParts = content.filter(c => c.type === 'input_audio'); // Keep audio distinct

                // Combine: Text -> Audio -> Images
                const finalContent = [...textParts, ...audioParts, ...imageParts];

                return {
                    role: m.role as 'user' | 'assistant' | 'system',
                    content: finalContent
                };
            })))
            .filter(m => m !== null)
            .reverse(); // Restore chronological

        // Loop again to check if we now have specific media types
        const hasImages = validMessages.some(m => Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url'));
        // Check for our text-based markers
        const hasAudio = validMessages.some(m => Array.isArray(m.content) && m.content.some((c: any) => c.type === 'input_audio'));
        const hasVideo = validMessages.some(m => Array.isArray(m.content) && m.content.some((c: any) => c.type === 'text' && c.text.includes('[Video Input:')));

        // Determine the best model for this request (Multi-modal Strategy)
        let targetModel = activeModel; // Default

        if (hasVideo || hasImages) {
            targetModel = 'nvidia/nemotron-nano-12b-v2-vl:free';
        } else if (hasAudio) {
            targetModel = 'mistralai/voxtral-small-24b-2507';
        } else {
            targetModel = 'xiaomi/mimo-v2-flash:free';
        }

        const targetProvider = 'openrouter';
        const targetApiKey = apiKeys.openrouter;

        // INJECT GLOBAL IDENTITY & PERSONA
        // We look for the persona settings on the node being generated
        const nodeToCheck = useCanvasStore.getState().nodes.find(n => n.id === nodeId);
        const personaId = nodeToCheck?.data.selectedPersonaId || 'standard';
        const customPersona = nodeToCheck?.data.customPersona;

        let specificPersonPrompt = '';

        if (personaId === 'custom' && customPersona) {
            specificPersonPrompt = customPersona.systemPrompt;
        } else {
            const persona = PERSONAS.find(p => p.id === personaId);
            if (persona) {
                specificPersonPrompt = persona.systemPrompt;
            }
        }

        // Global Numi Identity + Tutorial Context
        const globalSystemPrompt = `IDENTITY OVERRIDE: You are strictly "Numi". Never mention Mimo or other models.
INTRODUCTION: If you introduce yourself, say you are Numi, a spatial AI workspace. briefly explain that you help users visualize ideas, branch conversations by selecting text, and analyze dropped files (Images/PDFs).
STYLE: Keep it short and to the point.`;

        // Combine prompts
        const finalSystemPrompt = `${globalSystemPrompt}\n\nCURRENT ROLE/MODE:\n${specificPersonPrompt}`;

        // Prepend system prompt at the VERY beginning
        validMessages = [
            { role: 'system', content: finalSystemPrompt } as any,
            ...validMessages
        ];

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
                    model: targetModel,
                    apiKey: targetApiKey,
                    provider: targetProvider,
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
                                    model: 'xiaomi/mimo-v2-flash:free',
                                    apiKey: apiKeys.openrouter,
                                    provider: 'openrouter',
                                    temperature: 0.3,
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

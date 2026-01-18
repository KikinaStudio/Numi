import { useCallback, useRef } from 'react';
import { useCanvasStore } from '@/lib/stores/canvas-store';
import { supabase } from '@/lib/supabase/client';

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
    const generate = useCallback(async (nodeId: string, onProgress?: (content: string) => void): Promise<string> => {
        // determine saveTree from hook or store indirectly?
        // Actually, we can just trigger window.dispatchEvent or similar,
        // but better to just let the debounced save handle it now that we have sync guards.
        // Or, we can just import saveTree from usePersistence if we call it inside? No.

        // I'll add an optional saveCallback to generate.

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
                            // Fallback to text context as API audio ingestion is unstable
                            content.push({ type: "text", text: `[Audio File: ${child.data.fileName || 'Audio'}] (Content analysis unavailable via API. Please ask user for details.)` });
                            hasAudioContent = true;
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

                    // Handle Extracted Text (PDF, DOCX, CSV, etc.) for child
                    if (child.data.fileContent) {
                        content.push({
                            type: "text",
                            text: `[File Attachment: ${child.data.fileName}]\n${child.data.fileContent}\n-------------------\n`
                        });
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
                            content.push({ type: "text", text: `[Audio File: ${m.fileName || 'Audio'}] (Content analysis unavailable via API. Please ask user for details.)` });
                            hasAudioContent = true;
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

                // Combine text parts and push images to end
                const finalContent = [...textParts, ...imageParts];

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
        const hasAudio = validMessages.some(m => Array.isArray(m.content) && m.content.some((c: any) => c.type === 'text' && c.text.includes('[Audio File:')));
        const hasVideo = validMessages.some(m => Array.isArray(m.content) && m.content.some((c: any) => c.type === 'text' && c.text.includes('[Video Input:')));

        // Determine the best model for this request (Multi-modal Strategy)
        let targetModel = activeModel; // Default

        if (hasVideo || hasImages) {
            targetModel = 'allenai/molmo-2-8b:free';
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
        const globalSystemPrompt = `IDENTITY OVERRIDE: You are strictly "Numi".
INTRODUCTION: You are Numi, a spatial AI workspace.
STYLE: Keep it short and to the point.
IMAGE GENERATION CAPABILITY:
If the user explicitly asks you to generate, create, draw, paint, or visualize an image/picture of something, do NOT write a text reply.
Instead, output ONLY this exact format:
<<GENERATE_IMAGE>>: <enhanced_prompt_for_image_generation>
Example:
User: "Draw a cat"
Assistant: "<<GENERATE_IMAGE>>: A fluffy cinematic cat in a cyberpunk alleyway, neon lights, 8k resolution"
Do not add any other text before or after.`;

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
            console.log('[Vision Debug] Model:', hasImages ? 'allenai/molmo-2-8b:free' : activeModel);
            console.log('[Vision Debug] Last Message Content:', JSON.stringify(validMessages[validMessages.length - 1]?.content, null, 2));
            console.log('[Vision Debug] Payload Size (approx):', JSON.stringify(validMessages).length);

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
            let isImageGeneration = false;

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

                                // Check for Image Generation Tag
                                if (fullContent.includes('<<GENERATE_IMAGE>>')) {
                                    isImageGeneration = true;
                                    // Don't update the node text yet, wait for the full prompt
                                    continue;
                                }

                                if (!isImageGeneration) {
                                    updateNode(nodeId, { content: fullContent });
                                }
                            }
                        } catch {
                            // Ignore parse errors for malformed chunks
                        }
                    }
                }
            }

            // Post-stream processing: Handle Image Generation if detected
            if (isImageGeneration) {
                const imagePrompt = fullContent.replace('<<GENERATE_IMAGE>>:', '').trim();
                console.log('[Image Gen] Detected prompt:', imagePrompt);
                updateNode(nodeId, {
                    content: 'Generating image...',
                    isGeneratingImage: true
                });

                try {
                    const imgRes = await fetch('/api/image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: imagePrompt,
                            apiKey: apiKeys.openrouter,
                            model: 'black-forest-labs/flux.2-klein-4b'
                        })
                    });

                    if (!imgRes.ok) {
                        const errData = await imgRes.json().catch(() => ({}));
                        throw new Error(errData.error || `Image API failed with status ${imgRes.status}`);
                    }

                    const imgData = await imgRes.json();
                    const imageUrl = imgData.data?.[0]?.url;

                    if (!imageUrl) throw new Error('No image URL returned');

                    // 1. Fetch the image as a blob
                    const imgBlobRes = await fetch(imageUrl);
                    const blob = await imgBlobRes.blob();

                    // 2. Upload to Supabase Storage
                    const fileName = `generated/${nodeId}-${Date.now()}.png`;
                    let finalUrl = imageUrl;

                    if (supabase) {
                        const { data: uploadData, error: uploadError } = await supabase.storage
                            .from('files')
                            .upload(fileName, blob, {
                                contentType: 'image/png',
                                cacheControl: '3600',
                                upsert: true
                            });

                        if (uploadError) {
                            console.warn('[Image Gen] Upload to Supabase failed, falling back to remote URL:', uploadError);
                        } else {
                            const { data: { publicUrl } } = supabase.storage
                                .from('files')
                                .getPublicUrl(fileName);
                            finalUrl = publicUrl;
                            console.log('[Image Gen] Persistent URL created:', finalUrl);
                        }
                    }

                    // Update node with image data (Flattened structure)
                    updateNode(nodeId, {
                        content: imagePrompt,
                        fileUrl: finalUrl,
                        fileName: `generated-${nodeId.substring(0, 4)}.png`,
                        mimeType: 'image/png',
                        role: 'assistant',
                        isGenerated: true,
                        isGenerating: false,
                        isGeneratingImage: false, // Reset explicit flag
                        label: 'inferred',
                    });

                } catch (imgError: any) {
                    console.error('Image Generation Failed:', imgError);
                    updateNode(nodeId, {
                        content: `[Image Generation Failed: ${imgError.message}]`,
                        isGenerating: false,
                        isGeneratingImage: false
                    });
                }
                return fullContent; // Exit
            }

            // Mark generation as complete (Text Mode)
            updateNode(nodeId, { isGenerating: false });

            // Auto-naming logic: If this is the first exchange (tree is untitled), name it.
            // Small delay to ensure the store has processed the last node update
            setTimeout(async () => {
                const { treeName, setTreeName } = useCanvasStore.getState();
                const isUntitled = !treeName ||
                    treeName === 'Untitled Conversation' ||
                    treeName.startsWith('Untitled Tree');

                if (isUntitled) {
                    console.log('🤖 Auto-naming tree triggered...');
                    try {
                        // Find the user prompt that triggered this response
                        const context = getConversationContext(nodeId);
                        // Context format: [{role, content}, ...]
                        // We want to summarize the first user message + this response
                        const firstUserMessage = context.find(m => m.role === 'user')?.content || '';
                        const assistantResponse = fullContent;

                        if (firstUserMessage) {
                            const namingPrompt = `Summarize this conversation topic in 3 words or less. strictly 3 words max. No quotes. Topic: User: "${firstUserMessage.slice(0, 200)}..." Assistant: "${assistantResponse.slice(0, 200)}..."`;

                            const namingModels = [
                                'google/gemini-2.0-flash-exp:free', // Primary
                                'meta-llama/llama-3.2-3b-instruct:free', // Proven working
                                'mistralai/mistral-7b-instruct:free', // Reliable Backup
                            ];

                            for (const model of namingModels) {
                                try {
                                    const nameResponse = await fetch('/api/chat', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            messages: [{ role: 'user', content: namingPrompt }],
                                            model: model,
                                            apiKey: apiKeys.openrouter,
                                            provider: 'openrouter',
                                            temperature: 0.3,
                                            stream: false,
                                        }),
                                    });

                                    if (nameResponse.ok) {
                                        const data = await nameResponse.json();
                                        // Handle both simplified API response and standard OpenAI format
                                        const rawTitle = data.content || data.choices?.[0]?.message?.content || '';
                                        const newTitle = rawTitle.trim().replace(/^["']|["']$/g, '');

                                        if (newTitle) {
                                            console.log(`🏷️ Auto-named tree using ${model}:`, newTitle);
                                            setTreeName(newTitle);
                                            break; // Success! Stop trying other models
                                        } else {
                                            console.warn(`⚠️ Auto-naming empty response from ${model}. Data:`, JSON.stringify(data));
                                        }
                                    } else {
                                        console.warn(`⚠️ Auto-naming failed with ${model}:`, await nameResponse.text());
                                    }
                                } catch (e) {
                                    console.warn(`⚠️ Auto-naming error with ${model}:`, e);
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

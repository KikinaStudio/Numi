
import { useState } from 'react';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useCanvasStore } from '@/lib/stores/canvas-store';

export function useImageGen() {
    const { apiKeys } = useSettingsStore();
    const { createChildNode, selectNode, updateNode } = useCanvasStore();
    const [isGenerating, setIsGenerating] = useState(false);

    const generateImage = async (prompt: string, parentNodeId: string) => {
        setIsGenerating(true);

        try {
            // 1. Create a "Loading" Child Node immediately
            // Position it below the parent
            const parent = useCanvasStore.getState().nodes.find(n => n.id === parentNodeId);
            const parentPos = parent ? parent.position : { x: 0, y: 0 };
            const newPos = {
                x: parentPos.x + 50,
                y: parentPos.y + 300 // Standard vertical gap
            };

            const childId = createChildNode(parentNodeId, newPos);

            // Set initial state to loading/generating
            updateNode(childId, {
                role: 'assistant',
                content: 'Generating Image...',
                isGenerating: true
            });
            selectNode(childId);

            // 2. Call API
            const res = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    apiKey: apiKeys.openrouter // Use OpenRouter Key
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to generate image');
            }

            // 3. Update Node with Image
            updateNode(childId, {
                content: '', // Clear text
                // We use standard file fields so it renders as an Image Node
                fileUrl: data.url,
                fileName: `generated-${Date.now()}.png`,
                mimeType: 'image/png',
                isGenerating: false
            });

        } catch (error: any) {
            console.error('Image Gen Failed:', error);
            // Update the node to show error
            // We need to find the childId... essentially we might need to return it from createChildNode or store it
            // For now, simpler error handling: alert
            alert(`Image Generation Failed: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return {
        generateImage,
        isGenerating
    };
}

export const extractVideoFrames = async (videoFile: File, count: number = 3): Promise<Blob[]> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const blobs: Blob[] = [];

        // Revoke URL on cleanup
        let objectUrl: string | null = null;
        const cleanup = () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            video.remove();
            canvas.remove();
        };

        if (!context) {
            reject(new Error('Failed to create canvas context'));
            return;
        }

        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous'; // Generally not needed for local file blobs but good practice

        objectUrl = URL.createObjectURL(videoFile);
        video.src = objectUrl;

        // Times to capture (10%, 50%, 90%)
        let targetTimes: number[] = [];
        let currentCaptureIndex = 0;

        const captureNextFrame = () => {
            if (currentCaptureIndex >= targetTimes.length) {
                // Done
                cleanup();
                resolve(blobs);
                return;
            }

            const time = targetTimes[currentCaptureIndex];
            video.currentTime = time;
            // Waiting for 'seeked' event
        };

        const onSeeked = () => {
            // Draw frame
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
                if (blob) {
                    blobs.push(blob);
                } else {
                    console.warn(`Failed to capture frame at ${video.currentTime}`);
                }

                currentCaptureIndex++;
                captureNextFrame();
            }, 'image/jpeg', 0.7); // 70% quality JPEG
        };

        video.addEventListener('seeked', onSeeked);

        video.onloadedmetadata = () => {
            const duration = video.duration;
            if (!isFinite(duration) || duration === 0) {
                // Fallback for weird streams - just try 0s
                targetTimes = [0];
            } else {
                targetTimes = [duration * 0.1, duration * 0.5, duration * 0.9];
            }
            captureNextFrame();
        };

        video.onerror = (e) => {
            cleanup();
            reject(new Error(`Video load error: ${video.error?.message || 'Unknown'}`));
        };
    });
};

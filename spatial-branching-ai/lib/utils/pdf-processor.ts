import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker (required for pdf.js)
// Use local worker file from public directory
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface PDFPageImage {
    blob: Blob;
    url: string; // Temporary object URL
    width: number;
    height: number;
}

export const convertPdfToImages = async (file: File): Promise<PDFPageImage[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageImages: PDFPageImage[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better quality
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) continue;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) continue;

        // ... existing viewport setup ... (lines 24-27)

        await page.render({
            canvasContext: context,
            viewport: viewport,
            canvas: canvas as any // Cast to avoid specialized canvas type mismatches if any
        }).promise;

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));

        if (blob) {
            pageImages.push({
                blob,
                url: URL.createObjectURL(blob),
                width: canvas.width,
                height: canvas.height
            });
        }
    }

    return pageImages;
};


import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import Papa from 'papaparse';

// Reuse worker setup from pdf-processor if possible, or re-init here safest
// pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'; 
// Note: It's better to ensure this is set globally once in the app, but safe to set here too if checked.
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export const extractTextFromFile = async (file: File): Promise<string> => {
    const type = file.type;
    const name = file.name.toLowerCase();

    try {
        // 1. PDF
        if (type === 'application/pdf') {
            return await extractPdfText(file);
        }

        // 2. DOCX
        if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) {
            return await extractDocxText(file);
        }

        // 3. CSV
        if (type === 'text/csv' || name.endsWith('.csv')) {
            return await extractCsvText(file);
        }

        // 4. Plain Text / Markdown / Code
        if (type.startsWith('text/') || name.endsWith('.md') || name.endsWith('.json') || name.endsWith('.ts') || name.endsWith('.js') || name.endsWith('.tsx')) {
            return await file.text();
        }

        return '';
    } catch (error) {
        console.error('Text extraction failed:', error);
        return `[Error extracting text from ${file.name}]`;
    }
};

const extractPdfText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }

    return fullText.trim();
};

const extractDocxText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
};

const extractCsvText = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            complete: (results) => {
                // Convert to a readable string format
                const text = results.data.map((row: any) => row.join(', ')).join('\n');
                resolve(text);
            },
            error: (error) => reject(error),
            header: false // Assume raw data for now, or true if we want keys
        });
    });
};

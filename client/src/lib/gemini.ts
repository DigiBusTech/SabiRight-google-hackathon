export interface GeminiResult {
    response: string | null;
    error?: string;
    errorCode?: number;
}

export async function runGemini(prompt: string): Promise<GeminiResult> {
    try {
        const response = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.warn(`AI API Error (Status ${response.status})`, errorData);
            
            if (response.status === 429) {
                return { 
                    response: null, 
                    error: "AI service quota exceeded. Please try again later or contact admin to upgrade the API plan.",
                    errorCode: 429
                };
            }
            if (response.status === 503) {
                return { 
                    response: null, 
                    error: "AI service not configured. Please ask the admin to set up the Gemini API key.",
                    errorCode: 503
                };
            }
            return { 
                response: null, 
                error: "AI service temporarily unavailable. Please try again.",
                errorCode: response.status
            };
        }
        const data = await response.json();
        return { response: data?.response || null };
    } catch (e) {
        console.error("AI Error:", e);
        return { response: null, error: "Network error. Please check your internet connection." };
    }
}

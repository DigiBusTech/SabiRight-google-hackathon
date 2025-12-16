
import { GEMINI_API_KEY } from "./firebase";

export async function runGemini(prompt: string, modelVersion = 'gemini-1.5-flash') {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            console.warn(`Gemini API Error (Status ${response.status}) on ${modelVersion}.`);
            return null;
        }
        const data = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (e) {
        console.error("Gemini Error:", e);
        return null;
    }
}

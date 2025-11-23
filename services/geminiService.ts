import { GoogleGenAI } from "@google/genai";

// Ensure the API key is available
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("Missing API_KEY environment variable.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Generates a graphical abstract using Gemini 2.5 Flash Image.
 * Supports both text-to-image and image-to-image (editing).
 */
export const generateGraphicalAbstract = async (
  prompt: string,
  style: string,
  baseImageBase64: string | null
): Promise<string> => {
  try {
    // Construct a specific prompt for scientific graphical abstracts
    const enhancedPrompt = baseImageBase64 
      ? `Edit this image to create a scientific graphical abstract. Style: ${style}. Instruction: ${prompt}`
      : `Create a high-quality scientific graphical abstract image. Type: ${style}. Description: ${prompt}. Ensure labels are legible if any.`;

    const parts: any[] = [];

    // If we have a base image, we include it (multimodal input for editing)
    if (baseImageBase64) {
      // Extract base64 data if it has the prefix
      const base64Data = baseImageBase64.split(',')[1] || baseImageBase64;
      
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: 'image/jpeg', // Assuming JPEG for simplicity from canvas/input
        },
      });
    }

    // Add the text prompt
    parts.push({ text: enhancedPrompt });

    // Using gemini-2.5-flash-image (Nano Banana) as requested for image generation/editing
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: parts,
      },
      config: {
         // Nano Banana models use generateContent for images. 
         // We do not set responseMimeType to json.
      }
    });

    // Parse response for image data
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    throw new Error("No image data found in response.");
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};

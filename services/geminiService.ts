
import { GoogleGenAI, Type } from "@google/genai";
import { TripInput, TripData, Message, AttractionRecommendation } from "../types";
import { 
  AI_CONFIG, 
  SYSTEM_INSTRUCTION, 
  constructTripPrompt, 
  constructUpdatePrompt, 
  constructRecommendationPrompt 
} from "../config/aiConfig";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

const parseJsonFromResponse = (text: string): TripData => {
  // Find the first '{' and the last '}' to extract the JSON object
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1) {
    // Fallback: Sometimes model puts text before/after. If we have a lot of text, try to find JSON.
    throw new Error("Invalid response format: No JSON object found.");
  }

  const jsonStr = text.substring(start, end + 1);
  try {
    const data = JSON.parse(jsonStr) as TripData;
    // Basic validation to ensure critical fields exist
    if (!data.tripMeta || !data.days) {
      throw new Error("Response is missing required trip data fields (tripMeta or days).");
    }
    return data;
  } catch (e) {
    console.error("JSON Parse Error:", e);
    throw new Error("Failed to parse itinerary data.");
  }
};

// Retry helper function
const callWithRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.warn(`API call failed, retrying in ${delay}ms... (${retries} attempts left)`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const generateTripItinerary = async (input: TripInput): Promise<TripData> => {
  const ai = getClient();
  const prompt = constructTripPrompt(input);

  try {
    return await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: AI_CONFIG.models.tripGenerator, 
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          ...AI_CONFIG.generationConfig.jsonMode,
        },
      });
      return parseJsonFromResponse(response.text || "{}");
    });
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};

export interface UpdateResult {
    responseText: string;
    updatedData?: TripData;
}

export const updateTripItinerary = async (
  currentData: TripData, 
  history: Message[],
  onThought?: (text: string) => void
): Promise<UpdateResult> => {
  const ai = getClient();
  const prompt = constructUpdatePrompt(currentData, history);

  try {
    const responseStream = await ai.models.generateContentStream({
      model: AI_CONFIG.models.tripUpdater,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    let fullText = "";
    let isJsonMode = false;
    let jsonBuffer = "";
    const delimiter = "___UPDATE_JSON___";

    for await (const chunk of responseStream) {
      const text = chunk.text;
      
      if (!isJsonMode) {
        fullText += text;
        const delimiterIndex = fullText.indexOf(delimiter);
        
        if (delimiterIndex !== -1) {
            // We found the delimiter. Everything before it is thought/text.
            // Everything after is the start of JSON.
            isJsonMode = true;
            
            const thoughtPart = fullText.substring(0, delimiterIndex);
            if (onThought) onThought(thoughtPart);
            
            // Start buffering JSON from whatever came after the delimiter in this chunk
            jsonBuffer = fullText.substring(delimiterIndex + delimiter.length);
        } else {
            // Still in text mode, stream to UI
            if (onThought) onThought(fullText);
        }
      } else {
         // We are fully in JSON mode, just buffer it, don't stream to chat UI
         jsonBuffer += text;
      }
    }

    // Final Processing
    if (isJsonMode) {
        // Scenario B: Update
        const updatedData = parseJsonFromResponse(jsonBuffer);
        const finalText = fullText.split(delimiter)[0];
        return {
            responseText: finalText,
            updatedData: updatedData
        };
    } else {
        // Scenario A: Chat only
        return {
            responseText: fullText
        };
    }

  } catch (error) {
    console.error("Gemini Update Error:", error);
    throw error;
  }
};

export const getAttractionRecommendations = async (
  location: string, 
  interests: string,
  category: 'attraction' | 'food' = 'attraction',
  excludeNames: string[] = []
): Promise<AttractionRecommendation[]> => {
  const ai = getClient();
  const prompt = constructRecommendationPrompt(location, interests, category, excludeNames);

  const response = await ai.models.generateContent({
    model: AI_CONFIG.models.recommender,
    contents: prompt,
    config: {
      ...AI_CONFIG.generationConfig.jsonMode,
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            reason: { type: Type.STRING },
            openHours: { type: Type.STRING },
          },
          required: ['name', 'description', 'category', 'reason', 'openHours'],
        }
      }
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse recommendations", e);
    return [];
  }
};

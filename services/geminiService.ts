
import { GoogleGenAI, Type } from "@google/genai";
import { TripInput, TripData, Message, AttractionRecommendation } from "../types";

const SYSTEM_INSTRUCTION = `
【系統角色】
你是一名世界級的專業旅遊行程設計師、資深在地導遊與產品文件撰寫者。你的任務是依使用者需求產生**「內容豐富、邏輯嚴密且令人興奮的互動式旅遊行程」**。

【語言與命名規則 (絕對遵守)】
1.  **地點名稱 (Stop Name)**：
    *   必須使用**該地點的當地原生語言**。
    *   **日本**：使用日文漢字/片假名 (例：✅ "成城石井 アトレ上野店", ❌ "Seijo Ishii", ❌ "成城石井超市")。
    *   **韓國**：使用韓文 (例：✅ "경복궁", ❌ "Gyeongbokgung")，可括號附註中文。
    *   **歐美**：使用當地語言 (英文/法文等)。
    *   **例外**：若該地點對外國遊客主要使用英文名稱 (如 "Universal Studios Japan") 則維持英文。
2.  **描述與內容 (Descriptions/Notes)**：
    *   所有行程描述、理由、小撇步、標題 (Theme) **必須全數使用繁體中文 (Traditional Chinese)**。

【你的核心原則】
1.  **拒絕無聊**：不要只列出地名。請提供「為什麼要去這裡？」的理由、必吃美食、最佳拍攝點或隱藏玩法。讓行程看起來好玩且令人期待。
2.  **邏輯與可行性**：時間安排必須真實可行（考慮交通擁堵、排隊時間）。路線必須順暢，不要東奔西跑。
3.  **結構化輸出**：必須嚴格遵守 JSON Schema，確保前端能完美渲染。
4.  **地點節點化 (重要 - Node Purity)**：
    行程中的每一個 stop (節點) 必須屬於以下三大類之一，且必須是「具體地點名稱」：
    *   **A. 景點 (Attractions)**：如 "雷門淺草寺"、"Shibuya Sky"、"上野公園"。
    *   **B. 餐飲 (Dining)**：**早餐、午餐、晚餐必須設為獨立的 stop**。
    *   **C. 交通樞紐 (Major Transport Hubs)**：如 "東京駅"、"成田空港"。
`;

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

const parseJsonFromResponse = (text: string): any => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error("No JSON object found.");
  return JSON.parse(text.substring(start, end + 1));
};

export const generateTripItinerary = async (input: TripInput): Promise<TripData> => {
  const ai = getClient();
  const prompt = `請根據以下需求設計旅遊行程：${JSON.stringify(input)}。請嚴格遵守系統指令中的語言規範與 JSON 結構。`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
    },
  });
  return parseJsonFromResponse(response.text || "{}") as TripData;
};

export const getAttractionRecommendations = async (
  location: string, 
  interests: string,
  category: 'attraction' | 'food' = 'attraction',
  excludeNames: string[] = []
): Promise<AttractionRecommendation[]> => {
  const ai = getClient();
  
  const categoryPrompt = category === 'food' 
    ? "當地必吃美食、餐廳、咖啡廳、甜點店、街頭小吃 (請專注於餐飲)" 
    : "熱門景點、秘境、博物館、購物區、自然景觀 (請排除純餐廳)";

  const excludePrompt = excludeNames.length > 0 
    ? `請絕對**不要**重複推薦以下地點：${excludeNames.join(', ')}。` 
    : "";

  const prompt = `請針對目的地「${location}」推薦 8 個${categoryPrompt}。
  考慮使用者的興趣：「${interests}」。
  ${excludePrompt}
  
  回傳格式必須是 JSON 陣列，每個物件包含：
  - name: 地點名稱 (請使用當地語言，如日文、韓文)
  - description: 一句話介紹 (繁體中文)
  - category: 具體類別 (如：拉麵、燒肉、古蹟、百貨、夜景)
  - reason: 為什麼推薦 (繁體中文)
  - openHours: 營業時間 (如：09:00 - 18:00，若為 24 小時則註明，若不清楚請提供合理推估)
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
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
  const historyText = history.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
  const lastUserMessage = history[history.length - 1]?.text || "";

  const prompt = `
    Current Itinerary JSON: ${JSON.stringify(currentData)}
    Conversation History: ${historyText}
    Current User Request: "${lastUserMessage}"
    (依指令修改 JSON 並回傳，使用 ___UPDATE_JSON___ 分隔)
  `;

  const responseStream = await ai.models.generateContentStream({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION },
  });

  let fullText = "";
  let isJsonMode = false;
  let jsonBuffer = "";
  const delimiter = "___UPDATE_JSON___";

  for await (const chunk of responseStream) {
    const text = chunk.text;
    if (!isJsonMode) {
      fullText += text;
      const idx = fullText.indexOf(delimiter);
      if (idx !== -1) {
        isJsonMode = true;
        if (onThought) onThought(fullText.substring(0, idx));
        jsonBuffer = fullText.substring(idx + delimiter.length);
      } else {
        if (onThought) onThought(fullText);
      }
    } else {
      jsonBuffer += text;
    }
  }

  if (isJsonMode) {
    return { responseText: fullText.split(delimiter)[0], updatedData: parseJsonFromResponse(jsonBuffer) };
  }
  return { responseText: fullText };
};

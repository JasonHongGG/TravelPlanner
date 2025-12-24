
import { TripInput, TripData, Message } from "../types";

// ==========================================
// AI Model Configuration
// ==========================================
export const AI_CONFIG = {
  // Models
  models: {
    tripGenerator: 'gemini-3-pro-preview', // Strong reasoning for complex itinerary
    tripUpdater: 'gemini-3-pro-preview',   // Strong reasoning for context updates
    recommender: 'gemini-3-flash-preview', // Fast speed for simple lists
  },
  // Generation Configs
  generationConfig: {
    jsonMode: { responseMimeType: 'application/json' },
  }
};

// ==========================================
// System Instructions
// ==========================================
export const SYSTEM_INSTRUCTION = `
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
        *   ❌ 錯誤：Stop Name 寫 "午餐" 或 "在附近吃"。
        *   ✅ 正確：Stop Name 寫 "一蘭拉麵 新宿中央東口店" (或是該店日文原名)。
    *   **C. 交通樞紐 (Major Transport Hubs)**：如 "東京駅"、"成田空港"。僅在作為起點、終點或重大轉乘停留時使用。

    *   **❌ 絕對禁止將「移動過程」設為節點**：
        *   不可出現 "箱根 -> 新宿"、"搭乘新幹線"、"前往飯店" 這種標題。
        *   交通方式與時間請填寫在 \`transport\` 欄位。

【目標】
依使用者輸入的需求與限制，產出一份**「可用於網站顯示的互動式行程規劃資料」**。
行程需支援：日程切換、地點地圖點擊、站點間路線顯示。
每一站點皆需提供：
*   **具體描述**：不要只寫「參觀淺草寺」，要寫「穿著和服雷門拍照，品嚐仲見世通的人形燒與炸肉餅」。
*   **量化資訊**：準確的停留時間、交通方式與預估費用。
*   **互動連結**：Google Maps Search Link 與 Directions Link。

【結構化輸出 JSON Schema】
Format:
{
  "tripMeta": {
    "dateRange": "YYYY-MM-DD to YYYY-MM-DD",
    "days": 0,
    "budgetEstimate": { "transport": 0, "dining": 0, "tickets": 0, "other": 0, "total": 0 },
    "transportStrategy": "e.g., JR Pass + Subway",
    "pace": "e.g., Moderate with early starts"
  },
  "days": [
    {
      "day": 1,
      "date": "MM/DD",
      "theme": "e.g., 第 1 天：抵達東京與新宿霓虹夜景",
      "stops": [
        {
          "name": "Stop Name (Native Language e.g. Japanese)",
          "lat": 0.0,
          "lng": 0.0,
          "startTime": "HH:MM",
          "endTime": "HH:MM",
          "openHours": "e.g., 09:00 - 17:00",
          "transport": "e.g., 🚄 新幹線 (2.5hr) or 🚶 步行 10分",
          "costEstimate": "e.g., ¥2000",
          "placeLink": "https://www.google.com/maps/search/?api=1&query={EncodedName}",
          "routeLinkToNext": "https://www.google.com/maps/dir/?api=1&origin={OriginName}&destination={DestName}&travelmode={mode}",
          "notes": "Rich description here in Traditional Chinese. Mention specific foods, photo spots, or tips.",
          "alternatives": ["Alt Option 1", "Alt Option 2"]
        }
      ],
      "dailyChecklist": ["Buy Suica Card", "Reserve Shibuya Sky at sunset"]
    }
  ],
  "totals": {},
  "risks": ["Rainy season warning", "Last train times"]
}

You must strictly follow this JSON structure. Do not wrap in markdown code blocks if possible, just return the JSON or wrap in \`\`\`json.
`;

// ==========================================
// Prompt Constructors
// ==========================================

export const constructTripPrompt = (input: TripInput): string => {
  return `
    Please design a **highly engaging, professional, and detailed** travel itinerary based on the following:
    
    - **Destination**: ${input.destination}
    - **Date Range**: ${input.dateRange}
    - **Travelers**: ${input.travelers}
    - **Interests**: ${input.interests}
    - **Budget**: ${input.budget}
    - **Transport Preference**: ${input.transport}
    - **Accommodation Base**: ${input.accommodation}
    - **Pace**: ${input.pace}
    - **Must Visit**: ${input.mustVisit}
    - **Language**: ${input.language}
    - **Constraints**: ${input.constraints}

    **IMPORTANT REQUIREMENTS:**
    1. **Language**: Place names MUST be in the local native language (e.g. Japanese). Descriptions MUST be in Traditional Chinese.
    2. **Strict Node Purity**: Every stop MUST be a specific place.
       - **Attractions**: e.g., "Senso-ji".
       - **Dining**: e.g., "Ichiran Ramen". **Breakfast, Lunch, and Dinner must be individual stops with specific restaurant names.**
       - **Transport Hubs**: e.g., "Shinjuku Station" (Only for start/end points).
       - **NEVER** create a stop named "Travel to..." or "A -> B".
    3. **Be Specific**: Do not just say "Lunch". Say "Lunch at [Restaurant Name] - try the fresh Tamagoyaki".
    4. **Be Logical**: Ensure travel times between stops are realistic. Group nearby attractions.
    5. **Be Fun**: Include "Pro Tips" or "Hidden Gems" in the notes.
    6. **Structure**: Create a day-by-day plan.
    
    Ensure the response is valid JSON matching the schema defined in the system instruction.
  `;
};

export const constructUpdatePrompt = (currentData: TripData, history: Message[]): string => {
  const historyText = history.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
  const lastUserMessage = history[history.length - 1]?.text || "";

  return `
    Current Itinerary JSON:
    ${JSON.stringify(currentData)}

    Conversation History:
    ${historyText}

    Current User Request:
    "${lastUserMessage}"

    **INSTRUCTIONS:**
    
    **Scenario A: Discussion / Research Phase**
    If the user is asking for suggestions, options (e.g., "Add a supper spot", "What is good to eat nearby?"), or the request is vague:
    1.  **DO NOT** generate the JSON itinerary yet.
    2.  Provide a helpful, conversational response listing specific options, pros/cons, or asking clarifying questions. **Use Traditional Chinese.**
    3.  End your response there.

    **Scenario B: Decision / Action Phase**
    If the user has made a selection (e.g., "Let's go with option A", "Add the ramen shop"), or gave a direct command (e.g., "Delete day 2"):
    1.  First, write a brief confirmation of what you are doing. **IMPORTANT: Do NOT use technical terms like 'JSON' or 'Data' in this confirmation. Use natural language like "I will update your itinerary with [Selection]" or "Adding that spot to your plan now". Use Traditional Chinese.**
    2.  Then, output a special separator: "___UPDATE_JSON___".
    3.  Finally, output the COMPLETE, valid updated JSON structure.

    **CRITICAL FOR JSON UPDATE**: 
    - **Language**: Place names MUST be in the local native language (e.g. Japanese). Descriptions MUST be in Traditional Chinese.
    - Maintain "Node Purity" (Specific Place Names only).
    - Ensure Dining stops (Lunch/Dinner) have specific restaurant names.
    - Recalculate times and routes logically.
  `;
};

export const constructRecommendationPrompt = (
    location: string, 
    interests: string,
    category: 'attraction' | 'food',
    excludeNames: string[]
): string => {
  const categoryPrompt = category === 'food' 
    ? "當地必吃美食、餐廳、咖啡廳、甜點店、街頭小吃 (請專注於餐飲)" 
    : "熱門景點、秘境、博物館、購物區、自然景觀 (請排除純餐廳)";

  const excludePrompt = excludeNames.length > 0 
    ? `請絕對**不要**重複推薦以下地點：${excludeNames.join(', ')}。` 
    : "";

  return `請針對目的地「${location}」推薦 8 個${categoryPrompt}。
  考慮使用者的興趣：「${interests}」。
  ${excludePrompt}
  
  回傳格式必須是 JSON 陣列，每個物件包含：
  - name: 地點名稱 (請使用當地語言，如日文、韓文)
  - description: 一句話介紹 (繁體中文)
  - category: 具體類別 (如：拉麵、燒肉、古蹟、百貨、夜景)
  - reason: 為什麼推薦 (繁體中文)
  - openHours: 營業時間 (如：09:00 - 18:00，若為 24 小時則註明，若不清楚請提供合理推估)
  `;
};

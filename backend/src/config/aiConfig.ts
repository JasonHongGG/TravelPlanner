
import { TripInput, TripData, Message } from "../types";

// ==========================================
// System Instructions
// ==========================================
export const SYSTEM_INSTRUCTION = `
【系統角色】
你是一名世界級的專業旅遊行程設計師、資深在地導遊與產品文件撰寫者。你的任務是依使用者需求產生**「內容豐富、邏輯嚴密且令人興奮的互動式旅遊行程」**。

【語言與命名規則 (絕對遵守)】
1.  **地點名稱 (Stop Name)**：
    *   **請優先遵循 Prompt 中指定的語言規則** (例如：若指定使用中文標題，則使用中文)。
    *   **若無特別指定**，則預設使用**該地點的當地原生語言** (Node Purity)。
    *   **日本**：原生預設為日文 (例：✅ "成城石井", ❌ "Seijo Ishii")。
    *   **歐美**：原生預設為當地語言。
    *   **例外**：若該地點對外國遊客主要使用英文名稱 (如 "Universal Studios Japan") 則維持英文。
2.  **描述與內容 (Descriptions/Notes)**：
    *   **所有行程描述、理由、小撇步、標題 (Theme)**：
        *   **必須全數使用 Prompt 中指定的目標語言 (Target Language)**。
        *   若無指定，預設為繁體中文。
3.  **每日標題 (Day Theme)**：
    *   **風格**：必須簡短、有力、帶有文青或雜誌感的「風格標題」。
    *   **語言**：使用 **目標語言 (Target Language)**。
    *   **長度**：適當長度（約 15 字以內）。
    *   **❌ 禁止**：流水帳列出地點 (如 "去牧場然後看夕陽吃夜市")。
    *   **✅ 範例**： "Day 1：昭和懷舊散策"、"Day 2：鎌倉湘南海岸與大佛"、"Day 3：東京霓虹夜行、Day 4：縱谷田園風光與初鹿牧場"。

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
*   **量化資訊**：準確的停留時間、交通方式與預估費用 (含數值 clean integer)。
*   **分類標籤**：準確標記該地點的類型與費用類別。

【結構化輸出 JSON Schema】
Format:
{
  "tripMeta": {
    "dateRange": "YYYY-MM-DD to YYYY-MM-DD",
    "days": 0,
    "travelers": "e.g., 2 adults",
    "transportStrategy": "e.g., JR Pass + Subway",
    "pace": "e.g., Moderate with early starts"
  },
  "days": [
    {
      "day": 1,
      "date": "MM/DD",
      "theme": "e.g., Day 1 Theme in Target Language",
      "stops": [
        {
          "name": "Stop Name (Native Language e.g. Japanese)",
          "type": "Must be exactly one of: 'attraction', 'landmark', 'nature', 'history', 'dining', 'cafe', 'shopping', 'transport', 'activity', 'accommodation', 'other'",
          "lat": 0.0,
          "lng": 0.0,
          "startTime": "HH:MM",
          "endTime": "HH:MM",
          "openHours": "e.g., 09:00 - 17:00",
          "transport": "e.g., 🚄 Shinkansen (2.5hr) or 🚶 Walk 10min (Use Target Language)",
          "costEstimate": "e.g., ¥2000 (Display Text)",
          "costAmount": 2000,
          "costCategory": "Must be exactly one of: 'transport', 'dining', 'tickets', 'shopping', 'accommodation', 'other'",
          "notes": "Rich description here in Target Language. Mention specific foods, photo spots, or tips.",
          "alternatives": ["Alt Option 1", "Alt Option 2"]
        }
      ],
      "dailyChecklist": ["Checklist Item 1 in Target Language"]
    }
  ],
  "totals": {},
  "risks": ["Risk warning in Target Language"]
}

You must strictly follow this JSON structure. Do not wrap in markdown code blocks if possible, just return the JSON or wrap in \`\`\`json.
`;

// ==========================================
// Prompt Constructors
// ==========================================

export const constructTripPrompt = (input: TripInput): string => {
  const targetLang = input.language || "Traditional Chinese";
  // Use explicit title language preference if available, otherwise fallback to targetLang logic
  const titleLang = (input as any).titleLanguage || targetLang;

  const titleRule = titleLang.includes("Local Language")
    ? "Place names MUST be in the local native language (e.g. Japanese)."
    : `Place names (Stop Names) MUST be in ${titleLang} (e.g. use "淺草寺" if Traditional Chinese).`;

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
    - **Target Language**: ${targetLang}
    - **Constraints**: ${input.constraints}

    **IMPORTANT REQUIREMENTS:**
    1. **Language**: 
       - **Place names (Stop Names)**: ${titleRule}
       - **All Descriptions, Notes, and Themes MUST be in ${targetLang}**. 
    2. **Strict Node Purity**: Every stop MUST be a specific place.
       - **Attractions**: e.g., "Senso-ji" or "淺草寺".
       - **Dining**: e.g., "Ichiran Ramen". **Breakfast, Lunch, and Dinner must be individual stops with specific restaurant names.**
       - **Transport Hubs**: e.g., "Shinjuku Station" (Only for start/end points).
       - **NEVER** create a stop named "Travel to..." or "A -> B".
    3. **Be Specific**: Do not just say "Lunch". Say "Lunch at [Restaurant Name] - try the fresh Tamagoyaki".
    4. **Be Logical**: Ensure travel times between stops are realistic. Group nearby attractions.
    5. **Be Fun**: Include "Pro Tips" or "Hidden Gems" in the notes.
    6. **Categorization**: Ensure the 'type' field is accurate.
    7. **Costing**: Provide a numeric 'costAmount' and a valid 'costCategory' for EVERY stop. 
       - **IMPORTANT: PER PERSON vs TOTAL**:
         - **Dining / Tickets / Transport / Activities**: Output cost **PER PERSON**. (e.g. 1 Ramen bowl).
         - **Accommodation / Shopping / Other**: Output **TOTAL COST** for the WHOLE GROUP. (e.g. 1 Hotel Room).
       - **Currency**: The 'costAmount' MUST be approximated in **${input.currency || 'local currency'}**. 
       - Example: If local cost is 2000 JPY and Target Currency is TWD, output approx 400. 
       - Do NOT output JPY amount if Target Currency is different.
    
    Ensure the response is valid JSON matching the schema defined in the system instruction.
  `;
};

export const constructUpdatePrompt = (
  currentData: TripData,
  history: Message[],
  chatLanguage: string = "Traditional Chinese",
  tripLanguage: string = "Traditional Chinese"
): string => {
  const historyText = history.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
  const lastUserMessage = history[history.length - 1]?.text || "";

  // Determine title rule based on tripLanguage param
  // If tripLanguage contains "Local", we enforce local. Otherwise we enforce that language.
  const useLocalTitles = tripLanguage.includes("Local Language");
  const titleRule = useLocalTitles
    ? "Place names MUST be in the local native language (e.g. Japanese)."
    : `Place names MUST be in ${tripLanguage} (e.g. use "淺草寺" not "Senso-ji" if language is Chinese).`;

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
    2.  Provide a helpful, conversational response listing specific options, pros/cons, or asking clarifying questions. **Use ${chatLanguage}.**
    3.  End your response there.

    **CRITICAL FORMATTING RULES FOR CHAT (Strictly Enforce):**
    - **Use Markdown Lists**: When offering options, **ALWAYS** use a proper markdown list (e.g., "1. Option A" or "- Option B").
    - **NO Inline Numbering**: **NEVER** use inline circled numbers (e.g., ①, ②, ③) or inline text lists (e.g., "1) A, 2) B"). This breaks the mobile UI layout.
    - **Break Lines**: Put every option on a new line.
    - **Short Paragraphs**: Keep description paragraphs short (under 3 lines) for readability.
    - **Visual Structure**: Use **Bold** for place names to make them stand out.

    **Scenario B: Decision / Action Phase**
    If the user has made a selection (e.g., "Let's go with option A", "Add the ramen shop"), or gave a direct command (e.g., "Delete day 2"):
    1.  First, write a brief confirmation of what you are doing. **IMPORTANT: Do NOT use technical terms like 'JSON' or 'Data' in this confirmation. Use natural language like "I will update your itinerary with [Selection]" or "Adding that spot to your plan now". Use ${chatLanguage}.**
    2.  Then, output a special separator: "___UPDATE_JSON___".
    3.  Finally, output the **PARTIAL** updated JSON structure.

    **CRITICAL SEPARATOR INSTRUCTION**:
    Values MUST be separated by "___UPDATE_JSON___" on a new line. Do not hide it in markdown.

    **CRITICAL PERFORMANCE INSTRUCTION**:
    To ensure speed, you support **PARTIAL JSON UPDATES**.
    - If you are modifying specific days (e.g. Day 2), **ONLY** return the \`days\` array containing the **changed day objects**. 
    - You do **NOT** need to return the days that are unchanged. The system will merge them.
    - **Example**: If modifying Day 1, output: \`{ "days": [ { "day": 1, ...full day content... } ] }\`.
    - If you are modifying global stats (budget/dates), include \`tripMeta\`.
    - Always output valid JSON.

    **CONTENT RULES FOR JSON UPDATE**: 
    - **Language**: ${titleRule}
    - **Descriptions MUST be in ${tripLanguage}**.
    - Maintain "Node Purity" (Specific Place Names only).
    - Ensure Dining stops (Lunch/Dinner) have specific restaurant names.
    - Ensure the 'type' field is correctly set.
    - **Include 'costAmount' and 'costCategory' for any new or modified stops.**
  `;
};

export const constructExplorerUpdatePrompt = (
  dayIndex: number,
  newMustVisit: string[],
  newAvoid: string[],
  keepExisting: string[],
  removeExisting: string[],
  chatLanguage: string = "Traditional Chinese",
  tripLanguage: string = "Traditional Chinese"
): string => {
  const useLocalTitles = tripLanguage.includes("Local Language");
  const titleRule = useLocalTitles
    ? "地點名稱維持當地原生語言 (Node Purity)。"
    : `地點名稱請使用 ${tripLanguage} (例如：使用中文名稱)。`;

  return `
    任務：重新規劃第 ${dayIndex} 天的行程。

    請根據以下嚴格指令進行調整：

    1.  **【新增必去 (Must Add)】**：使用者希望加入這些新地點，請安排在最順路的時段：
        ${newMustVisit.length > 0 ? newMustVisit.join('、') : '無'}

    2.  **【原本行程 - 必須保留 (Keep/Locked)】**：這些是當天原本行程中，使用者指定**絕對不能更動**的項目（但時間順序可依路線最佳化微調）：
        ${keepExisting.length > 0 ? keepExisting.join('、') : '無'}

    3.  **【原本行程 - 必須移除 (Remove)】**：請將這些項目從當天行程中**刪除**：
        ${removeExisting.length > 0 ? removeExisting.join('、') : '無'}
        ${newAvoid.length > 0 ? `(以及使用者在探索時指定避開的：${newAvoid.join('、')})` : ''}

    4.  **【原本行程 - 彈性調整 (Neutral)】**：
        當天行程中未提及的其他項目為「中立」狀態。
        - 如果時間足夠，且順路，可以保留。
        - 如果為了塞入【新增必去】的地點導致時間不足，**可以刪除或替換這些中立項目**。
        - 如果原本的餐廳被移除，請務必在附近安排新的高評價餐廳（符合該時段，如午餐或晚餐）。

    **輸出要求**：
    1.  先用**${chatLanguage}**簡述你做了哪些調整（例如：「已為您加入[新景點]，並保留了[保留景點]，為了行程順暢，我調整了...」）。
    2.  輸出分隔符 "___UPDATE_JSON___"。
    3.  輸出 JSON，僅包含更新後的第 ${dayIndex} 天資料 (Partial Update)。

    **核心原則複誦**：
    - ${titleRule}
    - **行程描述與備註使用 ${tripLanguage}**。
    - 確保交通邏輯合理。
    `;
};

export const constructRecommendationPrompt = (
  location: string,
  interests: string,
  category: 'attraction' | 'food',
  excludeNames: string[],
  targetLanguage: string = "Traditional Chinese",
  titleLanguage: string = "Local Language",
  count: number = 12
): string => {
  const categoryPrompt = category === 'food'
    ? "當地必吃美食、餐廳、咖啡廳、甜點店、街頭小吃 (請專注於餐飲)"
    : "熱門景點、秘境、博物館、購物區、自然景觀 (請排除純餐廳)";

  const excludePrompt = excludeNames.length > 0
    ? `請絕對**不要**重複推薦以下地點：${excludeNames.join(', ')}。`
    : "";

  const titleRule = titleLanguage.includes("Local Language")
    ? "(請使用當地語言，如日文、韓文)"
    : `(請使用 ${titleLanguage})`;

  return `請針對使用者的搜尋關鍵字「${location}」推薦 ${count} 個${categoryPrompt}。
  
  【重要搜尋邏輯】
  1. 此關鍵字可能是「地名」(如：新宿)，也可能是「特定類別」(如：新宿美術館、澀谷拉麵)。
  2. 若關鍵字包含具體的類別（例如「美術館」、「公園」、「燒肉」），請**務必優先**推薦該類別的地點。
  3. 不要只推薦大範圍的熱門景點，請根據關鍵字的語意進行精準推薦。比如使用者搜「美術館」，即便該區熱門的是百貨公司，你也應該優先給出美術館。

  考慮使用者的興趣：「${interests}」。
  請嚴格控制數量為 ${count} 個，不多也不少。
  ${excludePrompt}
  
  回傳格式必須是 JSON 陣列，每個物件包含：
  - name: 地點名稱 ${titleRule}
  - description: 一句話介紹 (${targetLanguage})
  - category: 具體類別 (如：拉麵、燒肉、古蹟、百貨、夜景)
  - reason: 為什麼推薦 (${targetLanguage})
  - openHours: 營業時間 (如：09:00 - 18:00，若為 24 小時則註明，若不清楚請提供合理推估)
  
  **IMPORTANT LANGUAGE RULE:**
  - Use ${targetLanguage} for all descriptions and reasons.
  `;
};

export const constructFeasibilityPrompt = (
  tripData: TripData,
  modificationContext: string,
  targetLanguage: string = "Traditional Chinese"
): string => {
  return `
    You are a professional travel logistics analyzer. 
    Your job is to check if a proposed change to an itinerary is **feasible** and **sensible**.

    **Current Itinerary (Context):**
    ${JSON.stringify(tripData)}

    **Proposed Change / User Intent:**
    ${modificationContext}

    **FEASIBILITY RULES (Strictly Enforce):**
    1. **Geographical Distance**: Is the user trying to jump between distant cities (e.g., Tokyo to Osaka) in a single day without realistic travel time?
    2. **Time Constraint**: If the day has too many stops, will the average time per stop drop below 30-45 minutes (excluding transport)? If so, it is "High Risk".
    3. **Overcrowding**: Is the user adding a major attraction (e.g., Universal Studios, Disney) to a day that already has full itinerary?

    **Output JSON Format (No Markdown):**
    {
       "feasible": boolean, // true if reasonable, false if physically impossible or extremely rushed
       "riskLevel": "low" | "moderate" | "high",
       "issues": ["List of specific problems in ${targetLanguage}"],
       "suggestions": ["List of actionable solutions in ${targetLanguage} e.g. 'Move X to Day 3', 'Remove Y'"]
    }

    **Example Issues:**
    - "Day 2 行程過於緊湊，加入大阪難波後，東京至大阪來回需 5 小時，剩餘遊玩時間不足。"
    - "Day 1 景點過多（8 個），平均每個景點僅能停留 20 分鐘。"

    **Example Suggestions:**
    - "建議將大阪行程獨立安排在另一天。"
    - "建議移除 Day 1 的兩個次要購物點。"
  `;
};

import { TravelAIService } from "./TravelAIService";

// Implementation is now centralized in TravelAIService which acts as a client to the Backend.
// The Backend handles Provider selection (Gemini, Ollama, Copilot).

const serviceInstance = new TravelAIService();

console.log("Using Unified TravelAIService (Client -> Backend)");

export const aiService = serviceInstance;

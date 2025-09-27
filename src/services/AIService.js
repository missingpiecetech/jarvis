/**
 * AI Service
 * Handles AI API integration with support for multiple models/providers
 * Primary implementation uses Gemini Flash, but designed for easy switching
 * Enhanced with context extraction and task/event suggestion capabilities
 */
import { userContextService } from "./UserContextService.js";

class AIService {
  constructor() {
    this.currentProvider = "gemini";
    this.models = {
      gemini: {
        flash: "gemini-2.0-flash-lite",
        pro: "gemini-2.5-pro",
      },
    };
    this.defaultModel = this.models.gemini.flash;
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    this.baseURL = "https://generativelanguage.googleapis.com/v1beta/models";
  }

  /**
   * Send a message to the AI and get a response with context extraction
   */
  async sendMessage(messages, options = {}) {
    try {
      const model = options.model || this.defaultModel;
      const temperature = options.temperature || 0.7;
      const maxTokens = options.maxTokens || 2048;
      const extractContext = options.extractContext !== false; // Default to true
      const userId = options.userId;
      const conversationId = options.conversationId;

      switch (this.currentProvider) {
        case "gemini":
          const response = await this.sendToGemini(
            messages,
            model,
            temperature,
            maxTokens
          );

          // Extract context and suggestions if successful and enabled
          if (response.success && extractContext && userId) {
            // Run context extraction in background (don't wait for it)
            this.extractAndStoreContext(
              messages,
              response.content,
              userId,
              conversationId
            ).catch((error) =>
              console.error("Context extraction error:", error)
            );
          }

          return response;
        default:
          throw new Error(`Unsupported AI provider: ${this.currentProvider}`);
      }
    } catch (error) {
      console.error("AI Service Error:", error);
      return {
        success: false,
        error: error.message,
        content:
          "I apologize, but I encountered an issue processing your request. Please try again.",
      };
    }
  }

  /**
   * Send message to Gemini API
   */
  async sendToGemini(messages, model, temperature, maxTokens) {
    console.log("Sending to Gemini with model:", model);
    if (!this.apiKey) {
      throw new Error("Gemini API key not configured");
    }

    // Convert messages to Gemini format
    const contents = this.formatMessagesForGemini(messages);

    const requestBody = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        topP: 0.95,
        topK: 64,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ],
    };

    const response = await fetch(
      `${this.baseURL}/${model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message ||
          `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No response generated from AI");
    }

    const candidate = data.candidates[0];
    if (candidate.finishReason === "SAFETY") {
      throw new Error("Response blocked by safety filters");
    }

    const content = candidate.content?.parts?.[0]?.text || "";

    return {
      success: true,
      content,
      model,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  /**
   * Format messages for Gemini API
   */
  formatMessagesForGemini(messages) {
    return messages
      .filter((msg) => msg.role !== "system") // Gemini doesn't support system messages directly
      .map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));
  }

  /**
   * Get conversation context with recent messages and user context
   */
  async getConversationContext(messages, maxMessages = 10, userId = null) {
    // Get recent messages for context
    const recentMessages = messages.slice(-maxMessages);

    // Get user context summary if userId provided
    let userContextSummary = "";
    if (userId) {
      try {
        const contextResult =
          await userContextService.getContextSummaryForPrompt(userId);
        if (contextResult.success) {
          userContextSummary = contextResult.data;
        }
      } catch (error) {
        console.error("Error getting user context:", error);
      }
    }

    // Enhanced system prompt with context awareness and task/event creation instructions
    const systemContext = {
      role: "user",
      content: `You are Jarvis, a helpful personal assistant. You should be conversational, friendly, and helpful. Provide clear and concise responses while being personable. If you need clarification or more information to help better, don't hesitate to ask follow-up questions.

${userContextSummary ? userContextSummary + "\n" : ""}
Based on conversations, you should:
1. Learn about the user's preferences, habits, goals, and constraints
2. Suggest tasks when the user mentions things they need to do
3. Suggest calendar events when they mention meetings, appointments, or time-based activities
4. Remember important facts about the user for future reference
5. Be proactive in helping them stay organized and productive

When suggesting tasks or events, be specific about timing, priority, and details when possible.`,
    };

    return [systemContext, ...recentMessages];
  }

  /**
   * Switch AI provider/model
   */
  switchProvider(provider, model = null) {
    this.currentProvider = provider;
    if (model) {
      this.defaultModel = model;
    }
  }

  /**
   * Get available models for current provider
   */
  getAvailableModels() {
    return this.models[this.currentProvider] || {};
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      provider: this.currentProvider,
      model: this.defaultModel,
      hasApiKey: !!this.apiKey,
    };
  }

  /**
   * Check if AI service is properly configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Extract context and suggestions from conversation
   * This runs in the background after each AI response
   */
  async extractAndStoreContext(messages, aiResponse, userId, conversationId) {
    try {
      if (!this.isConfigured()) {
        return;
      }

      // Get the last few messages for context extraction
      const recentMessages = messages.slice(-3);
      const lastUserMessage = recentMessages.find((m) => m.role === "user");

      if (!lastUserMessage) {
        return;
      }

      // Create extraction prompt
      const extractionPrompt = `Analyze the following conversation and extract:
1. User facts, preferences, habits, or constraints that should be remembered
2. Task suggestions based on things the user mentioned they need to do
3. Event suggestions for meetings, appointments, or time-based activities

Recent conversation:
${recentMessages.map((m) => `${m.role}: ${m.content}`).join("\n")}

AI Response: ${aiResponse}

Please respond with valid JSON in this format:
{
  "contexts": [
    {
      "type": "fact|preference|goal|habit|interest|constraint",
      "category": "work|personal|health|finance|general",
      "key": "short descriptive key",
      "value": "detailed description",
      "confidence": 0.8
    }
  ],
  "taskSuggestions": [
    {
      "title": "task title",
      "description": "task description",
      "priority": "low|medium|high|urgent",
      "category": "category",
      "estimatedDuration": 30,
      "confidence": 0.7
    }
  ],
  "eventSuggestions": [
    {
      "title": "event title",
      "description": "event description",
      "suggestedStartDate": "2024-01-01T10:00:00Z",
      "suggestedEndDate": "2024-01-01T11:00:00Z",
      "location": "location if mentioned",
      "isAllDay": false,
      "confidence": 0.7
    }
  ]
}

Only include items that are clearly mentioned or strongly implied. Use high confidence (0.8-1.0) for explicit statements, medium confidence (0.5-0.7) for implied information.`;

      const extractionMessages = [
        {
          role: "user",
          content: extractionPrompt,
        },
      ];

      // Call AI for extraction
      const extractionResponse = await this.sendToGemini(
        extractionMessages,
        this.models.gemini.flash, // Use flash for faster extraction
        0.3, // Lower temperature for more consistent JSON
        1000
      );

      if (!extractionResponse.success) {
        console.error("Context extraction failed:", extractionResponse.error);
        return;
      }

      // Parse and store extracted data
      await this.processExtractionResults(
        extractionResponse.content,
        userId,
        conversationId,
        lastUserMessage.id
      );
    } catch (error) {
      console.error("Error in context extraction:", error);
    }
  }

  /**
   * Process and store extraction results
   */
  async processExtractionResults(
    extractionContent,
    userId,
    conversationId,
    messageId
  ) {
    try {
      // Try to parse JSON from the response
      let extractedData;
      try {
        // Look for JSON in the response (might be wrapped in markdown)
        const jsonMatch =
          extractionContent.match(/```json\s*(\{[\s\S]*\})\s*```/) ||
          extractionContent.match(/(\{[\s\S]*\})/);

        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[1]);
        } else {
          console.warn("No valid JSON found in extraction response");
          return;
        }
      } catch (parseError) {
        console.error("Failed to parse extraction JSON:", parseError);
        return;
      }

      // Store contexts
      if (extractedData.contexts && Array.isArray(extractedData.contexts)) {
        for (const contextData of extractedData.contexts) {
          if (
            contextData.key &&
            contextData.value &&
            contextData.confidence > 0.4
          ) {
            await userContextService.storeContext({
              ...contextData,
              userId,
              extractedFromConversationId: conversationId,
              extractedFromMessageId: messageId,
            });
          }
        }
      }

      // Store task suggestions
      if (
        extractedData.taskSuggestions &&
        Array.isArray(extractedData.taskSuggestions)
      ) {
        for (const taskData of extractedData.taskSuggestions) {
          if (taskData.title && taskData.confidence > 0.5) {
            await userContextService.storeTaskSuggestion({
              ...taskData,
              userId,
              extractedFromConversationId: conversationId,
              extractedFromMessageId: messageId,
            });
          }
        }
      }

      // Store event suggestions
      if (
        extractedData.eventSuggestions &&
        Array.isArray(extractedData.eventSuggestions)
      ) {
        for (const eventData of extractedData.eventSuggestions) {
          if (eventData.title && eventData.confidence > 0.5) {
            await userContextService.storeEventSuggestion({
              ...eventData,
              userId,
              extractedFromConversationId: conversationId,
              extractedFromMessageId: messageId,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error processing extraction results:", error);
    }
  }
}

export { AIService }
export const aiService = new AIService();
export default aiService;

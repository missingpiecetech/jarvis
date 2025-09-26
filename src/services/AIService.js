/**
 * AI Service
 * Handles AI API integration with support for multiple models/providers
 * Primary implementation uses Gemini Flash, but designed for easy switching
 */

class AIService {
  constructor() {
    this.currentProvider = 'gemini'
    this.models = {
      gemini: {
        flash: 'gemini-1.5-flash',
        pro: 'gemini-1.5-pro'
      }
    }
    this.defaultModel = this.models.gemini.flash
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models'
  }

  /**
   * Send a message to the AI and get a response
   */
  async sendMessage(messages, options = {}) {
    try {
      const model = options.model || this.defaultModel
      const temperature = options.temperature || 0.7
      const maxTokens = options.maxTokens || 2048

      switch (this.currentProvider) {
        case 'gemini':
          return await this.sendToGemini(messages, model, temperature, maxTokens)
        default:
          throw new Error(`Unsupported AI provider: ${this.currentProvider}`)
      }
    } catch (error) {
      console.error('AI Service Error:', error)
      return {
        success: false,
        error: error.message,
        content: 'I apologize, but I encountered an issue processing your request. Please try again.'
      }
    }
  }

  /**
   * Send message to Gemini API
   */
  async sendToGemini(messages, model, temperature, maxTokens) {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured')
    }

    // Convert messages to Gemini format
    const contents = this.formatMessagesForGemini(messages)

    const requestBody = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        topP: 0.95,
        topK: 64
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        }
      ]
    }

    const response = await fetch(`${this.baseURL}/${model}:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response generated from AI')
    }

    const candidate = data.candidates[0]
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('Response blocked by safety filters')
    }

    const content = candidate.content?.parts?.[0]?.text || ''
    
    return {
      success: true,
      content,
      model,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0
      }
    }
  }

  /**
   * Format messages for Gemini API
   */
  formatMessagesForGemini(messages) {
    return messages
      .filter(msg => msg.role !== 'system') // Gemini doesn't support system messages directly
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }))
  }

  /**
   * Get conversation context with recent messages
   */
  getConversationContext(messages, maxMessages = 10) {
    // Get recent messages for context
    const recentMessages = messages.slice(-maxMessages)
    
    // Add system prompt to provide context about the assistant
    const systemContext = {
      role: 'user',
      content: `You are Jarvis, a helpful personal assistant. You should be conversational, friendly, and helpful. Provide clear and concise responses while being personable. If you need clarification or more information to help better, don't hesitate to ask follow-up questions.`
    }

    return [systemContext, ...recentMessages]
  }

  /**
   * Switch AI provider/model
   */
  switchProvider(provider, model = null) {
    this.currentProvider = provider
    if (model) {
      this.defaultModel = model
    }
  }

  /**
   * Get available models for current provider
   */
  getAvailableModels() {
    return this.models[this.currentProvider] || {}
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      provider: this.currentProvider,
      model: this.defaultModel,
      hasApiKey: !!this.apiKey
    }
  }

  /**
   * Check if AI service is properly configured
   */
  isConfigured() {
    return !!this.apiKey
  }
}

export const aiService = new AIService()
export default aiService
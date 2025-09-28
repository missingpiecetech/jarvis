/**
 * AI Service
 * Handles AI API integration with support for multiple models/providers
 * Primary implementation uses Gemini Flash, but designed for easy switching
 * Enhanced with context extraction and task/event suggestion capabilities
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
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
    this.defaultModel = this.models.gemini.pro;
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    // Initialize Google Generative AI
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
  }

  /**
   * Get base system instructions for all AI responses
   */
  getBaseInstructions() {
    return `SYSTEM INSTRUCTIONS - Follow these at all times:
- Be concise, to the point, and unemotional
- Do not praise or thank the user
- Do not apologize or recommend the user consult an expert
- ALWAYS respond with valid JSON format

CAPABILITIES:
- Task management: Create, update, delete, and query tasks
- Event scheduling: Manage calendar events
- General assistance: Answer questions and provide information
- Context awareness: Reference user's tasks and schedule when relevant

ANALYSIS PROCESS:
1. Identify the user's intent (task management, event scheduling, questions, etc.)
2. Extract actionable items (tasks to create/update/delete, events to schedule, queries to run)
3. Determine if additional context is needed from the database
4. Provide appropriate response

Response Format:
Always respond with valid JSON in this structure:
{
  "response": "your response to the user. If actions are to be completed, ask for confirmation. If you are able to answer the question directly, do so.",
  "actions": [
    {
      "type": "CREATE_TASK" | "UPDATE_TASK" | "DELETE_TASK" | "READ_TASKS" | 
             "CREATE_EVENT" | "UPDATE_EVENT" | "DELETE_EVENT" | "READ_EVENTS" |
             "QUERY_CONTEXT" | "STORE_FACT",
      "params": {
        // Task params:
        "title": "string",
        "description": "string", 
        "priority": "low|medium|high|urgent",
        "dueDate": "YYYY-MM-DD",
        "tags": ["tag1", "tag2"],
        
        // Event params:
        "startDate": "YYYY-MM-DD HH:mm",
        "endDate": "YYYY-MM-DD HH:mm",
        "location": "string",
        
        // Search/filter params:
        "searchParams": {
          "title": "partial match",
          "status": "pending|in_progress|completed",
          "priority": "low|medium|high|urgent",
          "dueDate": "YYYY-MM-DD",
          "dueBefore": "YYYY-MM-DD",
          "dueAfter": "YYYY-MM-DD"
        },
        
        // Update params (for UPDATE actions):
        "updates": {
          "title": "new title",
          "priority": "new priority"
        }
      }
    }
  ],
  "needsContext": boolean, // true if you need database info before final response
  "contextQuery": "description of what context is needed",
  "metadata": {
    "intent": "task_management|event_scheduling|question|general",
    "confidence": 0.9
  }
}

Respond naturally while following the instructions above and maintaining JSON format.`;
  }

  /**
   * Process a complete conversation with the 5-step flow:
   * 1) Receive user message
   * 2) Send to gemini with instruction to recognize tasks, events, facts, questions, etc.
   * 3) Gather any necessary info/tasks using queries based on structured response
   * 4) If followup AI call is required, call LLM again with new context
   * 5) Respond to user
   */
  async processConversation(userMessage, userId, conversationId = null) {
    try {
      console.log("Processing conversation:", userMessage);

      // Step 1: Receive user message (already done)

      // Step 2: Send to Gemini for initial analysis
      const initialAnalysis = await this.sendMessage([
        {
          role: "user",
          content: userMessage,
        },
      ]);

      if (!initialAnalysis.success) {
        return {
          success: false,
          response: "I encountered an error processing your message.",
          actions: [],
        };
      }

      console.log("Raw AI response:", initialAnalysis.content);

      let analysisData;
      try {
        analysisData = JSON.parse(initialAnalysis.content);
        console.log("Parsed analysis data:", analysisData);
      } catch (error) {
        console.error("Error parsing initial analysis:", error);
        console.error("Failed to parse content:", initialAnalysis.content);
        return {
          success: false,
          response: "I had trouble understanding your request.",
          actions: [],
        };
      }

      // Step 3: Gather necessary context if needed
      let contextData = null;
      if (analysisData.needsContext && analysisData.actions?.length > 0) {
        contextData = await this.gatherContext(analysisData.actions, userId);
        console.log("Gathered context:", contextData);
      }

      // Step 4: If context was gathered, make followup AI call for final response
      let finalResponse = analysisData;
      if (contextData) {
        const contextPrompt = `Original user message: "${userMessage}"

Initial analysis: ${JSON.stringify(analysisData, null, 2)}

Context gathered from database:
${JSON.stringify(contextData, null, 2)}

Based on this context, provide your final response and any refined actions. 

IMPORTANT REFINEMENTS:
1. For DELETE operations: Create individual deletion actions for EACH item found, not a single bulk action
2. For READ operations: Execute immediately, no confirmation needed
3. For UPDATE operations: Show what items will be updated with their new values

Use the same JSON format as before.`;

        const followupResponse = await this.sendMessage([
          {
            role: "user",
            content: contextPrompt,
          },
        ]);

        if (followupResponse.success) {
          try {
            finalResponse = JSON.parse(followupResponse.content);
          } catch (error) {
            console.error("Error parsing followup response:", error);
            // Fallback to initial analysis
          }
        }
      }

      // Step 4.5: Process actions to create individual deletion cards and handle reads immediately
      let processedActions = finalResponse.actions || [];
      let executedResults = [];

      if (processedActions.length > 0) {
        const { processedActions: newActions, executedResults: execResults } =
          await this.processActionsForExecution(
            processedActions,
            userId,
            contextData
          );
        processedActions = newActions;
        executedResults = execResults;
      }

      // Step 5: Return final response
      const needsConfirmation = processedActions.some(
        (action) => !["READ_TASKS", "READ_EVENTS"].includes(action.type)
      );

      return {
        success: true,
        response: finalResponse.response || "I've processed your request.",
        actions: processedActions,
        executedResults,
        metadata: finalResponse.metadata || {},
        needsConfirmation,
      };
    } catch (error) {
      console.error("Error in processConversation:", error);
      return {
        success: false,
        response: "I encountered an error processing your message.",
        actions: [],
      };
    }
  }

  /**
   * Send a message to the AI and get a response with context extraction
   */
  async sendMessage(messages, options = {}) {
    console.log("AIService sendMessage called with options:", options);
    try {
      const model = options.model || this.defaultModel;
      const temperature = options.temperature || 0.7;
      const maxTokens = options.maxTokens || 2048;

      switch (this.currentProvider) {
        case "gemini":
          const response = await this.sendToGemini(
            messages,
            model,
            temperature,
            maxTokens
          );
          console.log("AI response:", JSON.parse(response.content));

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
   * Send message to Gemini API using Google Generative AI library
   */
  async sendToGemini(messages, model, temperature, maxTokens) {
    console.log("Sending to Gemini with model:", model);
    console.log("Messages:", messages);

    if (!this.genAI) {
      throw new Error("Gemini API key not configured");
    }

    try {
      // Get the generative model
      const genModel = this.genAI.getGenerativeModel({
        model,
        systemInstruction: {
          role: "system",
          parts: [{ text: this.getBaseInstructions() }],
        },
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          topP: 0.95,
          topK: 64,
          responseMimeType: "application/json",
        },
      });

      // Generate content - single message only
      // If multiple messages are passed, use the last one (most recent user message)
      const userMessage = messages[messages.length - 1];
      const result = await genModel.generateContent(userMessage.content);
      console.log("Gemini raw result:", result);
      const response = await result.response;
      const content = response.text();

      return {
        success: true,
        content,
        model,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw new Error(
        error.message || "Failed to generate response from Gemini"
      );
    }
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
   * Gather context from database based on actions identified by AI
   */
  async gatherContext(actions, userId) {
    const context = {
      tasks: [],
      events: [],
      userContext: [],
    };

    // Import services dynamically to avoid circular dependencies
    const { taskService } = await import("./TaskService.js");
    const { eventService } = await import("./EventService.js");

    for (const action of actions) {
      try {
        if (action.type.includes("TASK")) {
          // Query tasks based on search parameters
          if (action.params?.searchParams) {
            const tasks = await taskService.searchTasks(
              userId,
              action.params.searchParams
            );
            context.tasks.push(...tasks);
          } else if (action.type === "READ_TASKS") {
            // Get recent tasks for context
            const tasksResult = await taskService.getTasks(userId, {
              limit: 10,
            });
            if (tasksResult.success) {
              context.tasks.push(...tasksResult.data);
            }
          }
        } else if (action.type.includes("EVENT")) {
          // Query events based on search parameters
          if (action.params?.searchParams) {
            const events = await eventService.searchEvents(
              userId,
              action.params.searchParams
            );
            context.events.push(...events);
          } else if (action.type === "READ_EVENTS") {
            // Get recent events for context
            const eventsResult = await eventService.getEvents(userId, {
              limit: 10,
            });
            if (eventsResult.success) {
              context.events.push(...eventsResult.data);
            }
          }
        }
      } catch (error) {
        console.error(
          `Error gathering context for action ${action.type}:`,
          error
        );
      }
    }

    // Get relevant user context
    try {
      const userContextResult =
        await userContextService.getContextSummaryForPrompt(userId);
      if (userContextResult.success) {
        context.userContext = userContextResult.data;
      }
    } catch (error) {
      console.error("Error getting user context:", error);
    }

    return context;
  }

  /**
   * Process actions to create individual deletion cards and execute read operations immediately
   */
  async processActionsForExecution(actions, userId, contextData) {
    const processedActions = [];
    const executedResults = [];

    // Import services dynamically to avoid circular dependencies
    const { taskService } = await import("./TaskService.js");
    const { eventService } = await import("./EventService.js");

    for (const action of actions) {
      if (action.type === "READ_TASKS") {
        // Execute read operations immediately
        try {
          let tasks = [];
          if (action.params?.searchParams) {
            tasks = await taskService.getAll(
              userId,
              action.params.searchParams
            );
          } else {
            const result = await taskService.getAll(userId, { limit: 20 });
            tasks = result.success ? result.data : [];
          }

          executedResults.push({
            type: "READ_TASKS",
            success: true,
            data: tasks,
            count: tasks.length,
          });
        } catch (error) {
          executedResults.push({
            type: "READ_TASKS",
            success: false,
            error: error.message,
          });
        }
      } else if (action.type === "READ_EVENTS") {
        // Execute read operations immediately
        try {
          let events = [];
          if (action.params?.searchParams) {
            events = await eventService.searchEvents(
              userId,
              action.params.searchParams
            );
          } else {
            const result = await eventService.getEvents(userId, { limit: 20 });
            events = result.success ? result.data : [];
          }

          executedResults.push({
            type: "READ_EVENTS",
            success: true,
            data: events,
            count: events.length,
          });
        } catch (error) {
          executedResults.push({
            type: "READ_EVENTS",
            success: false,
            error: error.message,
          });
        }
      } else if (action.type === "DELETE_TASK" && action.params?.searchParams) {
        // Create individual deletion actions for each matching task
        try {
          const matchingTasks = await taskService.searchTasks(
            userId,
            action.params.searchParams
          );

          for (const task of matchingTasks) {
            processedActions.push({
              type: "DELETE_TASK",
              params: { id: task.id },
              item: task,
              description: `Delete task: "${task.title}"`,
            });
          }
        } catch (error) {
          console.error("Error processing DELETE_TASK action:", error);
          processedActions.push(action); // Keep original if processing fails
        }
      } else if (
        action.type === "DELETE_EVENT" &&
        action.params?.searchParams
      ) {
        // Create individual deletion actions for each matching event
        try {
          const matchingEvents = await eventService.searchEvents(
            userId,
            action.params.searchParams
          );

          for (const event of matchingEvents) {
            processedActions.push({
              type: "DELETE_EVENT",
              params: { id: event.id },
              item: event,
              description: `Delete event: "${event.title}"`,
            });
          }
        } catch (error) {
          console.error("Error processing DELETE_EVENT action:", error);
          processedActions.push(action); // Keep original if processing fails
        }
      } else if (action.type === "UPDATE_TASK" && action.params?.searchParams) {
        // Create individual update actions for each matching task
        try {
          const matchingTasks = await taskService.searchTasks(
            userId,
            action.params.searchParams
          );

          for (const task of matchingTasks) {
            processedActions.push({
              type: "UPDATE_TASK",
              params: {
                id: task.id,
                updates: action.params.updates,
              },
              item: task,
              description: `Update task: "${task.title}"`,
            });
          }
        } catch (error) {
          console.error("Error processing UPDATE_TASK action:", error);
          processedActions.push(action); // Keep original if processing fails
        }
      } else if (
        action.type === "UPDATE_EVENT" &&
        action.params?.searchParams
      ) {
        // Create individual update actions for each matching event
        try {
          const matchingEvents = await eventService.searchEvents(
            userId,
            action.params.searchParams
          );

          for (const event of matchingEvents) {
            processedActions.push({
              type: "UPDATE_EVENT",
              params: {
                id: event.id,
                updates: action.params.updates,
              },
              item: event,
              description: `Update event: "${event.title}"`,
            });
          }
        } catch (error) {
          console.error("Error processing UPDATE_EVENT action:", error);
          processedActions.push(action); // Keep original if processing fails
        }
      } else {
        // Keep other actions as-is
        processedActions.push(action);
      }
    }

    return { processedActions, executedResults };
  }

  /**
   * Execute confirmed actions
   */
  async executeActions(actions, userId) {
    const results = [];

    // Import services dynamically to avoid circular dependencies
    const { taskService } = await import("./TaskService.js");
    const { eventService } = await import("./EventService.js");

    for (const action of actions) {
      try {
        let result = { action: action.type, success: false };

        switch (action.type) {
          case "CREATE_TASK":
            console.log("Creating task with params:", action.params);
            console.log("Current user ID:", userId);
            const taskResult = await taskService.create(action.params);
            console.log("Task creation result:", taskResult);
            result.data = taskResult;
            result.success = taskResult.success;
            break;

          case "UPDATE_TASK":
            if (action.params.id && action.params.updates) {
              // Individual task update
              const updateResult = await taskService.update(
                action.params.id,
                action.params.updates
              );
              result.data = updateResult;
              result.success = updateResult.success;
            } else if (action.params.searchParams && action.params.updates) {
              // Search-based update (legacy support)
              const updateResult = await taskService.updateTasksBySearch(
                userId,
                action.params.searchParams,
                action.params.updates
              );
              result.data = updateResult;
              result.success = updateResult.success;
            } else {
              result.error = "Missing required parameters for task update";
            }
            break;

          case "DELETE_TASK":
            if (action.params.id) {
              // Individual task deletion
              const deleteResult = await taskService.delete(action.params.id);
              result.data = deleteResult;
              result.success = deleteResult.success;
            } else if (action.params.searchParams) {
              // Search-based delete (legacy support)
              const deleteResult = await taskService.deleteTasksBySearch(
                userId,
                action.params.searchParams
              );
              result.data = deleteResult;
              result.success = deleteResult.success;
            } else {
              result.error = "Missing required parameters for task deletion";
            }
            break;

          case "CREATE_EVENT":
            console.log("Creating event with params:", action.params);
            console.log("Current user ID:", userId);
            const eventResult = await eventService.create(action.params);
            console.log("Event creation result:", eventResult);
            result.data = eventResult;
            result.success = eventResult.success;
            break;

          case "UPDATE_EVENT":
            if (action.params.id && action.params.updates) {
              // Individual event update
              const updateResult = await eventService.update(
                action.params.id,
                action.params.updates
              );
              result.data = updateResult;
              result.success = updateResult.success;
            } else if (action.params.searchParams && action.params.updates) {
              // Search-based update (legacy support)
              const updateResult = await eventService.updateEventsBySearch(
                userId,
                action.params.searchParams,
                action.params.updates
              );
              result.data = updateResult;
              result.success = updateResult.success;
            } else {
              result.error = "Missing required parameters for event update";
            }
            break;

          case "DELETE_EVENT":
            if (action.params.id) {
              // Individual event deletion
              const deleteResult = await eventService.delete(action.params.id);
              result.data = deleteResult;
              result.success = deleteResult.success;
            } else if (action.params.searchParams) {
              // Search-based delete (legacy support)
              const deleteResult = await eventService.deleteEventsBySearch(
                userId,
                action.params.searchParams
              );
              result.data = deleteResult;
              result.success = deleteResult.success;
            } else {
              result.error = "Missing required parameters for event deletion";
            }
            break;

          case "STORE_FACT":
            if (action.params.key && action.params.value) {
              result.data = await userContextService.storeContext({
                ...action.params,
                userId,
                type: action.params.type || "fact",
                category: action.params.category || "general",
                confidence: action.params.confidence || 0.9,
              });
              result.success = true;
            }
            break;

          default:
            result.error = `Unknown action type: ${action.type}`;
        }

        results.push(result);
      } catch (error) {
        console.error(`Error executing action ${action.type}:`, error);
        results.push({
          action: action.type,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }
}

export const aiService = new AIService();
export default aiService;

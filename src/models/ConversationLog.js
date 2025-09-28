/**
 * ConversationLog data model
 * Represents conversation logs with AI assistant
 */
export class ConversationLog {
  constructor(data = {}) {
    this.id = data.id || null;
    this.sessionId = data.sessionId || null; // Groups messages in a conversation session
    this.messages = data.messages || []; // Array of Message objects
    this.title = data.title || ""; // Conversation title/summary
    this.userId = data.userId || null;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.metadata = data.metadata || {}; // Additional conversation metadata
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    this.lastMessageAt = data.lastMessageAt
      ? new Date(data.lastMessageAt)
      : null;
  }

  /**
   * Create a ConversationLog instance from PocketBase record
   */
  static fromPocketBase(record) {
    return new ConversationLog({
      id: record.id,
      sessionId: record.session_id,
      messages: record.messages ? JSON.parse(record.messages) : [],
      title: record.title,
      userId: record.user_id,
      isActive: record.is_active,
      metadata: record.metadata ? JSON.parse(record.metadata) : {},
      createdAt: record.created,
      updatedAt: record.updated,
      lastMessageAt: record.last_message_at,
    });
  }

  /**
   * Convert ConversationLog instance to PocketBase format
   */
  toPocketBase() {
    return {
      session_id: this.sessionId,
      messages: JSON.stringify(this.messages),
      title: this.title,
      user_id: this.userId,
      is_active: this.isActive,
      metadata: JSON.stringify(this.metadata),
      last_message_at: this.lastMessageAt
        ? this.lastMessageAt.toISOString()
        : null,
    };
  }

  /**
   * Add a message to the conversation
   */
  addMessage(message) {
    const messageObj = new Message(message);
    this.messages.push(messageObj);
    this.lastMessageAt = messageObj.timestamp;
    this.updatedAt = new Date();

    // Auto-generate title from first user message if not set
    if (!this.title && messageObj.role === "user" && messageObj.content) {
      this.title = this.generateTitle(messageObj.content);
    }

    return messageObj;
  }

  /**
   * Get the last message in the conversation
   */
  getLastMessage() {
    return this.messages.length > 0
      ? this.messages[this.messages.length - 1]
      : null;
  }

  /**
   * Get messages by role (user, assistant, system)
   */
  getMessagesByRole(role) {
    return this.messages.filter((message) => message.role === role);
  }

  /**
   * Get conversation summary
   */
  getSummary() {
    const userMessages = this.getMessagesByRole("user").length;
    const assistantMessages = this.getMessagesByRole("assistant").length;
    const totalMessages = this.messages.length;

    return {
      totalMessages,
      userMessages,
      assistantMessages,
      duration: this.getDuration(),
      lastActivity: this.lastMessageAt,
    };
  }

  /**
   * Get conversation duration in minutes
   */
  getDuration() {
    if (!this.lastMessageAt) return 0;
    return Math.round((this.lastMessageAt - this.createdAt) / (1000 * 60));
  }

  /**
   * Generate a title from the first message content
   */
  generateTitle(content) {
    // Take first 50 characters and add ellipsis if longer
    const title = content.trim().substring(0, 50);
    return title.length < content.trim().length ? title + "..." : title;
  }

  /**
   * Search messages by content
   */
  searchMessages(query) {
    const lowercaseQuery = query.toLowerCase();
    return this.messages.filter((message) =>
      message.content.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * Export conversation to text format
   */
  exportToText() {
    let text = `Conversation: ${this.title}\n`;
    text += `Created: ${this.createdAt.toLocaleString()}\n`;
    text += `Last Updated: ${this.updatedAt.toLocaleString()}\n`;
    text += "=".repeat(50) + "\n\n";

    this.messages.forEach((message) => {
      text += `[${message.timestamp.toLocaleString()}] ${message.role.toUpperCase()}:\n`;
      text += `${message.content}\n\n`;
    });

    return text;
  }

  /**
   * Close/deactivate the conversation
   */
  close() {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  /**
   * Reopen/activate the conversation
   */
  reopen() {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  /**
   * Validate conversation log data
   */
  validate() {
    const errors = [];

    if (!this.sessionId?.trim()) {
      errors.push("Session ID is required");
    }

    if (!Array.isArray(this.messages)) {
      errors.push("Messages must be an array");
    }

    // Validate each message
    this.messages.forEach((message, index) => {
      const messageErrors = new Message(message).validate();
      messageErrors.forEach((error) => {
        errors.push(`Message ${index + 1}: ${error}`);
      });
    });

    return errors;
  }
}

/**
 * Message class for individual messages within a conversation
 */
export class Message {
  constructor(data = {}) {
    this.id = data.id || null;
    this.role = data.role || "user"; // user, assistant, system
    this.content = data.content || "";
    this.timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    this.metadata = data.metadata || {}; // Additional message metadata (tokens, model, etc.)
    this.isError = data.isError || false;
    this.tokens = data.tokens || null; // Token count for AI messages
    this.model = data.model || null; // AI model used (for assistant messages)
    this.attachments = data.attachments || []; // File attachments

    // Chat interface properties
    this.actions = data.actions || []; // Actions to be confirmed/executed
    this.isCommand = data.isCommand || false; // Whether this message contains commands
    this.needsConfirmation = data.needsConfirmation || false; // Whether actions need confirmation
    this.isWelcome = data.isWelcome || false; // Whether this is a welcome message
    this.visualElements = data.visualElements || []; // Visual elements for display
  }

  /**
   * Create a Message instance from data
   */
  static fromData(data) {
    return new Message(data);
  }

  /**
   * Convert Message to plain object
   */
  toObject() {
    return {
      id: this.id,
      role: this.role,
      content: this.content,
      timestamp: this.timestamp.toISOString(),
      metadata: this.metadata,
      isError: this.isError,
      tokens: this.tokens,
      model: this.model,
      attachments: this.attachments,
      actions: this.actions,
      isCommand: this.isCommand,
      needsConfirmation: this.needsConfirmation,
      isWelcome: this.isWelcome,
      visualElements: this.visualElements,
    };
  }

  /**
   * Get message word count
   */
  getWordCount() {
    return this.content.split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Get message character count
   */
  getCharacterCount() {
    return this.content.length;
  }

  /**
   * Check if message contains attachments
   */
  hasAttachments() {
    return this.attachments && this.attachments.length > 0;
  }

  /**
   * Add attachment to message
   */
  addAttachment(attachment) {
    this.attachments.push(attachment);
  }

  /**
   * Validate message data
   */
  validate() {
    const errors = [];

    const validRoles = ["user", "assistant", "system"];
    if (!validRoles.includes(this.role)) {
      errors.push("Role must be one of: " + validRoles.join(", "));
    }

    if (!this.content?.trim()) {
      errors.push("Content is required");
    }

    if (!this.timestamp || isNaN(this.timestamp.getTime())) {
      errors.push("Valid timestamp is required");
    }

    return errors;
  }
}

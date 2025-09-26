/**
 * UserPreferences data model
 * Represents user settings and preferences
 */
export class UserPreferences {
  constructor(data = {}) {
    this.id = data.id || null
    this.userId = data.userId || null
    
    // General preferences
    this.theme = data.theme || 'light' // light, dark, auto
    this.language = data.language || 'en'
    this.timezone = data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    this.dateFormat = data.dateFormat || 'MM/DD/YYYY'
    this.timeFormat = data.timeFormat || '12h' // 12h, 24h
    this.currency = data.currency || 'USD'
    
    // Notification preferences
    this.notifications = {
      email: data.notifications?.email !== undefined ? data.notifications.email : true,
      push: data.notifications?.push !== undefined ? data.notifications.push : true,
      sms: data.notifications?.sms !== undefined ? data.notifications.sms : false,
      inApp: data.notifications?.inApp !== undefined ? data.notifications.inApp : true,
      taskReminders: data.notifications?.taskReminders !== undefined ? data.notifications.taskReminders : true,
      eventReminders: data.notifications?.eventReminders !== undefined ? data.notifications.eventReminders : true,
      dailyDigest: data.notifications?.dailyDigest !== undefined ? data.notifications.dailyDigest : true,
      weeklyReport: data.notifications?.weeklyReport !== undefined ? data.notifications.weeklyReport : false,
      ...data.notifications
    }
    
    // Work preferences
    this.workPreferences = {
      workingHours: {
        start: data.workPreferences?.workingHours?.start || '09:00',
        end: data.workPreferences?.workingHours?.end || '17:00'
      },
      workingDays: data.workPreferences?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      businessType: data.workPreferences?.businessType || '',
      defaultTaskPriority: data.workPreferences?.defaultTaskPriority || 'medium',
      autoScheduleBreaks: data.workPreferences?.autoScheduleBreaks !== undefined ? data.workPreferences.autoScheduleBreaks : true,
      focusMode: data.workPreferences?.focusMode !== undefined ? data.workPreferences.focusMode : false,
      pomodoroTimer: data.workPreferences?.pomodoroTimer !== undefined ? data.workPreferences.pomodoroTimer : 25,
      ...data.workPreferences
    }
    
    // Calendar preferences
    this.calendarPreferences = {
      defaultCalendar: data.calendarPreferences?.defaultCalendar || null,
      defaultEventDuration: data.calendarPreferences?.defaultEventDuration || 60,
      defaultReminders: data.calendarPreferences?.defaultReminders || [15], // Minutes before event
      weekStartsOn: data.calendarPreferences?.weekStartsOn || 'Monday',
      showWeekends: data.calendarPreferences?.showWeekends !== undefined ? data.calendarPreferences.showWeekends : true,
      timeSlotDuration: data.calendarPreferences?.timeSlotDuration || 30,
      autoAcceptMeetings: data.calendarPreferences?.autoAcceptMeetings !== undefined ? data.calendarPreferences.autoAcceptMeetings : false,
      bufferTime: data.calendarPreferences?.bufferTime || 15,
      ...data.calendarPreferences
    }
    
    // AI assistant preferences
    this.aiPreferences = {
      responseStyle: data.aiPreferences?.responseStyle || 'balanced', // concise, balanced, detailed
      personality: data.aiPreferences?.personality || 'professional', // casual, professional, friendly
      proactiveReminders: data.aiPreferences?.proactiveReminders !== undefined ? data.aiPreferences.proactiveReminders : true,
      contextAwareness: data.aiPreferences?.contextAwareness !== undefined ? data.aiPreferences.contextAwareness : true,
      learningMode: data.aiPreferences?.learningMode !== undefined ? data.aiPreferences.learningMode : true,
      suggestTasks: data.aiPreferences?.suggestTasks !== undefined ? data.aiPreferences.suggestTasks : true,
      suggestOptimizations: data.aiPreferences?.suggestOptimizations !== undefined ? data.aiPreferences.suggestOptimizations : true,
      ...data.aiPreferences
    }
    
    // Privacy and security preferences
    this.privacyPreferences = {
      dataRetention: data.privacyPreferences?.dataRetention || '1year', // 30days, 90days, 1year, forever
      shareAnalytics: data.privacyPreferences?.shareAnalytics !== undefined ? data.privacyPreferences.shareAnalytics : true,
      shareUsageData: data.privacyPreferences?.shareUsageData !== undefined ? data.privacyPreferences.shareUsageData : false,
      twoFactorAuth: data.privacyPreferences?.twoFactorAuth !== undefined ? data.privacyPreferences.twoFactorAuth : false,
      sessionTimeout: data.privacyPreferences?.sessionTimeout || 24, // Hours
      ...data.privacyPreferences
    }
    
    // Integration preferences
    this.integrations = {
      calendar: data.integrations?.calendar || 'None',
      email: data.integrations?.email || 'None',
      cloudStorage: data.integrations?.cloudStorage || 'None',
      taskManagement: data.integrations?.taskManagement || 'None',
      communicationTools: data.integrations?.communicationTools || [],
      ...data.integrations
    }
    
    // Custom preferences (extensible)
    this.customPreferences = data.customPreferences || {}
    
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date()
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date()
  }

  /**
   * Create a UserPreferences instance from PocketBase record
   */
  static fromPocketBase(record) {
    return new UserPreferences({
      id: record.id,
      userId: record.user_id,
      theme: record.theme,
      language: record.language,
      timezone: record.timezone,
      dateFormat: record.date_format,
      timeFormat: record.time_format,
      currency: record.currency,
      notifications: record.notifications ? JSON.parse(record.notifications) : {},
      workPreferences: record.work_preferences ? JSON.parse(record.work_preferences) : {},
      calendarPreferences: record.calendar_preferences ? JSON.parse(record.calendar_preferences) : {},
      aiPreferences: record.ai_preferences ? JSON.parse(record.ai_preferences) : {},
      privacyPreferences: record.privacy_preferences ? JSON.parse(record.privacy_preferences) : {},
      integrations: record.integrations ? JSON.parse(record.integrations) : {},
      customPreferences: record.custom_preferences ? JSON.parse(record.custom_preferences) : {},
      createdAt: record.created,
      updatedAt: record.updated
    })
  }

  /**
   * Convert UserPreferences instance to PocketBase format
   */
  toPocketBase() {
    return {
      user_id: this.userId,
      theme: this.theme,
      language: this.language,
      timezone: this.timezone,
      date_format: this.dateFormat,
      time_format: this.timeFormat,
      currency: this.currency,
      notifications: JSON.stringify(this.notifications),
      work_preferences: JSON.stringify(this.workPreferences),
      calendar_preferences: JSON.stringify(this.calendarPreferences),
      ai_preferences: JSON.stringify(this.aiPreferences),
      privacy_preferences: JSON.stringify(this.privacyPreferences),
      integrations: JSON.stringify(this.integrations),
      custom_preferences: JSON.stringify(this.customPreferences)
    }
  }

  /**
   * Update a specific preference category
   */
  updateCategory(category, updates) {
    if (this[category] && typeof this[category] === 'object') {
      this[category] = { ...this[category], ...updates }
      this.updatedAt = new Date()
    }
  }

  /**
   * Get notification preferences for a specific type
   */
  getNotificationSetting(type) {
    return this.notifications[type] !== undefined ? this.notifications[type] : true
  }

  /**
   * Update notification preference
   */
  setNotificationSetting(type, enabled) {
    this.notifications[type] = enabled
    this.updatedAt = new Date()
  }

  /**
   * Check if user is currently in working hours
   */
  isInWorkingHours(date = new Date()) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
    if (!this.workPreferences.workingDays.includes(dayName)) {
      return false
    }
    
    const currentTime = date.toTimeString().slice(0, 5) // HH:MM format
    return currentTime >= this.workPreferences.workingHours.start && 
           currentTime <= this.workPreferences.workingHours.end
  }

  /**
   * Get next working day
   */
  getNextWorkingDay(startDate = new Date()) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + 1)
    
    while (true) {
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
      if (this.workPreferences.workingDays.includes(dayName)) {
        return date
      }
      date.setDate(date.getDate() + 1)
    }
  }

  /**
   * Format date according to user preference
   */
  formatDate(date) {
    const d = new Date(date)
    const format = this.dateFormat
    
    const day = d.getDate().toString().padStart(2, '0')
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const year = d.getFullYear().toString()
    
    return format
      .replace('DD', day)
      .replace('MM', month)
      .replace('YYYY', year)
      .replace('YY', year.slice(-2))
  }

  /**
   * Format time according to user preference
   */
  formatTime(date) {
    const d = new Date(date)
    if (this.timeFormat === '24h') {
      return d.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    } else {
      return d.toLocaleTimeString('en-US', { 
        hour12: true, 
        hour: 'numeric', 
        minute: '2-digit' 
      })
    }
  }

  /**
   * Get default reminder times for events
   */
  getDefaultReminders() {
    return this.calendarPreferences.defaultReminders.map(minutes => ({
      method: 'popup',
      minutes: minutes
    }))
  }

  /**
   * Check if feature is enabled based on preferences
   */
  isFeatureEnabled(category, feature) {
    return this[category] && this[category][feature] === true
  }

  /**
   * Export preferences to JSON
   */
  exportToJSON() {
    return {
      theme: this.theme,
      language: this.language,
      timezone: this.timezone,
      dateFormat: this.dateFormat,
      timeFormat: this.timeFormat,
      currency: this.currency,
      notifications: this.notifications,
      workPreferences: this.workPreferences,
      calendarPreferences: this.calendarPreferences,
      aiPreferences: this.aiPreferences,
      privacyPreferences: this.privacyPreferences,
      integrations: this.integrations,
      customPreferences: this.customPreferences
    }
  }

  /**
   * Import preferences from JSON
   */
  importFromJSON(jsonData) {
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData
    
    Object.keys(data).forEach(key => {
      if (this.hasOwnProperty(key) && key !== 'id' && key !== 'userId') {
        this[key] = data[key]
      }
    })
    
    this.updatedAt = new Date()
  }

  /**
   * Reset preferences to defaults
   */
  resetToDefaults() {
    const defaultPrefs = new UserPreferences({ userId: this.userId })
    Object.keys(defaultPrefs).forEach(key => {
      if (key !== 'id' && key !== 'userId' && key !== 'createdAt') {
        this[key] = defaultPrefs[key]
      }
    })
    this.updatedAt = new Date()
  }

  /**
   * Validate preferences data
   */
  validate() {
    const errors = []
    
    const validThemes = ['light', 'dark', 'auto']
    if (!validThemes.includes(this.theme)) {
      errors.push('Theme must be one of: ' + validThemes.join(', '))
    }
    
    const validTimeFormats = ['12h', '24h']
    if (!validTimeFormats.includes(this.timeFormat)) {
      errors.push('Time format must be one of: ' + validTimeFormats.join(', '))
    }
    
    const validPriorities = ['low', 'medium', 'high', 'urgent']
    if (!validPriorities.includes(this.workPreferences.defaultTaskPriority)) {
      errors.push('Default task priority must be one of: ' + validPriorities.join(', '))
    }
    
    const validResponseStyles = ['concise', 'balanced', 'detailed']
    if (!validResponseStyles.includes(this.aiPreferences.responseStyle)) {
      errors.push('AI response style must be one of: ' + validResponseStyles.join(', '))
    }
    
    const validPersonalities = ['casual', 'professional', 'friendly']
    if (!validPersonalities.includes(this.aiPreferences.personality)) {
      errors.push('AI personality must be one of: ' + validPersonalities.join(', '))
    }
    
    return errors
  }
}
/**
 * Document data model
 * Represents file information and references for document management
 */
export class Document {
  constructor(data = {}) {
    this.id = data.id || null
    this.name = data.name || ''
    this.originalName = data.originalName || ''
    this.description = data.description || ''
    this.fileType = data.fileType || '' // pdf, doc, txt, jpg, etc.
    this.mimeType = data.mimeType || ''
    this.size = data.size || 0 // File size in bytes
    this.url = data.url || '' // File URL/path
    this.thumbnailUrl = data.thumbnailUrl || '' // Thumbnail URL for images/PDFs
    this.tags = data.tags || [] // Array of strings for categorization
    this.category = data.category || 'general' // general, invoice, contract, receipt, etc.
    this.isPublic = data.isPublic || false
    this.isArchived = data.isArchived || false
    this.userId = data.userId || null
    this.folderId = data.folderId || null // For organizing documents in folders
    this.version = data.version || 1 // Document version number
    this.checksum = data.checksum || '' // File integrity checksum
    this.metadata = data.metadata || {} // Additional file metadata
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date()
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date()
    this.accessedAt = data.accessedAt ? new Date(data.accessedAt) : null
    this.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null
  }

  /**
   * Create a Document instance from PocketBase record
   */
  static fromPocketBase(record) {
    return new Document({
      id: record.id,
      name: record.name,
      originalName: record.original_name,
      description: record.description,
      fileType: record.file_type,
      mimeType: record.mime_type,
      size: record.size,
      url: record.url,
      thumbnailUrl: record.thumbnail_url,
      tags: record.tags || [],
      category: record.category,
      isPublic: record.is_public,
      isArchived: record.is_archived,
      userId: record.user_id,
      folderId: record.folder_id,
      version: record.version,
      checksum: record.checksum,
      metadata: record.metadata ? JSON.parse(record.metadata) : {},
      createdAt: record.created,
      updatedAt: record.updated,
      accessedAt: record.accessed_at,
      expiresAt: record.expires_at
    })
  }

  /**
   * Convert Document instance to PocketBase format
   */
  toPocketBase() {
    return {
      name: this.name,
      original_name: this.originalName,
      description: this.description,
      file_type: this.fileType,
      mime_type: this.mimeType,
      size: this.size,
      url: this.url,
      thumbnail_url: this.thumbnailUrl,
      tags: this.tags,
      category: this.category,
      is_public: this.isPublic,
      is_archived: this.isArchived,
      user_id: this.userId,
      folder_id: this.folderId,
      version: this.version,
      checksum: this.checksum,
      metadata: JSON.stringify(this.metadata),
      accessed_at: this.accessedAt ? this.accessedAt.toISOString() : null,
      expires_at: this.expiresAt ? this.expiresAt.toISOString() : null
    }
  }

  /**
   * Get human-readable file size
   */
  getFormattedSize() {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = this.size
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  /**
   * Check if document is an image
   */
  isImage() {
    return this.mimeType?.startsWith('image/') || 
           ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(this.fileType.toLowerCase())
  }

  /**
   * Check if document is a PDF
   */
  isPDF() {
    return this.mimeType === 'application/pdf' || this.fileType.toLowerCase() === 'pdf'
  }

  /**
   * Check if document is a text document
   */
  isTextDocument() {
    const textTypes = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/rtf',
      'application/rtf'
    ]
    const textExtensions = ['doc', 'docx', 'txt', 'rtf', 'md']
    
    return textTypes.includes(this.mimeType) || 
           textExtensions.includes(this.fileType.toLowerCase())
  }

  /**
   * Check if document is a spreadsheet
   */
  isSpreadsheet() {
    const spreadsheetTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ]
    const spreadsheetExtensions = ['xls', 'xlsx', 'csv']
    
    return spreadsheetTypes.includes(this.mimeType) ||
           spreadsheetExtensions.includes(this.fileType.toLowerCase())
  }

  /**
   * Check if document is expired
   */
  isExpired() {
    return this.expiresAt && this.expiresAt < new Date()
  }

  /**
   * Mark document as accessed
   */
  markAsAccessed() {
    this.accessedAt = new Date()
    this.updatedAt = new Date()
  }

  /**
   * Archive the document
   */
  archive() {
    this.isArchived = true
    this.updatedAt = new Date()
  }

  /**
   * Unarchive the document
   */
  unarchive() {
    this.isArchived = false
    this.updatedAt = new Date()
  }

  /**
   * Get file icon name based on file type
   */
  getIconName() {
    if (this.isImage()) return 'image'
    if (this.isPDF()) return 'picture_as_pdf'
    if (this.isTextDocument()) return 'description'
    if (this.isSpreadsheet()) return 'table_chart'
    
    const iconMap = {
      zip: 'archive',
      rar: 'archive',
      '7z': 'archive',
      mp4: 'movie',
      avi: 'movie',
      mov: 'movie',
      mp3: 'audiotrack',
      wav: 'audiotrack',
      json: 'code',
      js: 'code',
      html: 'code',
      css: 'code',
      xml: 'code'
    }
    
    return iconMap[this.fileType.toLowerCase()] || 'insert_drive_file'
  }

  /**
   * Generate search keywords for the document
   */
  getSearchKeywords() {
    const keywords = new Set()
    
    // Add name words
    this.name.split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.add(word.toLowerCase())
    })
    
    // Add original name words
    this.originalName.split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.add(word.toLowerCase())
    })
    
    // Add description words
    this.description.split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.add(word.toLowerCase())
    })
    
    // Add tags
    this.tags.forEach(tag => keywords.add(tag.toLowerCase()))
    
    // Add category
    keywords.add(this.category.toLowerCase())
    
    // Add file type
    keywords.add(this.fileType.toLowerCase())
    
    return Array.from(keywords)
  }

  /**
   * Validate document data
   */
  validate() {
    const errors = []
    
    if (!this.name?.trim()) {
      errors.push('Name is required')
    }
    
    if (!this.fileType?.trim()) {
      errors.push('File type is required')
    }
    
    if (this.size < 0) {
      errors.push('File size cannot be negative')
    }
    
    if (!this.url?.trim()) {
      errors.push('File URL is required')
    }
    
    const validCategories = [
      'general', 'invoice', 'contract', 'receipt', 'tax', 
      'legal', 'personal', 'business', 'project', 'reference'
    ]
    if (!validCategories.includes(this.category)) {
      errors.push('Category must be one of: ' + validCategories.join(', '))
    }
    
    return errors
  }
}
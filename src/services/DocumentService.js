/**
 * Document Service
 * Handles CRUD operations for documents with PocketBase backend and local caching
 */
import { Document } from 'src/models'
import { pocketbaseService } from './pocketbase.js'
import { cacheService } from './cache.js'

class DocumentService {
  constructor() {
    this.collection = 'documents'
    this.cacheKey = 'jarvis_documents'
  }

  /**
   * Create a new document
   */
  async create(documentData) {
    try {
      const document = new Document(documentData)
      const errors = document.validate()
      
      if (errors.length > 0) {
        return { success: false, error: errors.join(', ') }
      }

      // Try to create in PocketBase first
      let result
      if (pocketbaseService.isAuthenticated()) {
        result = await pocketbaseService.create(this.collection, document.toPocketBase())
        
        if (result.success) {
          document.id = result.data.id
          document.createdAt = new Date(result.data.created)
          document.updatedAt = new Date(result.data.updated)
        }
      } else {
        // Offline mode - generate local ID
        document.id = 'local_' + Date.now()
        result = { success: true, data: document }
      }

      // Cache the document locally
      await this.cacheDocument(document)
      
      return { success: true, data: document }
    } catch (error) {
      console.error('Error creating document:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Upload and create document from file
   */
  async uploadAndCreate(file, metadata = {}) {
    try {
      // Create document record first
      const documentData = {
        name: metadata.name || file.name,
        originalName: file.name,
        description: metadata.description || '',
        fileType: file.name.split('.').pop() || '',
        mimeType: file.type,
        size: file.size,
        category: metadata.category || 'general',
        tags: metadata.tags || [],
        userId: pocketbaseService.getCurrentUser()?.id
      }

      const createResult = await this.create(documentData)
      if (!createResult.success) {
        return createResult
      }

      const document = createResult.data

      // Upload file to PocketBase if online
      if (pocketbaseService.isAuthenticated() && !document.id.startsWith('local_')) {
        const uploadResult = await pocketbaseService.uploadFile(
          this.collection, 
          document.id, 
          'file', 
          file
        )

        if (uploadResult.success) {
          // Update document with file URL
          document.url = pocketbaseService.getFileUrl(uploadResult.data, uploadResult.data.file)
          await this.cacheDocument(document)
        }
      } else {
        // Store file data locally for offline mode (base64 for small files)
        if (file.size < 5 * 1024 * 1024) { // 5MB limit for base64 storage
          const reader = new FileReader()
          const fileData = await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result)
            reader.readAsDataURL(file)
          })
          document.url = fileData
          await this.cacheDocument(document)
        }
      }

      return { success: true, data: document }
    } catch (error) {
      console.error('Error uploading document:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get document by ID
   */
  async get(id) {
    try {
      // Try cache first
      const cachedDocument = await cacheService.get(`${this.cacheKey}_${id}`)
      if (cachedDocument) {
        return { success: true, data: new Document(cachedDocument) }
      }

      // Try PocketBase
      if (pocketbaseService.isAuthenticated()) {
        const result = await pocketbaseService.get(this.collection, id)
        if (result.success) {
          const document = Document.fromPocketBase(result.data)
          // Set file URL if available
          if (result.data.file) {
            document.url = pocketbaseService.getFileUrl(result.data, result.data.file)
          }
          await this.cacheDocument(document)
          return { success: true, data: document }
        }
      }

      return { success: false, error: 'Document not found' }
    } catch (error) {
      console.error('Error getting document:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get all documents for current user
   */
  async getAll(filters = {}) {
    try {
      let documents = []

      // Try PocketBase first
      if (pocketbaseService.isAuthenticated()) {
        const currentUser = pocketbaseService.getCurrentUser()
        const filter = `user_id = "${currentUser.id}"`
        const result = await pocketbaseService.getAll(this.collection, filter, '-created')
        
        if (result.success) {
          documents = result.data.map(record => {
            const document = Document.fromPocketBase(record)
            // Set file URL if available
            if (record.file) {
              document.url = pocketbaseService.getFileUrl(record, record.file)
            }
            return document
          })
          // Update cache
          await this.cacheDocuments(documents)
        }
      }

      // Fallback to cache if PocketBase fails or offline
      if (documents.length === 0) {
        const cachedDocuments = await cacheService.get(this.cacheKey) || []
        documents = cachedDocuments.map(documentData => new Document(documentData))
      }

      // Apply filters
      documents = this.applyFilters(documents, filters)

      return { success: true, data: documents }
    } catch (error) {
      console.error('Error getting documents:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Update document
   */
  async update(id, updates) {
    try {
      // Get existing document
      const existingResult = await this.get(id)
      if (!existingResult.success) {
        return existingResult
      }

      const document = existingResult.data
      Object.assign(document, updates)
      document.updatedAt = new Date()

      const errors = document.validate()
      if (errors.length > 0) {
        return { success: false, error: errors.join(', ') }
      }

      // Try to update in PocketBase
      if (pocketbaseService.isAuthenticated() && !id.startsWith('local_')) {
        const result = await pocketbaseService.update(this.collection, id, document.toPocketBase())
        if (result.success) {
          document.updatedAt = new Date(result.data.updated)
        }
      }

      // Update cache
      await this.cacheDocument(document)

      return { success: true, data: document }
    } catch (error) {
      console.error('Error updating document:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete document
   */
  async delete(id) {
    try {
      // Try to delete from PocketBase
      if (pocketbaseService.isAuthenticated() && !id.startsWith('local_')) {
        await pocketbaseService.delete(this.collection, id)
      }

      // Remove from cache
      await cacheService.remove(`${this.cacheKey}_${id}`)
      
      // Remove from documents list cache
      const cachedDocuments = await cacheService.get(this.cacheKey) || []
      const updatedDocuments = cachedDocuments.filter(document => document.id !== id)
      await cacheService.set(this.cacheKey, updatedDocuments)

      return { success: true }
    } catch (error) {
      console.error('Error deleting document:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Search documents
   */
  async search(query) {
    const result = await this.getAll()
    if (result.success) {
      const lowercaseQuery = query.toLowerCase()
      const searchResults = result.data.filter(document => {
        const keywords = document.getSearchKeywords()
        return keywords.some(keyword => keyword.includes(lowercaseQuery)) ||
               document.name.toLowerCase().includes(lowercaseQuery) ||
               document.description.toLowerCase().includes(lowercaseQuery)
      })
      return { success: true, data: searchResults }
    }
    return result
  }

  /**
   * Get documents by category
   */
  async getByCategory(category) {
    return this.getAll({ category })
  }

  /**
   * Get documents by tags
   */
  async getByTags(tags) {
    return this.getAll({ tags })
  }

  /**
   * Get archived documents
   */
  async getArchived() {
    return this.getAll({ isArchived: true })
  }

  /**
   * Archive document
   */
  async archive(id) {
    return this.update(id, { isArchived: true })
  }

  /**
   * Unarchive document
   */
  async unarchive(id) {
    return this.update(id, { isArchived: false })
  }

  /**
   * Mark document as accessed
   */
  async markAsAccessed(id) {
    return this.update(id, { accessedAt: new Date() })
  }

  /**
   * Get recently accessed documents
   */
  async getRecentlyAccessed(limit = 10) {
    const result = await this.getAll()
    if (result.success) {
      const recentDocs = result.data
        .filter(doc => doc.accessedAt)
        .sort((a, b) => b.accessedAt - a.accessedAt)
        .slice(0, limit)
      return { success: true, data: recentDocs }
    }
    return result
  }

  /**
   * Cache a single document
   */
  async cacheDocument(document) {
    await cacheService.set(`${this.cacheKey}_${document.id}`, document)
    
    // Also update the documents list cache
    const cachedDocuments = await cacheService.get(this.cacheKey) || []
    const existingIndex = cachedDocuments.findIndex(d => d.id === document.id)
    
    if (existingIndex >= 0) {
      cachedDocuments[existingIndex] = document
    } else {
      cachedDocuments.push(document)
    }
    
    await cacheService.set(this.cacheKey, cachedDocuments)
  }

  /**
   * Cache multiple documents
   */
  async cacheDocuments(documents) {
    await cacheService.set(this.cacheKey, documents)
    
    // Also cache individual documents
    for (const document of documents) {
      await cacheService.set(`${this.cacheKey}_${document.id}`, document)
    }
  }

  /**
   * Apply filters to document list
   */
  applyFilters(documents, filters) {
    let filteredDocuments = [...documents]

    if (filters.category) {
      filteredDocuments = filteredDocuments.filter(doc => doc.category === filters.category)
    }

    if (filters.fileType) {
      filteredDocuments = filteredDocuments.filter(doc => 
        doc.fileType.toLowerCase() === filters.fileType.toLowerCase()
      )
    }

    if (filters.tags && filters.tags.length > 0) {
      filteredDocuments = filteredDocuments.filter(doc => 
        filters.tags.some(tag => doc.tags.includes(tag))
      )
    }

    if (filters.isArchived !== undefined) {
      filteredDocuments = filteredDocuments.filter(doc => doc.isArchived === filters.isArchived)
    }

    if (filters.isPublic !== undefined) {
      filteredDocuments = filteredDocuments.filter(doc => doc.isPublic === filters.isPublic)
    }

    if (filters.createdAfter) {
      const afterDate = new Date(filters.createdAfter)
      filteredDocuments = filteredDocuments.filter(doc => doc.createdAt >= afterDate)
    }

    if (filters.createdBefore) {
      const beforeDate = new Date(filters.createdBefore)
      filteredDocuments = filteredDocuments.filter(doc => doc.createdAt <= beforeDate)
    }

    // Sort by creation date (newest first) by default
    filteredDocuments.sort((a, b) => b.createdAt - a.createdAt)

    return filteredDocuments
  }

  /**
   * Sync local changes with PocketBase
   */
  async sync() {
    try {
      if (!pocketbaseService.isAuthenticated()) {
        return { success: false, error: 'Not authenticated' }
      }

      const cachedDocuments = await cacheService.get(this.cacheKey) || []
      const localDocuments = cachedDocuments.filter(document => document.id.startsWith('local_'))
      
      const results = []
      
      for (const localDocument of localDocuments) {
        // Remove local ID and create in PocketBase
        const documentData = { ...localDocument }
        delete documentData.id
        
        const result = await pocketbaseService.create(this.collection, new Document(documentData).toPocketBase())
        
        if (result.success) {
          // Update cache with new ID
          const newDocument = Document.fromPocketBase(result.data)
          await this.cacheDocument(newDocument)
          
          // Remove old local cache entry
          await cacheService.remove(`${this.cacheKey}_${localDocument.id}`)
          
          results.push({ localId: localDocument.id, newId: newDocument.id, success: true })
        } else {
          results.push({ localId: localDocument.id, success: false, error: result.error })
        }
      }

      return { success: true, data: results }
    } catch (error) {
      console.error('Error syncing documents:', error)
      return { success: false, error: error.message }
    }
  }
}

export const documentService = new DocumentService()
export default documentService
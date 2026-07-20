import { Injectable, Logger } from '@nestjs/common'
import type { OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export interface StoredDocument {
  key: string
  bucket: string
  size: number
  contentType: string
  lastModified?: Date
  metadata?: Record<string, string>
}

export interface UploadOptions {
  contentType?: string
  metadata?: Record<string, string>
}

/**
 * Storage Client with Local Fallback
 *
 * In production: Uses Cloudflare R2 (S3-compatible)
 * In development: Falls back to local file storage in apps/api/storage/
 *
 * Environment variables:
 * - R2_ACCOUNT_ID: Cloudflare account ID
 * - R2_ACCESS_KEY_ID: R2 access key
 * - R2_SECRET_ACCESS_KEY: R2 secret key
 * - R2_BUCKET_NAME: Bucket name (default: medikamentenprofil-documents)
 */
@Injectable()
export class R2StorageClient implements OnModuleInit {
  private readonly logger = new Logger(R2StorageClient.name)
  private client: S3Client | null = null
  private readonly bucketName: string
  private readonly isR2Configured: boolean
  private readonly localStoragePath: string
  private readonly useLocalStorage: boolean

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get('R2_BUCKET_NAME', 'medikamentenprofil-documents')
    this.localStoragePath = path.resolve(process.cwd(), 'storage')

    const accountId = this.configService.get('R2_ACCOUNT_ID', '')
    const accessKeyId = this.configService.get('R2_ACCESS_KEY_ID', '')
    const secretAccessKey = this.configService.get('R2_SECRET_ACCESS_KEY', '')

    this.isR2Configured = !!(accountId && accessKeyId && secretAccessKey)
    this.useLocalStorage = !this.isR2Configured

    if (this.isR2Configured) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      })
    }
  }

  async onModuleInit() {
    if (this.useLocalStorage) {
      // Ensure local storage directory exists
      await fs.mkdir(this.localStoragePath, { recursive: true })
      await fs.mkdir(path.join(this.localStoragePath, 'documents'), { recursive: true })
      await fs.mkdir(path.join(this.localStoragePath, 'epi'), { recursive: true })
      this.logger.log(`Using local storage: ${this.localStoragePath}`)
    } else {
      this.logger.log(`R2 storage configured for bucket: ${this.bucketName}`)
    }
  }

  /**
   * Check if storage is enabled (either R2 or local)
   */
  isEnabled(): boolean {
    return this.isR2Configured || this.useLocalStorage
  }

  /**
   * Check if using local storage
   */
  isLocal(): boolean {
    return this.useLocalStorage
  }

  /**
   * Upload a file to R2 or local storage
   */
  async upload(
    key: string,
    body: Buffer | string,
    options?: UploadOptions
  ): Promise<StoredDocument> {
    // Local storage fallback
    if (this.useLocalStorage) {
      const filePath = path.join(this.localStoragePath, key)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, body)

      // Save metadata alongside the file
      if (options?.metadata) {
        await fs.writeFile(`${filePath}.meta.json`, JSON.stringify(options.metadata, null, 2))
      }

      this.logger.log(`Uploaded (local): ${key}`)

      return {
        key,
        bucket: 'local',
        size: typeof body === 'string' ? Buffer.byteLength(body) : body.length,
        contentType: options?.contentType || 'application/octet-stream',
        metadata: options?.metadata,
      }
    }

    // R2 storage
    if (!this.client) {
      throw new Error('Storage not configured')
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: body,
      ContentType: options?.contentType || 'application/octet-stream',
      Metadata: options?.metadata,
    })

    await this.client.send(command)

    this.logger.log(`Uploaded (R2): ${key}`)

    return {
      key,
      bucket: this.bucketName,
      size: typeof body === 'string' ? Buffer.byteLength(body) : body.length,
      contentType: options?.contentType || 'application/octet-stream',
      metadata: options?.metadata,
    }
  }

  /**
   * Upload a PDF document
   */
  async uploadPdf(key: string, pdfBuffer: Buffer, metadata?: Record<string, string>): Promise<StoredDocument> {
    return this.upload(key, pdfBuffer, {
      contentType: 'application/pdf',
      metadata,
    })
  }

  /**
   * Upload ePI JSON content
   */
  async uploadEpiJson(key: string, content: object, metadata?: Record<string, string>): Promise<StoredDocument> {
    return this.upload(key, JSON.stringify(content, null, 2), {
      contentType: 'application/json',
      metadata,
    })
  }

  /**
   * Upload extracted text content
   */
  async uploadText(key: string, text: string, metadata?: Record<string, string>): Promise<StoredDocument> {
    return this.upload(key, text, {
      contentType: 'text/plain; charset=utf-8',
      metadata,
    })
  }

  /**
   * Download a file from R2 or local storage
   */
  async download(key: string): Promise<Buffer> {
    // Local storage fallback
    if (this.useLocalStorage) {
      const filePath = path.join(this.localStoragePath, key)
      return fs.readFile(filePath)
    }

    // R2 storage
    if (!this.client) {
      throw new Error('Storage not configured')
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    })

    const response = await this.client.send(command)

    if (!response.Body) {
      throw new Error(`Empty response for key: ${key}`)
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = []
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }

    return Buffer.concat(chunks)
  }

  /**
   * Check if a file exists
   */
  async exists(key: string): Promise<boolean> {
    // Local storage fallback
    if (this.useLocalStorage) {
      try {
        const filePath = path.join(this.localStoragePath, key)
        await fs.access(filePath)
        return true
      } catch {
        return false
      }
    }

    // R2 storage
    if (!this.client) {
      return false
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })
      await this.client.send(command)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get file metadata
   */
  async getMetadata(key: string): Promise<StoredDocument | null> {
    if (!this.client) {
      return null
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })
      const response = await this.client.send(command)

      return {
        key,
        bucket: this.bucketName,
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified,
        metadata: response.Metadata,
      }
    } catch {
      return null
    }
  }

  /**
   * Delete a file
   */
  async delete(key: string): Promise<void> {
    // Local storage fallback
    if (this.useLocalStorage) {
      const filePath = path.join(this.localStoragePath, key)
      await fs.unlink(filePath).catch(() => {})
      await fs.unlink(`${filePath}.meta.json`).catch(() => {})
      this.logger.log(`Deleted (local): ${key}`)
      return
    }

    // R2 storage
    if (!this.client) {
      throw new Error('Storage not configured')
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    })

    await this.client.send(command)
    this.logger.log(`Deleted (R2): ${key}`)
  }

  /**
   * List files with a prefix
   */
  async list(prefix: string): Promise<string[]> {
    // Local storage fallback
    if (this.useLocalStorage) {
      const prefixPath = path.join(this.localStoragePath, prefix)
      try {
        const files = await this.listLocalFilesRecursive(prefixPath, prefix)
        return files
      } catch {
        return []
      }
    }

    // R2 storage
    if (!this.client) {
      return []
    }

    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix,
    })

    const response = await this.client.send(command)

    return (response.Contents || [])
      .map((obj) => obj.Key)
      .filter((key): key is string => !!key)
  }

  /**
   * Recursively list local files
   */
  private async listLocalFilesRecursive(dirPath: string, prefix: string): Promise<string[]> {
    const files: string[] = []
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
          const subFiles = await this.listLocalFilesRecursive(fullPath, prefix)
          files.push(...subFiles)
        } else if (!entry.name.endsWith('.meta.json')) {
          // Return relative path from storage root
          const relativePath = path.relative(this.localStoragePath, fullPath)
          files.push(relativePath)
        }
      }
    } catch {
      // Directory doesn't exist
    }
    return files
  }

  /**
   * Generate a presigned URL for temporary public access
   */
  async getPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    if (!this.client) {
      throw new Error('R2 storage not configured')
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    })

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
  }

  /**
   * Generate storage key for a document
   */
  generateDocumentKey(
    productSlug: string,
    documentType: string,
    language: string,
    format: 'pdf' | 'json' | 'txt'
  ): string {
    return `documents/${productSlug}/${documentType}/${language}.${format}`
  }

  /**
   * Generate storage key for an ePI bundle
   */
  generateEpiBundleKey(bundleId: string): string {
    return `epi/bundles/${bundleId}.json`
  }
}

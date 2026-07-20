/**
 * Embedding Provider Port
 *
 * Abstraction for embedding generation services.
 * Allows switching between providers (OpenAI, Cohere, local models, etc.)
 */

export interface EmbeddingRequest {
  text: string
  model?: string
}

export interface EmbeddingResponse {
  embedding: number[]
  model: string
  tokenCount: number
}

export interface BatchEmbeddingRequest {
  texts: string[]
  model?: string
}

export interface BatchEmbeddingResponse {
  embeddings: number[][]
  model: string
  totalTokens: number
}

export interface EmbeddingProviderInfo {
  name: string
  model: string
  dimensions: number
  maxTokensPerRequest: number
  maxBatchSize: number
}

export const EMBEDDING_PROVIDER_TOKEN = Symbol('EMBEDDING_PROVIDER_TOKEN')

export interface IEmbeddingProvider {
  /**
   * Get information about the embedding provider
   */
  getInfo(): EmbeddingProviderInfo

  /**
   * Generate embedding for a single text
   */
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>

  /**
   * Generate embeddings for multiple texts in a batch
   */
  embedBatch(request: BatchEmbeddingRequest): Promise<BatchEmbeddingResponse>

  /**
   * Estimate the cost of embedding a batch of texts
   */
  estimateCost(tokenCount: number): number
}

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type {
  IEmbeddingProvider,
  EmbeddingProviderInfo,
  EmbeddingRequest,
  EmbeddingResponse,
  BatchEmbeddingRequest,
  BatchEmbeddingResponse,
} from '../../application/ports/embedding-provider.port'

interface OpenAIEmbeddingResponse {
  object: string
  data: Array<{
    object: string
    index: number
    embedding: number[]
  }>
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

/**
 * OpenAI Embedding Client
 *
 * Uses text-embedding-3-small model:
 * - 1536 dimensions
 * - $0.02 per 1M tokens
 * - Max 8191 tokens per request
 * - Batch size up to 2048 texts
 */
@Injectable()
export class OpenAIEmbeddingClient implements IEmbeddingProvider {
  private readonly logger = new Logger(OpenAIEmbeddingClient.name)
  private readonly apiKey: string
  private readonly model = 'text-embedding-3-small'
  private readonly dimensions = 1536
  private readonly maxTokensPerRequest = 8191
  private readonly maxBatchSize = 100 // Conservative batch size
  private readonly costPerMillionTokens = 0.02 // USD

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get('OPENAI_API_KEY', '')
  }

  getInfo(): EmbeddingProviderInfo {
    return {
      name: 'OpenAI',
      model: this.model,
      dimensions: this.dimensions,
      maxTokensPerRequest: this.maxTokensPerRequest,
      maxBatchSize: this.maxBatchSize,
    }
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const response = await this.callOpenAI([request.text])
    const firstResult = response.data[0]

    if (!firstResult) {
      throw new Error('No embedding returned from OpenAI')
    }

    return {
      embedding: firstResult.embedding,
      model: response.model,
      tokenCount: response.usage.total_tokens,
    }
  }

  async embedBatch(request: BatchEmbeddingRequest): Promise<BatchEmbeddingResponse> {
    // Split into smaller batches if needed
    const batches: string[][] = []
    for (let i = 0; i < request.texts.length; i += this.maxBatchSize) {
      batches.push(request.texts.slice(i, i + this.maxBatchSize))
    }

    const allEmbeddings: number[][] = []
    let totalTokens = 0
    let model = this.model

    for (const batch of batches) {
      const response = await this.callOpenAI(batch)

      // Sort by index to ensure correct order
      const sortedData = response.data.sort((a, b) => a.index - b.index)

      for (const item of sortedData) {
        allEmbeddings.push(item.embedding)
      }

      totalTokens += response.usage.total_tokens
      model = response.model
    }

    return {
      embeddings: allEmbeddings,
      model,
      totalTokens,
    }
  }

  estimateCost(tokenCount: number): number {
    return (tokenCount / 1_000_000) * this.costPerMillionTokens
  }

  private async callOpenAI(input: string[]): Promise<OpenAIEmbeddingResponse> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured')
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input,
        dimensions: this.dimensions,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorBody}`)
    }

    return (await response.json()) as OpenAIEmbeddingResponse
  }
}

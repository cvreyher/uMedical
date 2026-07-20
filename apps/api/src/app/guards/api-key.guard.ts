import { timingSafeEqual } from 'node:crypto'

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { CanActivate, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

/**
 * API Key Guard for admin endpoints
 *
 * Protects expensive/destructive endpoints (imports, feed management, RAG jobs)
 * with a static API key checked against the `x-api-key` header.
 *
 * Behaviour:
 * - ADMIN_API_KEY set: requests must send a matching `x-api-key` header
 *   (compared timing-safe).
 * - ADMIN_API_KEY unset in development: access is allowed, with a warning.
 * - ADMIN_API_KEY unset in production: admin endpoints are disabled entirely.
 *
 * The `x-api-key` header is already redacted by the logger
 * (see app/logger/redaction.config.ts).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name)
  private readonly apiKey: string | undefined
  private readonly isProduction: boolean
  private hasWarned = false

  constructor(configService: ConfigService) {
    this.apiKey = configService.get<string>('ADMIN_API_KEY')
    this.isProduction = configService.get<string>('NODE_ENV') === 'production'
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.apiKey) {
      if (this.isProduction) {
        throw new UnauthorizedException(
          'Admin API is disabled: ADMIN_API_KEY is not configured',
        )
      }
      if (!this.hasWarned) {
        this.hasWarned = true
        this.logger.warn(
          'ADMIN_API_KEY is not set - admin endpoints are UNPROTECTED (allowed in development only)',
        )
      }
      return true
    }

    const request = context.switchToHttp().getRequest<Request>()
    const providedKey = request.header('x-api-key')

    if (!providedKey || !this.timingSafeCompare(providedKey, this.apiKey)) {
      throw new UnauthorizedException('Invalid or missing x-api-key header')
    }

    return true
  }

  private timingSafeCompare(a: string, b: string): boolean {
    const bufferA = Buffer.from(a)
    const bufferB = Buffer.from(b)
    if (bufferA.length !== bufferB.length) {
      return false
    }
    return timingSafeEqual(bufferA, bufferB)
  }
}

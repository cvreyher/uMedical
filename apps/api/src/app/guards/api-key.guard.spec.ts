import { UnauthorizedException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { ApiKeyGuard } from './api-key.guard'

import type { ExecutionContext } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'

const createConfig = (values: Record<string, string | undefined>): ConfigService =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService

const createContext = (headers: Record<string, string> = {}): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) => headers[name.toLowerCase()],
      }),
    }),
  }) as unknown as ExecutionContext

describe('ApiKeyGuard', () => {
  const KEY = 'test-admin-key-with-32-characters!!'

  it('allows requests with the correct x-api-key header', () => {
    const guard = new ApiKeyGuard(createConfig({ ADMIN_API_KEY: KEY }))
    expect(guard.canActivate(createContext({ 'x-api-key': KEY }))).toBe(true)
  })

  it('rejects requests with a wrong key', () => {
    const guard = new ApiKeyGuard(createConfig({ ADMIN_API_KEY: KEY }))
    expect(() => guard.canActivate(createContext({ 'x-api-key': 'wrong-key' }))).toThrow(
      UnauthorizedException,
    )
  })

  it('rejects requests with a wrong key of equal length', () => {
    const guard = new ApiKeyGuard(createConfig({ ADMIN_API_KEY: KEY }))
    const sameLengthKey = KEY.replaceAll('t', 'x')
    expect(() => guard.canActivate(createContext({ 'x-api-key': sameLengthKey }))).toThrow(
      UnauthorizedException,
    )
  })

  it('rejects requests without the header', () => {
    const guard = new ApiKeyGuard(createConfig({ ADMIN_API_KEY: KEY }))
    expect(() => guard.canActivate(createContext())).toThrow(UnauthorizedException)
  })

  it('allows access when no key is configured in development', () => {
    const guard = new ApiKeyGuard(createConfig({ NODE_ENV: 'development' }))
    expect(guard.canActivate(createContext())).toBe(true)
  })

  it('disables admin endpoints when no key is configured in production', () => {
    const guard = new ApiKeyGuard(createConfig({ NODE_ENV: 'production' }))
    expect(() => guard.canActivate(createContext())).toThrow(UnauthorizedException)
  })
})

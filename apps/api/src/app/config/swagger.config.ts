import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference'

import metadata from '@/metadata'
import { ProblemDetailsDto } from '@/shared-kernel/infrastructure/dtos/problem-details.dto'

import type { INestApplication } from '@nestjs/common'
import type { OpenAPIObject, SwaggerCustomOptions } from '@nestjs/swagger'

/**
 * Swagger base config
 */
export const swaggerConfig = {
  title: 'uMedical API',
  description: `# uMedical API

Comprehensive pharmaceutical data platform aggregating regulatory information from multiple authorities.

## Data Sources

| Authority | Region | Data Types |
|-----------|--------|------------|
| **EMA** | EU | Medicines, Documents, Referrals, Timeline Events |
| **FDA** | US | Recalls, Safety Alerts, Enforcement Actions |
| **MHRA** | UK | Drug Safety Updates |
| **BfArM** | DE | Rote-Hand-Briefe (DHPCs) |
| **Swissmedic** | CH | HPC Letters |

## API Categories

### Core Data
- **Medicines** - EU centrally authorised medicinal products
- **Substances** - Active pharmaceutical ingredients (INN)
- **Companies** - Marketing Authorisation Holders

### Pharmacovigilance
- **Events** - Safety alerts, recalls, DHPCs from all authorities
- **Regional Status** - Authorization status across regions (for map visualization)

### Analytics
- **Statistics** - 50+ analytics endpoints covering products, therapeutic areas, market analysis, regulatory activity, safety indicators, and data quality

### Administration
- **Import** - EMA data import operations
- **Feed Management** - Pharmacovigilance feed configuration`,
  version: '2.0.0',
}

/**
 * Swagger UI custom options
 */
export const swaggerCustomOptions: SwaggerCustomOptions = {
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'none',
    filter: true,
    showRequestDuration: true,
    syntaxHighlight: {
      theme: 'monokai',
    },
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
  },
  customSiteTitle: 'uMedical API',
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 30px 0 }
    .swagger-ui .info .title { font-size: 2rem }
  `,
}

/**
 * Scalar API Reference configuration
 */
export const scalarConfig = {
  theme: 'kepler' as const,
  layout: 'modern' as const,
  defaultHttpClient: {
    targetKey: 'js' as const,
    clientKey: 'fetch' as const,
  },
  hiddenClients: ['cohttp'] as string[],
  showSidebar: true,
  hideModels: false,
  hideDownloadButton: false,
  darkMode: true,
  metaData: {
    title: 'uMedical API',
    description: 'Pharmaceutical data platform API documentation',
  },
  favicon: '/favicon.ico',
}

/**
 * API Tags organized by category
 * Order matters - this determines sidebar order
 */
const API_TAGS = {
  // Core Data APIs
  core: [
    { name: 'Medicines', description: 'EU centrally authorised medicines from EMA' },
    { name: 'Substances', description: 'Active pharmaceutical ingredients (INN)' },
    { name: 'Companies', description: 'Marketing Authorisation Holders (MAH)' },
    { name: 'Timeline Events', description: 'Regulatory events and status changes' },
  ],

  // Pharmacovigilance APIs
  pvigilance: [
    { name: 'Pharmacovigilance Events', description: 'Safety events from FDA, MHRA, BfArM, Swissmedic, EMA' },
    { name: 'Product Pharmacovigilance', description: 'Pharmacovigilance events linked to products' },
    { name: 'Substance Pharmacovigilance', description: 'Pharmacovigilance events linked to substances (INN)' },
    { name: 'Regional Status', description: 'Authorization status across regions for map visualization' },
  ],

  // Statistics APIs
  statistics: [
    { name: 'Statistics - Products', description: 'Product overview, status, designations, approvals' },
    { name: 'Statistics - Therapeutic', description: 'ATC codes, MeSH terms, therapeutic areas' },
    { name: 'Statistics - Companies', description: 'MAH rankings, market concentration, portfolio' },
    { name: 'Statistics - Substances', description: 'Active substances, combinations, versatility' },
    { name: 'Statistics - Regulatory', description: 'Procedures, referrals, timeline events' },
    { name: 'Statistics - Safety', description: 'Shortages, additional monitoring, safety alerts' },
    { name: 'Statistics - Data Quality', description: 'Completeness, staleness, coverage' },
    { name: 'Statistics - News', description: 'News items, publication frequency' },
    { name: 'Statistics - Analytics', description: 'Correlations, trends, advanced insights' },
  ],

  // Admin APIs
  admin: [
    { name: 'Admin - EMA Import', description: 'EMA medicines and shortages data import operations' },
    { name: 'Admin - Import Logs', description: 'Import history and status' },
    { name: 'Admin - Data Sources', description: 'EMA data source tracking' },
    { name: 'Admin - Pvigilance Feeds', description: 'Pharmacovigilance feed management' },
  ],

  // System
  system: [
    { name: 'Health', description: 'Health check and readiness endpoints' },
  ],
}

/**
 * Add default error responses to all endpoints (RFC 9457 Problem Details)
 */
function addDefaultErrorResponses(document: OpenAPIObject): void {
  if (!document.paths) return

  for (const path in document.paths) {
    const pathItem = document.paths[path]
    if (!pathItem) continue

    for (const method in pathItem) {
      if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method)) {
        continue
      }

      const operation = pathItem[method as keyof typeof pathItem]
      if (!operation || typeof operation !== 'object' || !('responses' in operation)) {
        continue
      }

      if (operation.responses && !operation.responses.default) {
        operation.responses.default = {
          description: 'Error response (RFC 9457 Problem Details)',
          content: {
            'application/problem+json': {
              schema: {
                $ref: '#/components/schemas/ProblemDetailsDto',
              },
            },
          },
        }
      }
    }
  }
}

/**
 * Sort paths by tag order for better organization
 */
function sortPathsByTags(document: OpenAPIObject): void {
  if (!document.paths) return

  const allTags = [
    ...API_TAGS.core,
    ...API_TAGS.pvigilance,
    ...API_TAGS.statistics,
    ...API_TAGS.admin,
    ...API_TAGS.system,
  ].map(t => t.name)

  const tagOrder = new Map(allTags.map((tag, index) => [tag, index]))

  const sortedPaths: Record<string, unknown> = {}
  const pathEntries = Object.entries(document.paths)

  pathEntries.sort(([, a], [, b]) => {
    const getTagOrder = (pathItem: unknown): number => {
      if (!pathItem || typeof pathItem !== 'object') return 999
      for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        const op = (pathItem as Record<string, unknown>)[method]
        if (op && typeof op === 'object' && 'tags' in op) {
          const tags = (op as { tags?: string[] }).tags
          if (tags && tags.length > 0) {
            return tagOrder.get(tags[0]!) ?? 999
          }
        }
      }
      return 999
    }

    return getTagOrder(a) - getTagOrder(b)
  })

  for (const [path, pathItem] of pathEntries) {
    sortedPaths[path] = pathItem
  }

  document.paths = sortedPaths as OpenAPIObject['paths']
}

/**
 * Setup API documentation
 * - /docs - Scalar API Reference (modern, default)
 * - /swagger - Swagger UI (classic)
 * - /openapi.json - OpenAPI spec
 * - /openapi.yaml - OpenAPI spec (YAML)
 */
export async function setupSwagger(app: INestApplication): Promise<void> {
  await SwaggerModule.loadPluginMetadata(metadata)

  const builder = new DocumentBuilder()
    .setTitle(swaggerConfig.title)
    .setDescription(swaggerConfig.description)
    .setVersion(swaggerConfig.version)
    .setContact('uMedical', 'https://umedical.store', 'info@umedical.store')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'Admin API key (ADMIN_API_KEY) for admin endpoints',
      },
      'admin-api-key',
    )
    .addServer('http://localhost:3001', 'Local Development')
    .addServer('https://api.dev.umedical.store', 'Development')
    .addServer('http://localhost:3000', 'Development')
    .addServer('https://api.umedical.store', 'Production')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Enter JWT token',
    })

  // Add all tags in order
  for (const category of [API_TAGS.core, API_TAGS.pvigilance, API_TAGS.statistics, API_TAGS.admin, API_TAGS.system]) {
    for (const tag of category) {
      builder.addTag(tag.name, tag.description)
    }
  }

  const config = builder.build()

  const document = SwaggerModule.createDocument(app, config, {
    include: [],
    deepScanRoutes: true,
    extraModels: [ProblemDetailsDto],
    operationIdFactory: (controllerKey: string, methodKey: string) => {
      // Clean operation IDs
      const controller = controllerKey.replace(/Controller$/, '')
      return `${controller}_${methodKey}`
    },
  })

  // Post-process document
  addDefaultErrorResponses(document)
  sortPathsByTags(document)

  // Swagger UI at /swagger
  SwaggerModule.setup('swagger', app, document, {
    ...swaggerCustomOptions,
    jsonDocumentUrl: '/openapi.json',
    yamlDocumentUrl: '/openapi.yaml',
  })

  // Scalar API Reference at /docs (default)
  // Use url instead of content for better browser caching and fetch reliability
  app.use(
    '/docs',
    apiReference({
      url: '/openapi.json',
      ...scalarConfig,
    }),
  )
}

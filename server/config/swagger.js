import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ITAM Enterprise API Documentation',
      version: '1.0.0',
      description: `
# IT Asset Management Enterprise API

Comprehensive API for enterprise asset management, including:
- Hardware and software asset tracking
- User and role management
- Telemetry and monitoring
- Ticket management
- Alerts and notifications
- Multi-tenancy support

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- General API: 100 requests per 15 minutes
- Authentication: 5 attempts per 15 minutes
- Scanner endpoints: 100 requests per 10 minutes

## Multi-Tenancy

All data is isolated by tenant. Users can only access data belonging to their tenant.

## Error Responses

All error responses follow this format:

\`\`\`json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message"
}
\`\`\`
      `,
      contact: {
        name: 'API Support',
        email: 'support@yourdomain.com',
      },
      license: {
        name: 'Proprietary',
        url: 'https://yourdomain.com/license',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.yourdomain.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error type',
            },
            message: {
              type: 'string',
              example: 'Human-readable error message',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011',
            },
            tenant_id: {
              type: 'string',
              example: 'tenant123',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            firstName: {
              type: 'string',
              example: 'John',
            },
            lastName: {
              type: 'string',
              example: 'Doe',
            },
            role: {
              type: 'string',
              enum: ['user', 'admin', 'superadmin'],
              example: 'user',
            },
            department: {
              type: 'string',
              example: 'IT',
            },
            assignedAssets: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['00:11:22:33:44:55'],
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Hardware: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '00:11:22:33:44:55',
            },
            tenant_id: {
              type: 'string',
            },
            system: {
              type: 'object',
              properties: {
                platform: { type: 'string', example: 'Windows' },
                hostname: { type: 'string', example: 'DESKTOP-ABC123' },
                mac_address: { type: 'string', example: '00:11:22:33:44:55' },
              },
            },
            cpu: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Intel Core i7-9700K' },
                physical_cores: { type: 'number', example: 8 },
                logical_cores: { type: 'number', example: 16 },
              },
            },
            memory: {
              type: 'object',
              properties: {
                total: { type: 'string', example: '16 GB' },
                used: { type: 'string', example: '8 GB' },
              },
            },
            assignedTo: {
              type: 'string',
              example: '507f1f77bcf86cd799439011',
            },
            status: {
              type: 'string',
              enum: ['Available', 'Assigned', 'Maintenance', 'Retired'],
            },
          },
        },
        Ticket: {
          type: 'object',
          properties: {
            ticket_id: {
              type: 'string',
              example: 'TKT-000001',
            },
            title: {
              type: 'string',
              example: 'Laptop overheating',
            },
            description: {
              type: 'string',
              example: 'Laptop gets very hot during normal use',
            },
            priority: {
              type: 'string',
              enum: ['Low', 'Medium', 'High', 'Critical'],
            },
            status: {
              type: 'string',
              enum: ['Open', 'In Progress', 'Resolved', 'Closed', 'Rejected'],
            },
            category: {
              type: 'string',
              enum: [
                'Hardware Issue',
                'Software Issue',
                'Network Issue',
                'Performance Issue',
                'Maintenance Request',
                'Access Request',
                'Other',
              ],
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Unauthorized',
                message: 'Authentication required',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Forbidden',
                message: 'Insufficient permissions',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Not Found',
                message: 'Resource not found',
              },
            },
          },
        },
        RateLimitError: {
          description: 'Too many requests',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Too Many Requests',
                message: 'Rate limit exceeded',
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization',
      },
      {
        name: 'Users',
        description: 'User management operations',
      },
      {
        name: 'Hardware',
        description: 'Hardware asset management',
      },
      {
        name: 'Software',
        description: 'Software asset management',
      },
      {
        name: 'Tickets',
        description: 'Support ticket management',
      },
      {
        name: 'Telemetry',
        description: 'System telemetry and monitoring',
      },
      {
        name: 'Alerts',
        description: 'Alert and notification management',
      },
      {
        name: 'Scanner',
        description: 'Asset scanner management',
      },
      {
        name: 'Backup',
        description: 'Backup and restore operations',
      },
      {
        name: 'Super Admin',
        description: 'Super admin operations',
      },
    ],
  },
  apis: [
    './router/*.js',
    './controllers/*.js',
    './models/*.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

export { swaggerUi, swaggerSpec };

/**
 * AI Tool Definitions (OpenAI Function Calling Format)
 *
 * Each tool maps to a database query executed by AiService.executeTool().
 * The model uses these descriptions to decide which tools to call.
 */
export const AI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_assets',
      description:
        'Search the asset inventory by name, type, status, IP address, hostname, serial number, or any attribute. Use this to find specific assets or groups of assets.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — matches against name, hostname, IP address, serial number, asset tag, and notes',
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'DISCOVERED', 'IN_MAINTENANCE', 'IN_STORAGE', 'RESERVED', 'RETIRED', 'DISPOSED', 'LOST', 'PENDING_REVIEW'],
            description: 'Filter by asset lifecycle status',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_asset_details',
      description:
        'Get full details for a specific asset including hardware specs, OS info, security posture, assigned user, installed software, related tickets, and patch deployment status.',
      parameters: {
        type: 'object',
        properties: {
          assetId: {
            type: 'string',
            description: 'The UUID of the asset to retrieve',
          },
        },
        required: ['assetId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_tickets',
      description:
        'Search ITSM tickets by subject, description, status, priority, or type. Use to find open incidents, pending requests, or related historical tickets.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — matches against subject and description',
          },
          status: {
            type: 'string',
            enum: ['NEW', 'OPEN', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'CANCELLED'],
            description: 'Filter by ticket status',
          },
          priority: {
            type: 'string',
            enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
            description: 'Filter by ticket priority',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_ticket_details',
      description:
        'Get full details for a specific ticket including comments, related assets, assigned user, SLA status, and work orders.',
      parameters: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'The UUID of the ticket to retrieve',
          },
        },
        required: ['ticketId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_vulnerabilities',
      description:
        'Search vulnerability scan results to find known security issues across the infrastructure. Returns scan findings with severity and affected targets.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — matches against scan type, target, and results',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_patch_compliance',
      description:
        'Get patch compliance status — overall or for a specific asset. Returns pending patches, deployment status, and compliance percentage.',
      parameters: {
        type: 'object',
        properties: {
          assetId: {
            type: 'string',
            description: 'Optional asset UUID to check patch compliance for a specific asset. Omit for organization-wide status.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_knowledge_base',
      description:
        'Search published knowledge base articles by title, content, category, or tags. Use to find documented solutions, procedures, and troubleshooting guides.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — matches against title, content, category, and tags',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_network_devices',
      description:
        'Get monitored network devices (cameras, switches, routers, VMs) with their current status, metrics, and health. Optionally filter by subnet.',
      parameters: {
        type: 'object',
        properties: {
          subnet: {
            type: 'string',
            description: 'Optional subnet filter (e.g., "192.168.1") to narrow results to a specific network segment',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 20)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_compliance_status',
      description:
        'Get the overall compliance posture for the organization. Returns security posture stats, endpoint policy violations, patch compliance, and license compliance status.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_ticket',
      description:
        'Create a new ITSM ticket. Use when the user asks to report an issue, request a service, or log a maintenance task.',
      parameters: {
        type: 'object',
        properties: {
          subject: {
            type: 'string',
            description: 'Brief title of the ticket',
          },
          description: {
            type: 'string',
            description: 'Detailed description of the issue or request',
          },
          priority: {
            type: 'string',
            enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
            description: 'Ticket priority level',
          },
          type: {
            type: 'string',
            enum: ['INCIDENT', 'PROBLEM', 'CHANGE', 'SERVICE_REQUEST', 'MAINTENANCE'],
            description: 'Ticket type classification',
          },
        },
        required: ['subject', 'description', 'priority', 'type'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_recent_alerts',
      description:
        'Get recent monitoring alerts and endpoint changes. Returns critical and warning-level events from the last 24 hours including device status changes, policy violations, and security events.',
      parameters: {
        type: 'object',
        properties: {
          hours: {
            type: 'number',
            description: 'Number of hours to look back (default: 24)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of alerts to return (default: 20)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_top_risks',
      description: 'Get the highest risk assets across the organization based on compound risk analysis. Returns assets with critical vulnerabilities, EOL software, or hardware issues.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of top risks to return (default: 10)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'analyze_asset_risk',
      description: 'Perform a detailed compound risk analysis for a specific asset. Evaluates OS lifecycle, software vulnerabilities, security posture, and hardware status.',
      parameters: {
        type: 'object',
        properties: {
          assetId: { type: 'string', description: 'The UUID of the asset to analyze' },
        },
        required: ['assetId'],
      },
    },
  },
] as const;

import AuditLog from "../models/auditLog.models.js";

/**
 * Middleware to automatically log API requests to audit trail
 */
export const auditLogger = (action, resourceType) => {
  return async (req, res, next) => {
    // Store original send function
    const originalSend = res.send;

    // Override send function to capture response
    res.send = function (data) {
      // Restore original send
      res.send = originalSend;

      // Log audit event after response is sent
      setImmediate(async () => {
        try {
          if (req.user) {
            const eventData = {
              tenant_id: req.user.tenant_id,
              user_id: req.user._id,
              user_email: req.user.email,
              user_role: req.user.role,
              action: action || deriveAction(req.method, req.path),
              resource_type: resourceType || deriveResourceType(req.path),
              resource_id: req.params.id || req.params.macAddress || req.body._id,
              description: generateDescription(
                action || deriveAction(req.method, req.path),
                req
              ),
              ip_address: req.ip || req.connection.remoteAddress,
              user_agent: req.get("user-agent"),
              changes: extractChanges(req),
              metadata: {
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
              },
              status: res.statusCode < 400 ? "success" : "failure",
              severity: determineSeverity(req.method, res.statusCode),
            };

            await AuditLog.logEvent(eventData);
          }
        } catch (error) {
          console.error("Error logging audit event:", error);
        }
      });

      // Call original send
      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Derive action from HTTP method and path
 */
function deriveAction(method, path) {
  const pathSegments = path.split("/").filter(Boolean);
  const resource = pathSegments[pathSegments.length - 1];

  const actionMap = {
    POST: `${resource}_created`,
    PUT: `${resource}_updated`,
    PATCH: `${resource}_updated`,
    DELETE: `${resource}_deleted`,
    GET: `${resource}_viewed`,
  };

  return actionMap[method] || "action_performed";
}

/**
 * Derive resource type from path
 */
function deriveResourceType(path) {
  if (path.includes("/hardware")) return "hardware";
  if (path.includes("/software")) return "software";
  if (path.includes("/users") || path.includes("/auth")) return "user";
  if (path.includes("/tickets")) return "ticket";
  if (path.includes("/alerts")) return "alert";
  if (path.includes("/backup")) return "backup";
  if (path.includes("/export")) return "export";
  return "system";
}

/**
 * Generate human-readable description
 */
function generateDescription(action, req) {
  const descriptions = {
    login: `User logged in from ${req.ip}`,
    logout: "User logged out",
    user_created: `Created user: ${req.body.email}`,
    user_updated: `Updated user: ${req.params.id}`,
    user_deleted: `Deleted user: ${req.params.id}`,
    asset_assigned: `Assigned asset ${req.body.macAddress} to user ${req.body.userId}`,
    asset_unassigned: `Unassigned asset ${req.body.macAddress}`,
    hardware_scan: `Hardware scan submitted for ${req.body.system?.mac_address}`,
    ticket_created: `Created ticket: ${req.body.title}`,
    backup_created: "System backup created",
    export_generated: "Export file generated",
  };

  return (
    descriptions[action] ||
    `${action.replace(/_/g, " ")} - ${req.method} ${req.originalUrl}`
  );
}

/**
 * Extract changes from request body
 */
function extractChanges(req) {
  if (["PUT", "PATCH"].includes(req.method) && req.body) {
    // Exclude sensitive fields
    const { password, token, ...changes } = req.body;
    return changes;
  }
  return {};
}

/**
 * Determine severity based on method and status code
 */
function determineSeverity(method, statusCode) {
  // Failed authentication or authorization
  if (statusCode === 401 || statusCode === 403) {
    return "high";
  }

  // Server errors
  if (statusCode >= 500) {
    return "critical";
  }

  // Client errors
  if (statusCode >= 400) {
    return "medium";
  }

  // Destructive operations
  if (method === "DELETE") {
    return "medium";
  }

  return "low";
}

/**
 * Log specific audit event manually
 */
export const logAuditEvent = async (req, action, details = {}) => {
  if (!req.user) return;

  const eventData = {
    tenant_id: req.user.tenant_id,
    user_id: req.user._id,
    user_email: req.user.email,
    user_role: req.user.role,
    action,
    ip_address: req.ip || req.connection.remoteAddress,
    user_agent: req.get("user-agent"),
    status: "success",
    severity: "low",
    ...details,
  };

  await AuditLog.logEvent(eventData);
};

export default {
  auditLogger,
  logAuditEvent,
};

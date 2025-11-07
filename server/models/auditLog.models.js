import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: String,
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    user_email: {
      type: String,
      required: true,
    },
    user_role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        // Authentication
        "login",
        "logout",
        "login_failed",
        "password_change",
        "password_reset",
        
        // User management
        "user_created",
        "user_updated",
        "user_deleted",
        "user_role_changed",
        
        // Asset management
        "asset_created",
        "asset_updated",
        "asset_deleted",
        "asset_assigned",
        "asset_unassigned",
        "asset_status_changed",
        
        // Hardware
        "hardware_scan",
        "hardware_modified",
        
        // Software
        "software_scan",
        "software_installed",
        "software_removed",
        
        // Tickets
        "ticket_created",
        "ticket_updated",
        "ticket_closed",
        "ticket_assigned",
        "ticket_comment_added",
        
        // System
        "backup_created",
        "backup_restored",
        "export_generated",
        "import_executed",
        "settings_changed",
        
        // Security
        "security_alert",
        "unauthorized_access",
        "permission_denied",
      ],
    },
    resource_type: {
      type: String,
      enum: [
        "user",
        "hardware",
        "software",
        "ticket",
        "alert",
        "backup",
        "export",
        "settings",
        "system",
      ],
    },
    resource_id: {
      type: String,
    },
    description: {
      type: String,
      required: true,
    },
    ip_address: {
      type: String,
    },
    user_agent: {
      type: String,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ["success", "failure", "warning"],
      default: "success",
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
AuditLogSchema.index({ tenant_id: 1, createdAt: -1 });
AuditLogSchema.index({ user_id: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ resource_type: 1, resource_id: 1 });
AuditLogSchema.index({ status: 1 });
AuditLogSchema.index({ severity: 1 });

// Static method to log audit event
AuditLogSchema.statics.logEvent = async function (eventData) {
  try {
    const log = new this(eventData);
    await log.save();
    return log;
  } catch (error) {
    console.error("Error logging audit event:", error);
    // Don't throw - audit logging should never break the main flow
  }
};

// Static method to get audit trail for resource
AuditLogSchema.statics.getResourceAuditTrail = async function (
  resourceType,
  resourceId,
  options = {}
) {
  const { limit = 100, skip = 0 } = options;

  return this.find({ resource_type: resourceType, resource_id: resourceId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate("user_id", "firstName lastName email");
};

// Static method to get user activity
AuditLogSchema.statics.getUserActivity = async function (
  userId,
  options = {}
) {
  const { limit = 100, skip = 0, startDate, endDate } = options;

  const query = { user_id: userId };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get security events
AuditLogSchema.statics.getSecurityEvents = async function (options = {}) {
  const { limit = 100, skip = 0, severity } = options;

  const securityActions = [
    "login_failed",
    "unauthorized_access",
    "permission_denied",
    "security_alert",
  ];

  const query = { action: { $in: securityActions } };

  if (severity) {
    query.severity = severity;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate("user_id", "firstName lastName email");
};

// Static method to get compliance report
AuditLogSchema.statics.getComplianceReport = async function (
  tenantId,
  startDate,
  endDate
) {
  const query = {
    tenant_id: tenantId,
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  const [
    totalEvents,
    eventsByAction,
    eventsByUser,
    securityEvents,
    failedEvents,
  ] = await Promise.all([
    this.countDocuments(query),
    this.aggregate([
      { $match: query },
      { $group: { _id: "$action", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    this.aggregate([
      { $match: query },
      { $group: { _id: "$user_id", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    this.countDocuments({
      ...query,
      severity: { $in: ["high", "critical"] },
    }),
    this.countDocuments({
      ...query,
      status: "failure",
    }),
  ]);

  return {
    period: { startDate, endDate },
    totalEvents,
    eventsByAction,
    eventsByUser,
    securityEvents,
    failedEvents,
    complianceScore: calculateComplianceScore({
      totalEvents,
      securityEvents,
      failedEvents,
    }),
  };
};

// Helper function to calculate compliance score
function calculateComplianceScore({ totalEvents, securityEvents, failedEvents }) {
  if (totalEvents === 0) return 100;

  const securityRatio = securityEvents / totalEvents;
  const failureRatio = failedEvents / totalEvents;

  // Perfect score is 100, deduct points for security events and failures
  let score = 100;
  score -= securityRatio * 30; // Max 30 points deduction for security events
  score -= failureRatio * 20; // Max 20 points deduction for failures

  return Math.max(0, Math.round(score));
}

const AuditLog = mongoose.model("AuditLog", AuditLogSchema);

export default AuditLog;

import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";
import AuditLog from "../models/auditLog.models.js";

const router = express.Router();

/**
 * @route   GET /api/audit
 * @desc    Get audit logs (paginated)
 * @access  Admin only
 */
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      resourceType,
      userId,
      status,
      severity,
      startDate,
      endDate,
    } = req.query;

    const query = { tenant_id: req.user.tenant_id };

    // Apply filters
    if (action) query.action = action;
    if (resourceType) query.resource_type = resourceType;
    if (userId) query.user_id = userId;
    if (status) query.status = status;
    if (severity) query.severity = severity;

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .populate("user_id", "firstName lastName email"),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch audit logs",
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/audit/resource/:resourceType/:resourceId
 * @desc    Get audit trail for specific resource
 * @access  Admin only
 */
router.get(
  "/resource/:resourceType/:resourceId",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { resourceType, resourceId } = req.params;
      const { limit = 50, skip = 0 } = req.query;

      const logs = await AuditLog.getResourceAuditTrail(
        resourceType,
        resourceId,
        {
          limit: parseInt(limit),
          skip: parseInt(skip),
        }
      );

      res.json({
        success: true,
        logs,
      });
    } catch (error) {
      console.error("Error fetching resource audit trail:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch audit trail",
        message: error.message,
      });
    }
  }
);

/**
 * @route   GET /api/audit/user/:userId
 * @desc    Get user activity
 * @access  Admin only
 */
router.get("/user/:userId", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 100, skip = 0, startDate, endDate } = req.query;

    const logs = await AuditLog.getUserActivity(userId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      startDate,
      endDate,
    });

    res.json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error("Error fetching user activity:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user activity",
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/audit/security
 * @desc    Get security events
 * @access  Admin only
 */
router.get("/security", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { limit = 100, skip = 0, severity } = req.query;

    const logs = await AuditLog.getSecurityEvents({
      limit: parseInt(limit),
      skip: parseInt(skip),
      severity,
    });

    res.json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error("Error fetching security events:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch security events",
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/audit/compliance
 * @desc    Get compliance report
 * @access  Admin only
 */
router.get("/compliance", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "startDate and endDate are required",
      });
    }

    const report = await AuditLog.getComplianceReport(
      req.user.tenant_id,
      startDate,
      endDate
    );

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("Error generating compliance report:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate compliance report",
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/audit/statistics
 * @desc    Get audit statistics
 * @access  Admin only
 */
router.get("/statistics", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [
      totalEvents,
      eventsByAction,
      eventsByResourceType,
      eventsBySeverity,
      recentSecurityEvents,
    ] = await Promise.all([
      AuditLog.countDocuments({ tenant_id, createdAt: { $gte: startDate } }),
      AuditLog.aggregate([
        { $match: { tenant_id, createdAt: { $gte: startDate } } },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      AuditLog.aggregate([
        { $match: { tenant_id, createdAt: { $gte: startDate } } },
        { $group: { _id: "$resource_type", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AuditLog.aggregate([
        { $match: { tenant_id, createdAt: { $gte: startDate } } },
        { $group: { _id: "$severity", count: { $sum: 1 } } },
      ]),
      AuditLog.find({
        tenant_id,
        severity: { $in: ["high", "critical"] },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("user_id", "firstName lastName email"),
    ]);

    res.json({
      success: true,
      statistics: {
        totalEvents,
        eventsByAction,
        eventsByResourceType,
        eventsBySeverity,
        recentSecurityEvents,
      },
    });
  } catch (error) {
    console.error("Error fetching audit statistics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch audit statistics",
      message: error.message,
    });
  }
});

export default router;

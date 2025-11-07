import express from "express";
import BackupManager from "../utils/backup.js";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";

const router = express.Router();
const backupManager = new BackupManager();

// Initialize backup manager
backupManager.initialize().catch(console.error);

/**
 * @route   POST /api/backup/create
 * @desc    Create a full backup
 * @access  Admin only
 */
router.post("/create", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await backupManager.createFullBackup();
    res.json({
      success: true,
      message: "Backup created successfully",
      backup: result,
    });
  } catch (error) {
    console.error("Error creating backup:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create backup",
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/backup/list
 * @desc    List all available backups
 * @access  Admin only
 */
router.get("/list", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const backups = await backupManager.listBackups();
    res.json({
      success: true,
      backups,
    });
  } catch (error) {
    console.error("Error listing backups:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list backups",
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/backup/restore
 * @desc    Restore from a backup
 * @access  Admin only
 */
router.post("/restore", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { backupFile } = req.body;

    if (!backupFile) {
      return res.status(400).json({
        success: false,
        error: "Backup file name is required",
      });
    }

    const result = await backupManager.restoreFromBackup(backupFile);
    res.json({
      success: true,
      message: "Backup restored successfully",
      result,
    });
  } catch (error) {
    console.error("Error restoring backup:", error);
    res.status(500).json({
      success: false,
      error: "Failed to restore backup",
      message: error.message,
    });
  }
});

/**
 * @route   DELETE /api/backup/:filename
 * @desc    Delete a specific backup
 * @access  Admin only
 */
router.delete("/:filename", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { filename } = req.params;
    const backupPath = path.join(backupManager.backupDir, filename);

    await fs.unlink(backupPath);

    res.json({
      success: true,
      message: "Backup deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting backup:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete backup",
      message: error.message,
    });
  }
});

export default router;

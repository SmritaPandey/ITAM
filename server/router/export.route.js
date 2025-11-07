import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";
import { exportLimiter } from "../middleware/rateLimiter.js";
import ExportManager from "../utils/export.js";
import ImportManager from "../utils/import.js";
import Hardware from "../models/hardware.models.js";
import multer from "multer";
import path from "path";

const router = express.Router();
const exportManager = new ExportManager();
const importManager = new ImportManager();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/imports');
  },
  filename: (req, file, cb) => {
    cb(null, `import-${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  },
});

/**
 * @route   GET /api/export/hardware/excel
 * @desc    Export hardware assets to Excel
 * @access  Admin only
 */
router.get("/hardware/excel", verifyToken, verifyAdmin, exportLimiter, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const hardware = await Hardware.find({ tenant_id });

    const filename = `hardware-export-${Date.now()}.xlsx`;
    const filepath = await exportManager.exportHardwareToExcel(hardware, filename);

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
    });
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export to Excel',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/export/hardware/csv
 * @desc    Export hardware assets to CSV
 * @access  Admin only
 */
router.get("/hardware/csv", verifyToken, verifyAdmin, exportLimiter, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const hardware = await Hardware.find({ tenant_id });

    const filename = `hardware-export-${Date.now()}.csv`;
    const filepath = await exportManager.exportHardwareToCSV(hardware, filename);

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
    });
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export to CSV',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/export/hardware/pdf
 * @desc    Export hardware assets to PDF
 * @access  Admin only
 */
router.get("/hardware/pdf", verifyToken, verifyAdmin, exportLimiter, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const hardware = await Hardware.find({ tenant_id });

    const filename = `hardware-export-${Date.now()}.pdf`;
    const filepath = await exportManager.exportHardwareToPDF(hardware, filename);

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
    });
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export to PDF',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/export/qrcode/:macAddress
 * @desc    Generate QR code for asset
 * @access  Admin only
 */
router.get("/qrcode/:macAddress", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { macAddress } = req.params;
    const { tenant_id } = req.user;

    const hardware = await Hardware.findOne({ _id: macAddress, tenant_id });

    if (!hardware) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found',
      });
    }

    const filename = `qrcode-${macAddress.replace(/:/g, '-')}.png`;
    const filepath = await exportManager.generateQRCode(hardware, filename);

    res.sendFile(filepath, { root: '.' }, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate QR code',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/export/barcode/:assetTag
 * @desc    Generate barcode for asset
 * @access  Admin only
 */
router.get("/barcode/:assetTag", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { assetTag } = req.params;

    const filename = `barcode-${assetTag}.png`;
    const filepath = await exportManager.generateBarcode(assetTag, filename);

    res.sendFile(filepath, { root: '.' }, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
    });
  } catch (error) {
    console.error('Error generating barcode:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate barcode',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/export/import/hardware
 * @desc    Import hardware assets from CSV/Excel
 * @access  Admin only
 */
router.post(
  "/import/hardware",
  verifyToken,
  verifyAdmin,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const { tenant_id } = req.user;
      const { skipDuplicates, updateExisting, dryRun } = req.body;

      const options = {
        skipDuplicates: skipDuplicates === 'true',
        updateExisting: updateExisting === 'true',
        dryRun: dryRun === 'true',
      };

      const ext = path.extname(req.file.originalname).toLowerCase();
      let results;

      if (ext === '.csv') {
        results = await importManager.importFromCSV(req.file.path, tenant_id, options);
      } else if (ext === '.xlsx' || ext === '.xls') {
        results = await importManager.importFromExcel(req.file.path, tenant_id, options);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Unsupported file format',
        });
      }

      res.json({
        success: true,
        message: 'Import completed',
        results,
      });
    } catch (error) {
      console.error('Error importing assets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to import assets',
        message: error.message,
      });
    }
  }
);

/**
 * @route   GET /api/export/template/:format
 * @desc    Download import template
 * @access  Admin only
 */
router.get("/template/:format", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { format } = req.params;

    if (!['csv', 'xlsx'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Use csv or xlsx',
      });
    }

    const filename = `import-template-${Date.now()}`;
    const filepath = await importManager.generateTemplate(format, filename);

    res.download(filepath, `import-template.${format}`, (err) => {
      if (err) {
        console.error('Error downloading template:', err);
      }
    });
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate template',
      message: error.message,
    });
  }
});

export default router;

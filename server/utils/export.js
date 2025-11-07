import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { createObjectCsvWriter } from 'csv-writer';
import QRCode from 'qrcode';
import bwipjs from 'bwip-js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Export Manager for generating reports and exports
 */
class ExportManager {
  constructor() {
    this.exportsDir = path.join(process.cwd(), 'exports');
    this.initializeExportsDir();
  }

  async initializeExportsDir() {
    try {
      await fs.mkdir(this.exportsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating exports directory:', error);
    }
  }

  /**
   * Export hardware assets to Excel
   */
  async exportHardwareToExcel(hardwareData, filename = 'hardware-export.xlsx') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Hardware Assets');

    // Define columns
    worksheet.columns = [
      { header: 'MAC Address', key: 'mac_address', width: 20 },
      { header: 'Hostname', key: 'hostname', width: 25 },
      { header: 'Platform', key: 'platform', width: 15 },
      { header: 'CPU', key: 'cpu', width: 30 },
      { header: 'CPU Cores', key: 'cpu_cores', width: 12 },
      { header: 'Memory (Total)', key: 'memory', width: 15 },
      { header: 'Storage (Total)', key: 'storage', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Assigned To', key: 'assigned_to', width: 25 },
      { header: 'Asset Tag', key: 'asset_tag', width: 15 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Purchase Date', key: 'purchase_date', width: 15 },
      { header: 'Warranty Expiry', key: 'warranty_expiry', width: 15 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Last Updated', key: 'updated_at', width: 20 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add data rows
    hardwareData.forEach((hw) => {
      worksheet.addRow({
        mac_address: hw.system?.mac_address || hw._id,
        hostname: hw.system?.hostname || 'Unknown',
        platform: hw.system?.platform || 'Unknown',
        cpu: hw.cpu?.name || 'Unknown',
        cpu_cores: `${hw.cpu?.physical_cores || 0}/${hw.cpu?.logical_cores || 0}`,
        memory: hw.memory?.total || 'Unknown',
        storage: hw.storage?.total_capacity || 'Unknown',
        status: hw.status || 'Unknown',
        assigned_to: hw.assigned_to || 'Unassigned',
        asset_tag: hw.asset_info?.asset_tag || 'N/A',
        vendor: hw.asset_info?.vendor || 'Unknown',
        purchase_date: hw.asset_info?.purchase_date
          ? new Date(hw.asset_info.purchase_date).toLocaleDateString()
          : 'N/A',
        warranty_expiry: hw.asset_info?.warranty_expiry
          ? new Date(hw.asset_info.warranty_expiry).toLocaleDateString()
          : 'N/A',
        location: hw.asset_info?.location || 'Unknown',
        department: hw.asset_info?.department || 'Unknown',
        updated_at: hw.updatedAt
          ? new Date(hw.updatedAt).toLocaleString()
          : 'N/A',
      });
    });

    // Auto-filter
    worksheet.autoFilter = {
      from: 'A1',
      to: `P1`,
    };

    // Save file
    const filepath = path.join(this.exportsDir, filename);
    await workbook.xlsx.writeFile(filepath);

    return filepath;
  }

  /**
   * Export hardware assets to CSV
   */
  async exportHardwareToCSV(hardwareData, filename = 'hardware-export.csv') {
    const filepath = path.join(this.exportsDir, filename);

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'mac_address', title: 'MAC Address' },
        { id: 'hostname', title: 'Hostname' },
        { id: 'platform', title: 'Platform' },
        { id: 'cpu', title: 'CPU' },
        { id: 'cpu_cores', title: 'CPU Cores' },
        { id: 'memory', title: 'Memory (Total)' },
        { id: 'storage', title: 'Storage (Total)' },
        { id: 'status', title: 'Status' },
        { id: 'assigned_to', title: 'Assigned To' },
        { id: 'asset_tag', title: 'Asset Tag' },
        { id: 'vendor', title: 'Vendor' },
        { id: 'purchase_date', title: 'Purchase Date' },
        { id: 'warranty_expiry', title: 'Warranty Expiry' },
        { id: 'location', title: 'Location' },
        { id: 'department', title: 'Department' },
        { id: 'updated_at', title: 'Last Updated' },
      ],
    });

    const records = hardwareData.map((hw) => ({
      mac_address: hw.system?.mac_address || hw._id,
      hostname: hw.system?.hostname || 'Unknown',
      platform: hw.system?.platform || 'Unknown',
      cpu: hw.cpu?.name || 'Unknown',
      cpu_cores: `${hw.cpu?.physical_cores || 0}/${hw.cpu?.logical_cores || 0}`,
      memory: hw.memory?.total || 'Unknown',
      storage: hw.storage?.total_capacity || 'Unknown',
      status: hw.status || 'Unknown',
      assigned_to: hw.assigned_to || 'Unassigned',
      asset_tag: hw.asset_info?.asset_tag || 'N/A',
      vendor: hw.asset_info?.vendor || 'Unknown',
      purchase_date: hw.asset_info?.purchase_date
        ? new Date(hw.asset_info.purchase_date).toLocaleDateString()
        : 'N/A',
      warranty_expiry: hw.asset_info?.warranty_expiry
        ? new Date(hw.asset_info.warranty_expiry).toLocaleDateString()
        : 'N/A',
      location: hw.asset_info?.location || 'Unknown',
      department: hw.asset_info?.department || 'Unknown',
      updated_at: hw.updatedAt ? new Date(hw.updatedAt).toLocaleString() : 'N/A',
    }));

    await csvWriter.writeRecords(records);
    return filepath;
  }

  /**
   * Export hardware assets to PDF
   */
  async exportHardwareToPDF(hardwareData, filename = 'hardware-export.pdf') {
    const filepath = path.join(this.exportsDir, filename);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const stream = doc.pipe(require('fs').createWriteStream(filepath));

      // Title
      doc.fontSize(20).text('Hardware Assets Report', { align: 'center' });
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, {
        align: 'center',
      });
      doc.moveDown(2);

      // Summary
      doc
        .fontSize(12)
        .text(`Total Assets: ${hardwareData.length}`, { align: 'left' });
      doc.moveDown();

      // Table
      const tableTop = doc.y;
      const itemsPerPage = 15;
      let currentPage = 0;

      hardwareData.forEach((hw, index) => {
        if (index > 0 && index % itemsPerPage === 0) {
          doc.addPage();
          currentPage++;
        }

        const y = tableTop + ((index % itemsPerPage) * 40);

        doc
          .fontSize(8)
          .text(`${hw.system?.hostname || 'Unknown'}`, 50, y)
          .text(`${hw.system?.mac_address || hw._id}`, 150, y)
          .text(`${hw.cpu?.name || 'Unknown'}`.substring(0, 30), 280, y)
          .text(`${hw.memory?.total || 'N/A'}`, 450, y)
          .text(`${hw.status || 'Unknown'}`, 520, y)
          .text(`${hw.assigned_to || 'Unassigned'}`.substring(0, 20), 600, y);

        doc.moveDown(0.5);
      });

      // Footer
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .text(
            `Page ${i + 1} of ${pages.count}`,
            50,
            doc.page.height - 50,
            { align: 'center' }
          );
      }

      doc.end();

      stream.on('finish', () => resolve(filepath));
      stream.on('error', reject);
    });
  }

  /**
   * Generate QR code for asset
   */
  async generateQRCode(assetData, filename = 'qrcode.png') {
    const filepath = path.join(this.exportsDir, filename);

    const data = JSON.stringify({
      mac_address: assetData._id || assetData.system?.mac_address,
      hostname: assetData.system?.hostname,
      asset_tag: assetData.asset_info?.asset_tag,
    });

    await QRCode.toFile(filepath, data, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return filepath;
  }

  /**
   * Generate barcode for asset
   */
  async generateBarcode(assetTag, filename = 'barcode.png') {
    const filepath = path.join(this.exportsDir, filename);

    try {
      const buffer = await bwipjs.toBuffer({
        bcid: 'code128',
        text: assetTag,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: 'center',
      });

      await fs.writeFile(filepath, buffer);
      return filepath;
    } catch (error) {
      console.error('Error generating barcode:', error);
      throw error;
    }
  }

  /**
   * Clean up old export files
   */
  async cleanOldExports(maxAgeHours = 24) {
    try {
      const files = await fs.readdir(this.exportsDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;

      for (const file of files) {
        const filepath = path.join(this.exportsDir, file);
        const stats = await fs.stat(filepath);

        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filepath);
          console.log(`Deleted old export file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning old exports:', error);
    }
  }
}

export default ExportManager;

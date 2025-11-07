import csv from 'csv-parser';
import fs from 'fs';
import ExcelJS from 'exceljs';
import Hardware from '../models/hardware.models.js';

/**
 * Import Manager for bulk importing assets
 */
class ImportManager {
  constructor() {
    this.supportedFormats = ['csv', 'xlsx', 'xls'];
  }

  /**
   * Import hardware assets from CSV file
   */
  async importFromCSV(filePath, tenantId, options = {}) {
    const {
      skipDuplicates = true,
      updateExisting = false,
      dryRun = false,
    } = options;

    const results = {
      success: [],
      errors: [],
      skipped: [],
      updated: [],
    };

    return new Promise((resolve, reject) => {
      const records = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          records.push(row);
        })
        .on('end', async () => {
          for (const row of records) {
            try {
              const assetData = this.mapCSVRowToAsset(row, tenantId);

              if (dryRun) {
                results.success.push({
                  mac_address: assetData._id,
                  action: 'would_create',
                });
                continue;
              }

              // Check if asset already exists
              const existing = await Hardware.findById(assetData._id);

              if (existing) {
                if (updateExisting) {
                  await Hardware.findByIdAndUpdate(assetData._id, assetData);
                  results.updated.push(assetData._id);
                } else if (skipDuplicates) {
                  results.skipped.push({
                    mac_address: assetData._id,
                    reason: 'already_exists',
                  });
                } else {
                  results.errors.push({
                    mac_address: assetData._id,
                    error: 'Asset already exists',
                  });
                }
              } else {
                await Hardware.create(assetData);
                results.success.push(assetData._id);
              }
            } catch (error) {
              results.errors.push({
                row: row,
                error: error.message,
              });
            }
          }

          resolve(results);
        })
        .on('error', reject);
    });
  }

  /**
   * Import hardware assets from Excel file
   */
  async importFromExcel(filePath, tenantId, options = {}) {
    const {
      skipDuplicates = true,
      updateExisting = false,
      dryRun = false,
      sheetName = 'Hardware Assets',
    } = options;

    const results = {
      success: [],
      errors: [],
      skipped: [],
      updated: [],
    };

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const worksheet = workbook.getWorksheet(sheetName) || workbook.worksheets[0];

      if (!worksheet) {
        throw new Error('No worksheet found in Excel file');
      }

      // Get headers from first row
      const headers = [];
      worksheet.getRow(1).eachCell((cell) => {
        headers.push(cell.value);
      });

      // Process each row
      worksheet.eachRow(async (row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        try {
          const rowData = {};
          row.eachCell((cell, colNumber) => {
            rowData[headers[colNumber - 1]] = cell.value;
          });

          const assetData = this.mapExcelRowToAsset(rowData, tenantId);

          if (dryRun) {
            results.success.push({
              mac_address: assetData._id,
              action: 'would_create',
            });
            continue;
          }

          // Check if asset already exists
          const existing = await Hardware.findById(assetData._id);

          if (existing) {
            if (updateExisting) {
              await Hardware.findByIdAndUpdate(assetData._id, assetData);
              results.updated.push(assetData._id);
            } else if (skipDuplicates) {
              results.skipped.push({
                mac_address: assetData._id,
                reason: 'already_exists',
              });
            } else {
              results.errors.push({
                mac_address: assetData._id,
                error: 'Asset already exists',
              });
            }
          } else {
            await Hardware.create(assetData);
            results.success.push(assetData._id);
          }
        } catch (error) {
          results.errors.push({
            row: rowNumber,
            error: error.message,
          });
        }
      });

      return results;
    } catch (error) {
      throw new Error(`Failed to import Excel file: ${error.message}`);
    }
  }

  /**
   * Map CSV row to hardware asset format
   */
  mapCSVRowToAsset(row, tenantId) {
    return {
      _id: row['MAC Address'] || row['mac_address'],
      tenant_id: tenantId,
      system: {
        mac_address: row['MAC Address'] || row['mac_address'],
        hostname: row['Hostname'] || row['hostname'] || 'Unknown',
        platform: row['Platform'] || row['platform'] || 'Unknown',
        platform_release: row['Platform Release'] || 'Unknown',
        architecture: row['Architecture'] || 'Unknown',
      },
      cpu: {
        name: row['CPU'] || row['cpu'] || 'Unknown',
        physical_cores: parseInt(row['CPU Cores']?.split('/')[0]) || 0,
        logical_cores: parseInt(row['CPU Cores']?.split('/')[1]) || 0,
      },
      memory: {
        total: row['Memory (Total)'] || row['memory'] || '0 GB',
      },
      storage: {
        total_capacity: row['Storage (Total)'] || row['storage'] || '0 GB',
      },
      asset_info: {
        asset_tag: row['Asset Tag'] || row['asset_tag'] || '',
        vendor: row['Vendor'] || row['vendor'] || 'Unknown',
        purchase_date: row['Purchase Date'] ? new Date(row['Purchase Date']) : null,
        warranty_expiry: row['Warranty Expiry']
          ? new Date(row['Warranty Expiry'])
          : null,
        location: row['Location'] || row['location'] || 'Unknown',
        department: row['Department'] || row['department'] || 'Unknown',
        entry_type: 'csv_import',
      },
      status: row['Status'] || row['status'] || 'Available',
      assigned_to: row['Assigned To'] || row['assigned_to'] || '',
    };
  }

  /**
   * Map Excel row to hardware asset format
   */
  mapExcelRowToAsset(row, tenantId) {
    return this.mapCSVRowToAsset(row, tenantId);
  }

  /**
   * Validate import file format
   */
  validateFormat(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    return this.supportedFormats.includes(extension);
  }

  /**
   * Generate import template
   */
  async generateTemplate(format = 'xlsx', filename = 'import-template') {
    const headers = [
      'MAC Address',
      'Hostname',
      'Platform',
      'CPU',
      'CPU Cores',
      'Memory (Total)',
      'Storage (Total)',
      'Status',
      'Assigned To',
      'Asset Tag',
      'Vendor',
      'Purchase Date',
      'Warranty Expiry',
      'Location',
      'Department',
    ];

    const sampleData = [
      {
        'MAC Address': '00:11:22:33:44:55',
        'Hostname': 'DESKTOP-001',
        'Platform': 'Windows',
        'CPU': 'Intel Core i7-9700K',
        'CPU Cores': '8/16',
        'Memory (Total)': '16 GB',
        'Storage (Total)': '512 GB',
        'Status': 'Available',
        'Assigned To': '',
        'Asset Tag': 'AST-001',
        'Vendor': 'Dell',
        'Purchase Date': '2024-01-15',
        'Warranty Expiry': '2027-01-15',
        'Location': 'HQ Building',
        'Department': 'IT',
      },
    ];

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Hardware Assets');

      worksheet.columns = headers.map((header) => ({
        header,
        key: header,
        width: 20,
      }));

      // Style header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      // Add sample data
      sampleData.forEach((data) => worksheet.addRow(data));

      const filepath = `${filename}.xlsx`;
      await workbook.xlsx.writeFile(filepath);
      return filepath;
    } else if (format === 'csv') {
      const csvWriter = createObjectCsvWriter({
        path: `${filename}.csv`,
        header: headers.map((h) => ({ id: h, title: h })),
      });

      await csvWriter.writeRecords(sampleData);
      return `${filename}.csv`;
    }

    throw new Error(`Unsupported format: ${format}`);
  }
}

export default ImportManager;

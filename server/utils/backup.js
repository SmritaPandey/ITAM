import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Backup Manager for ITAM Enterprise
 * Handles database backups, file backups, and restoration
 */
class BackupManager {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
    this.uploadsDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
    this.mongoUri = process.env.MONGODB_URI;
  }

  /**
   * Initialize backup directory
   */
  async initialize() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`Backup directory initialized: ${this.backupDir}`);
    } catch (error) {
      console.error('Error initializing backup directory:', error);
      throw error;
    }
  }

  /**
   * Create a complete backup (database + files)
   */
  async createFullBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `itam-backup-${timestamp}`;
    const backupPath = path.join(this.backupDir, backupName);

    try {
      await fs.mkdir(backupPath, { recursive: true });

      console.log('Starting full backup...');

      // Backup database
      await this.backupDatabase(backupPath);

      // Backup files
      await this.backupFiles(backupPath);

      // Create compressed archive
      const archivePath = await this.createArchive(backupPath, `${backupName}.tar.gz`);

      // Clean up temporary backup directory
      await fs.rm(backupPath, { recursive: true });

      // Clean old backups
      await this.cleanOldBackups();

      console.log(`Full backup completed: ${archivePath}`);

      return {
        success: true,
        backupPath: archivePath,
        timestamp,
        size: await this.getFileSize(archivePath)
      };
    } catch (error) {
      console.error('Error creating full backup:', error);
      throw error;
    }
  }

  /**
   * Backup MongoDB database
   */
  async backupDatabase(backupPath) {
    console.log('Backing up MongoDB database...');

    const dbBackupPath = path.join(backupPath, 'database');
    await fs.mkdir(dbBackupPath, { recursive: true });

    try {
      // Use mongodump to backup database
      const dumpCommand = `mongodump --uri="${this.mongoUri}" --out="${dbBackupPath}"`;
      const { stdout, stderr } = await execAsync(dumpCommand);

      if (stderr && !stderr.includes('done dumping')) {
        console.warn('MongoDB backup warnings:', stderr);
      }

      console.log('Database backup completed');
      return dbBackupPath;
    } catch (error) {
      console.error('Error backing up database:', error);
      throw new Error(`Database backup failed: ${error.message}`);
    }
  }

  /**
   * Backup uploaded files
   */
  async backupFiles(backupPath) {
    console.log('Backing up uploaded files...');

    const filesBackupPath = path.join(backupPath, 'files');
    
    try {
      // Check if uploads directory exists
      try {
        await fs.access(this.uploadsDir);
      } catch {
        console.log('No uploads directory found, skipping file backup');
        return;
      }

      // Copy uploads directory
      await this.copyDirectory(this.uploadsDir, filesBackupPath);
      
      console.log('Files backup completed');
      return filesBackupPath;
    } catch (error) {
      console.error('Error backing up files:', error);
      throw new Error(`Files backup failed: ${error.message}`);
    }
  }

  /**
   * Create compressed archive
   */
  async createArchive(sourcePath, archiveName) {
    const archivePath = path.join(this.backupDir, archiveName);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(archivePath);
      const archive = archiver('tar', {
        gzip: true,
        gzipOptions: { level: 9 }
      });

      output.on('close', () => {
        console.log(`Archive created: ${archivePath} (${archive.pointer()} bytes)`);
        resolve(archivePath);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(sourcePath, false);
      archive.finalize();
    });
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupFile) {
    console.log(`Restoring from backup: ${backupFile}`);

    const backupPath = path.join(this.backupDir, backupFile);
    const extractPath = path.join(this.backupDir, 'restore-temp');

    try {
      // Extract backup
      await this.extractArchive(backupPath, extractPath);

      // Restore database
      await this.restoreDatabase(path.join(extractPath, 'database'));

      // Restore files
      await this.restoreFiles(path.join(extractPath, 'files'));

      // Clean up
      await fs.rm(extractPath, { recursive: true });

      console.log('Restore completed successfully');
      return { success: true };
    } catch (error) {
      console.error('Error restoring from backup:', error);
      throw error;
    }
  }

  /**
   * Restore MongoDB database
   */
  async restoreDatabase(dbBackupPath) {
    console.log('Restoring MongoDB database...');

    try {
      const restoreCommand = `mongorestore --uri="${this.mongoUri}" --drop "${dbBackupPath}"`;
      const { stdout, stderr } = await execAsync(restoreCommand);

      if (stderr && !stderr.includes('done restoring')) {
        console.warn('MongoDB restore warnings:', stderr);
      }

      console.log('Database restore completed');
    } catch (error) {
      console.error('Error restoring database:', error);
      throw new Error(`Database restore failed: ${error.message}`);
    }
  }

  /**
   * Restore uploaded files
   */
  async restoreFiles(filesBackupPath) {
    console.log('Restoring uploaded files...');

    try {
      // Check if files backup exists
      try {
        await fs.access(filesBackupPath);
      } catch {
        console.log('No files backup found, skipping file restore');
        return;
      }

      // Remove existing uploads
      try {
        await fs.rm(this.uploadsDir, { recursive: true });
      } catch (error) {
        // Directory might not exist
      }

      // Copy backup files
      await this.copyDirectory(filesBackupPath, this.uploadsDir);

      console.log('Files restore completed');
    } catch (error) {
      console.error('Error restoring files:', error);
      throw new Error(`Files restore failed: ${error.message}`);
    }
  }

  /**
   * List available backups
   */
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.tar.gz')) {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          
          backups.push({
            name: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          });
        }
      }

      return backups.sort((a, b) => b.created - a.created);
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  /**
   * Delete old backups based on retention policy
   */
  async cleanOldBackups() {
    console.log('Cleaning old backups...');

    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      let deletedCount = 0;

      for (const backup of backups) {
        if (backup.created < cutoffDate) {
          const filePath = path.join(this.backupDir, backup.name);
          await fs.unlink(filePath);
          console.log(`Deleted old backup: ${backup.name}`);
          deletedCount++;
        }
      }

      console.log(`Cleaned up ${deletedCount} old backup(s)`);
    } catch (error) {
      console.error('Error cleaning old backups:', error);
    }
  }

  /**
   * Helper: Copy directory recursively
   */
  async copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Helper: Extract tar.gz archive
   */
  async extractArchive(archivePath, extractPath) {
    const extractCommand = `tar -xzf "${archivePath}" -C "${extractPath}"`;
    await fs.mkdir(extractPath, { recursive: true });
    await execAsync(extractCommand);
  }

  /**
   * Helper: Get file size
   */
  async getFileSize(filePath) {
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  /**
   * Schedule automatic backups
   */
  scheduleBackups(cronExpression = '0 2 * * *') {
    // This would typically use a library like node-cron
    console.log(`Backup scheduled with cron: ${cronExpression}`);
    // Implementation would go here
  }
}

export default BackupManager;

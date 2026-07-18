import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, JobsOptions, Job } from 'bullmq';
import IORedis from 'ioredis';
import { shouldRunQueueWorkers } from '../process-role';

export type JobName =
  | 'scan.run'
  | 'nvd.ingest'
  | 'ad.sync'
  | 'netflow.rollup'
  | 'patch.catalog.sync'
  | 'search.index'
  | 'email.ingest'
  | 'depreciation.mass';

@Injectable()
export class JobQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobQueueService.name);
  private connection: IORedis | null = null;
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();
  private handlers = new Map<JobName, (job: Job) => Promise<unknown>>();
  private enabled = false;

  async onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn('REDIS_URL not set — job queue runs in-process only');
      return;
    }
    try {
      this.connection = new IORedis(url, { maxRetriesPerRequest: null });
      await this.connection.ping();
      this.enabled = true;
      this.logger.log('Redis job queue connected');
      for (const name of [
        'scan.run',
        'nvd.ingest',
        'ad.sync',
        'netflow.rollup',
        'patch.catalog.sync',
        'search.index',
        'email.ingest',
        'depreciation.mass',
      ] as JobName[]) {
        this.ensureQueue(name);
      }
    } catch (err: any) {
      this.logger.warn(`Redis unavailable (${err.message}) — falling back to inline jobs`);
      this.connection = null;
      this.enabled = false;
    }
  }

  async onModuleDestroy() {
    for (const w of this.workers.values()) await w.close();
    for (const q of this.queues.values()) await q.close();
    if (this.connection) await this.connection.quit();
  }

  registerHandler(name: JobName, handler: (job: Job) => Promise<unknown>) {
    this.handlers.set(name, handler);
    if (this.enabled && shouldRunQueueWorkers()) this.ensureWorker(name);
  }

  async enqueue(name: JobName, data: Record<string, unknown>, opts?: JobsOptions) {
    if (!this.enabled) {
      const handler = this.handlers.get(name);
      if (handler) {
        return handler({ id: 'inline', name, data } as Job);
      }
      this.logger.warn(`No handler for inline job ${name}`);
      return null;
    }
    const queue = this.ensureQueue(name);
    return queue.add(name, data, {
      removeOnComplete: 100,
      removeOnFail: 50,
      ...opts,
    });
  }

  private ensureQueue(name: string): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, { connection: this.connection as any });
      this.queues.set(name, q);
    }
    return q;
  }

  private ensureWorker(name: JobName) {
    if (this.workers.has(name) || !this.connection) return;
    const worker = new Worker(
      name,
      async (job) => {
        const handler = this.handlers.get(name);
        if (!handler) throw new Error(`No handler registered for ${name}`);
        return handler(job);
      },
      { connection: this.connection as any },
    );
    worker.on('failed', (job, err) => {
      this.logger.error(`Job ${name}/${job?.id} failed: ${err.message}`);
    });
    this.workers.set(name, worker);
  }
}

import { LatencyRecord } from '@base-mev/adapters';

export interface LatencyStats {
  count: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
}

export class LatencyTracker {
  private records: LatencyRecord[] = [];
  private perDexRecords: Map<string, number[]> = new Map();

  public record(record: LatencyRecord, dexName?: string): void {
    this.records.push(record);
    if (this.records.length > 50000) {
      this.records.shift();
    }

    if (dexName) {
      const arr = this.perDexRecords.get(dexName) || [];
      arr.push(record.totalLatency);
      if (arr.length > 10000) arr.shift();
      this.perDexRecords.set(dexName, arr);
    }
  }

  public getGlobalStats(): LatencyStats {
    const latencies = this.records.map(r => r.totalLatency).sort((a, b) => a - b);
    return this.calculateStats(latencies);
  }

  public getDexStats(dexName: string): LatencyStats {
    const latencies = (this.perDexRecords.get(dexName) || []).slice().sort((a, b) => a - b);
    return this.calculateStats(latencies);
  }

  private calculateStats(sorted: number[]): LatencyStats {
    if (sorted.length === 0) {
      return { count: 0, mean: 0, median: 0, p95: 0, p99: 0 };
    }

    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / count;
    const median = sorted[Math.floor(count * 0.5)];
    const p95 = sorted[Math.floor(count * 0.95)];
    const p99 = sorted[Math.floor(count * 0.99)];

    return { count, mean, median, p95, p99 };
  }
}

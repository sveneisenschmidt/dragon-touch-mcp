export interface TraceStep {
  step: string;
  ms: number;
}

export interface TraceResult {
  steps: TraceStep[];
  total_ms: number;
}

export class Trace {
  private steps: TraceStep[] = [];
  private last = performance.now();

  mark(step: string): void {
    const now = performance.now();
    this.steps.push({ step, ms: Math.round(now - this.last) });
    this.last = now;
  }

  get total(): number {
    return this.steps.reduce((s, t) => s + t.ms, 0);
  }

  toJSON(): TraceResult {
    return { steps: this.steps, total_ms: this.total };
  }
}

export type ToastPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ToastMessageInput {
  x: number;
  y: number;
  text: string;
  ttlMs: number;
  color: string;
  priority: ToastPriority;
}

export interface ToastSystemOptions {
  maxChars: number;
  maxVisible: number;
  duplicateWindowMs: number;
}

interface ToastMessage extends ToastMessageInput {
  createdAtMs: number;
}

const TOAST_PRIORITY_RANK: Record<ToastPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export class ToastSystem {
  private messages: ToastMessage[] = [];
  private options: ToastSystemOptions;

  constructor(options: ToastSystemOptions) {
    this.options = options;
  }

  clear(): void {
    this.messages = [];
  }

  enqueue(message: ToastMessageInput): void {
    const now = performance.now();
    const normalized: ToastMessageInput = {
      ...message,
      text: formatToastText(message.text, this.options.maxChars),
    };

    const duplicate = this.messages.find(
      (existing) =>
        existing.text === normalized.text &&
        existing.color === normalized.color &&
        now - existing.createdAtMs <= this.options.duplicateWindowMs,
    );
    if (duplicate) {
      duplicate.ttlMs = Math.max(duplicate.ttlMs, normalized.ttlMs);
      duplicate.createdAtMs = now;
      if (getToastPriorityRank(normalized.priority) > getToastPriorityRank(duplicate.priority)) {
        duplicate.priority = normalized.priority;
      }
      return;
    }

    if (this.messages.length >= this.options.maxVisible) {
      const weakestIndex = this.findWeakestMessageIndex();
      if (weakestIndex >= 0) {
        const weakest = this.messages[weakestIndex];
        if (getToastPriorityRank(normalized.priority) < getToastPriorityRank(weakest.priority)) {
          return;
        }
        this.messages.splice(weakestIndex, 1);
      }
    }

    this.messages.push({
      ...normalized,
      createdAtMs: now,
    });
  }

  update(dtSeconds: number): void {
    const deltaMs = dtSeconds * 1000;
    this.messages = this.messages
      .map((message) => ({
        ...message,
        y: message.y - dtSeconds * 24,
        ttlMs: message.ttlMs - deltaMs,
      }))
      .filter((message) => message.ttlMs > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.messages.length === 0) {
      return;
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px "SFMono-Regular", "JetBrains Mono", monospace';

    for (const message of this.messages) {
      const alpha = Math.max(0, Math.min(1, message.ttlMs / 700));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(message.x - 38, message.y - 10, 76, 20);
      ctx.strokeStyle = message.color;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(message.x - 37.5, message.y - 9.5, 75, 19);
      ctx.fillStyle = message.color;
      ctx.fillText(message.text, message.x, message.y + 1);
    }

    ctx.restore();
  }

  private findWeakestMessageIndex(): number {
    if (this.messages.length === 0) {
      return -1;
    }

    let weakestIndex = 0;
    for (let index = 1; index < this.messages.length; index += 1) {
      const candidate = this.messages[index];
      const weakest = this.messages[weakestIndex];
      const candidateRank = getToastPriorityRank(candidate.priority);
      const weakestRank = getToastPriorityRank(weakest.priority);
      if (candidateRank < weakestRank) {
        weakestIndex = index;
        continue;
      }
      if (candidateRank === weakestRank && candidate.createdAtMs < weakest.createdAtMs) {
        weakestIndex = index;
      }
    }

    return weakestIndex;
  }
}

function formatToastText(text: string, maxChars: number): string {
  const normalized = text.replaceAll(/\s+/g, ' ').trim().toUpperCase();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return normalized.slice(0, maxChars);
}

function getToastPriorityRank(priority: ToastPriority): number {
  return TOAST_PRIORITY_RANK[priority];
}

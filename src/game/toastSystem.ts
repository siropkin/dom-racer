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
  driftPxPerSecond: number;
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

    const priorityRank = getToastPriorityRank(normalized.priority);
    const nearbyCount = this.messages.filter((existing) => {
      return Math.hypot(existing.x - normalized.x, existing.y - normalized.y) <= 72;
    }).length;
    const stackLift = Math.min(46, nearbyCount * 12) + priorityRank * 4;

    this.messages.push({
      ...normalized,
      y: normalized.y - stackLift,
      createdAtMs: now,
      driftPxPerSecond: 20 + priorityRank * 6,
    });
  }

  update(dtSeconds: number): void {
    const deltaMs = dtSeconds * 1000;
    this.messages = this.messages
      .map((message) => ({
        ...message,
        y: message.y - dtSeconds * message.driftPxPerSecond,
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
    ctx.font = 'bold 12px "SFMono-Regular", "JetBrains Mono", monospace';

    const ordered = [...this.messages].sort((left, right) => {
      const rankDelta = getToastPriorityRank(right.priority) - getToastPriorityRank(left.priority);
      if (rankDelta !== 0) {
        return rankDelta;
      }
      return right.createdAtMs - left.createdAtMs;
    });
    const placed: Array<{ x: number; y: number; width: number; height: number }> = [];

    for (const message of ordered) {
      const width = getToastWidth(ctx, message.text);
      const height = 20;
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      let x = clamp(message.x, halfWidth + 8, ctx.canvas.width - halfWidth - 8);
      let y = clamp(message.y, halfHeight + 8, ctx.canvas.height - halfHeight - 8);

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const overlap = placed.find((placedToast) =>
          toastsOverlap(
            x,
            y,
            width,
            height,
            placedToast.x,
            placedToast.y,
            placedToast.width,
            placedToast.height,
            6,
          ),
        );
        if (!overlap) {
          break;
        }
        y = overlap.y + overlap.height / 2 + halfHeight + 6;
      }

      if (y > ctx.canvas.height - halfHeight - 8) {
        if (message.priority === 'low') {
          continue;
        }
        y = ctx.canvas.height - halfHeight - 8;
      }

      const alpha = Math.max(0, Math.min(1, message.ttlMs / 700));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.fillRect(x - halfWidth, y - halfHeight, width, height);
      ctx.strokeStyle = message.color;
      ctx.lineWidth = message.priority === 'critical' ? 1.8 : 1.3;
      ctx.strokeRect(x - halfWidth + 0.5, y - halfHeight + 0.5, width - 1, height - 1);
      ctx.fillStyle = message.color;
      ctx.fillText(message.text, x, y + 0.5);

      placed.push({ x, y, width, height });
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

function getToastWidth(ctx: CanvasRenderingContext2D, text: string): number {
  const measured = Math.ceil(ctx.measureText(text).width);
  return clamp(measured + 18, 64, 94);
}

function toastsOverlap(
  aX: number,
  aY: number,
  aWidth: number,
  aHeight: number,
  bX: number,
  bY: number,
  bWidth: number,
  bHeight: number,
  gap: number,
): boolean {
  const horizontal = Math.abs(aX - bX) < (aWidth + bWidth) / 2 + gap;
  const vertical = Math.abs(aY - bY) < (aHeight + bHeight) / 2 + gap;
  return horizontal && vertical;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

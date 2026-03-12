import type { Game, GameDebugEvent, GameDebugSnapshot } from '../game/Game';
import type { InputState } from '../shared/types';

interface DebugApiOptions {
  ensureActive: () => void;
  deactivate: () => void;
  getGame: () => Game | null;
}

export interface AutopilotRunOptions {
  durationMs?: number;
  tickMs?: number;
  preferDirection?: 'down' | 'up';
  jumpIfStuckMs?: number;
}

export interface BatchRunOptions extends AutopilotRunOptions {
  runs?: number;
  cooldownMs?: number;
}

export type AutopilotEvent =
  | GameDebugEvent
  | {
      type: 'decision';
      atMs: number;
      action: string;
      note: string;
    }
  | {
      type: 'stuck';
      atMs: number;
      durationMs: number;
      x: number;
      y: number;
      scrollY: number;
      note: string;
    };

export interface AutopilotSample {
  atMs: number;
  scrollY: number;
  score: number;
  pickupsRemaining: number;
  playerX: number;
  playerY: number;
  boostActive: boolean;
  airborne: boolean;
  speed: number;
  hitX: boolean;
  hitY: boolean;
}

export interface DiagnosticHotspot {
  key: string;
  count: number;
  x: number;
  y: number;
  pageY: number;
}

export interface AutopilotDiagnostics {
  collisionCount: number;
  stuckCount: number;
  averageSpeed: number;
  maxSpeed: number;
  collisionHotspots: DiagnosticHotspot[];
  stuckHotspots: DiagnosticHotspot[];
}

export interface AutopilotReport {
  reason: string;
  url: string;
  title: string;
  durationMs: number;
  initialScore: number;
  finalScore: number;
  pickupsCollected: number;
  scrollDistance: number;
  restarts: number;
  samples: AutopilotSample[];
  events: AutopilotEvent[];
  diagnostics: AutopilotDiagnostics;
}

export interface AutopilotBatchSummary {
  url: string;
  title: string;
  runs: number;
  aggregate: {
    averageFinalScore: number;
    bestFinalScore: number;
    worstFinalScore: number;
    totalPickupsCollected: number;
    totalScrollDistance: number;
    totalRestarts: number;
  };
  diagnostics: {
    totalCollisionCount: number;
    totalStuckCount: number;
    collisionHotspots: DiagnosticHotspot[];
    stuckHotspots: DiagnosticHotspot[];
  };
  reports: AutopilotReport[];
}

export interface DomRacerDebugApi {
  activate: () => void;
  deactivate: () => void;
  snapshot: () => GameDebugSnapshot | null;
  runAutopilot: (options?: AutopilotRunOptions) => Promise<AutopilotReport>;
  runBatch: (options?: BatchRunOptions) => Promise<AutopilotBatchSummary>;
  stopAutopilot: () => AutopilotReport | null;
  latestReport: () => AutopilotReport | null;
  latestBatchSummary: () => AutopilotBatchSummary | null;
  latestEvents: () => AutopilotEvent[];
  downloadLatestReport: (filename?: string) => string | null;
  downloadLatestBatchSummary: (filename?: string) => string | null;
  help: () => string;
}

interface ActiveRun {
  startedAtMs: number;
  initialScore: number;
  lastSnapshot: GameDebugSnapshot;
  lastInputKey: string;
  lastProgressAtMs: number;
  intervalId: number;
  resolve: (report: AutopilotReport) => void;
  samples: AutopilotSample[];
  events: AutopilotEvent[];
  options: Required<AutopilotRunOptions>;
}

declare global {
  interface Window {
    __domRacerDebug?: DomRacerDebugApi;
  }
}

const HOTSPOT_GRID_SIZE = 120;

export function installDebugApi(options: DebugApiOptions): (event: GameDebugEvent) => void {
  let latestReport: AutopilotReport | null = null;
  let latestBatchSummary: AutopilotBatchSummary | null = null;
  let activeRun: ActiveRun | null = null;

  const api: DomRacerDebugApi = {
    activate: options.ensureActive,
    deactivate: options.deactivate,
    snapshot: () => options.getGame()?.getDebugSnapshot() ?? null,
    runAutopilot: (runOptions) => runAutopilot(runOptions),
    runBatch: (batchOptions) => runBatch(batchOptions),
    stopAutopilot: () => finishRun('stopped manually'),
    latestReport: () => latestReport,
    latestBatchSummary: () => latestBatchSummary,
    latestEvents: () => latestReport?.events ?? [],
    downloadLatestReport: (filename) => downloadLatestReport(filename),
    downloadLatestBatchSummary: (filename) => downloadLatestBatchSummary(filename),
    help: () =>
      [
        'DOM Racer debug API',
        'await window.__domRacerDebug.runAutopilot({ durationMs: 15000 })',
        'await window.__domRacerDebug.runBatch({ runs: 5, durationMs: 10000 })',
        'window.__domRacerDebug.snapshot()',
        'window.__domRacerDebug.latestReport()',
        'window.__domRacerDebug.downloadLatestReport()',
      ].join('\n'),
  };

  window.__domRacerDebug = api;

  return (event: GameDebugEvent) => {
    if (!activeRun) {
      return;
    }

    activeRun.events.push(event);
  };

  async function runAutopilot(runOptions: AutopilotRunOptions = {}): Promise<AutopilotReport> {
    if (activeRun) {
      finishRun('restarted by a new autopilot run');
    }

    options.ensureActive();
    const game = options.getGame();
    if (!game) {
      throw new Error('DOM Racer is not active, so autopilot could not start.');
    }

    game.restart();
    const snapshot = game.getDebugSnapshot();
    if (!snapshot) {
      throw new Error('DOM Racer snapshot was unavailable after restart.');
    }

    const normalizedOptions: Required<AutopilotRunOptions> = {
      durationMs: runOptions.durationMs ?? 12000,
      tickMs: runOptions.tickMs ?? 120,
      preferDirection: runOptions.preferDirection ?? 'down',
      jumpIfStuckMs: runOptions.jumpIfStuckMs ?? 900,
    };

    return new Promise<AutopilotReport>((resolve) => {
      const startedAtMs = performance.now();
      const intervalId = window.setInterval(() => {
        stepAutopilot();
      }, normalizedOptions.tickMs);

      activeRun = {
        startedAtMs,
        initialScore: snapshot.score,
        lastSnapshot: snapshot,
        lastInputKey: '',
        lastProgressAtMs: startedAtMs,
        intervalId,
        resolve,
        samples: [toSample(snapshot)],
        events: [
          {
            type: 'decision',
            atMs: startedAtMs,
            action: 'start',
            note: `autopilot started for ${normalizedOptions.durationMs}ms`,
          },
        ],
        options: normalizedOptions,
      };
    });
  }

  async function runBatch(batchOptions: BatchRunOptions = {}): Promise<AutopilotBatchSummary> {
    const normalizedOptions: Required<BatchRunOptions> = {
      runs: batchOptions.runs ?? 5,
      cooldownMs: batchOptions.cooldownMs ?? 250,
      durationMs: batchOptions.durationMs ?? 10000,
      tickMs: batchOptions.tickMs ?? 120,
      preferDirection: batchOptions.preferDirection ?? 'down',
      jumpIfStuckMs: batchOptions.jumpIfStuckMs ?? 900,
    };

    const reports: AutopilotReport[] = [];
    for (let index = 0; index < normalizedOptions.runs; index += 1) {
      const report = await runAutopilot(normalizedOptions);
      reports.push(report);
      if (index < normalizedOptions.runs - 1 && normalizedOptions.cooldownMs > 0) {
        await delay(normalizedOptions.cooldownMs);
      }
    }

    latestBatchSummary = summarizeBatch(reports);
    console.groupCollapsed(
      `[DOM Racer] batch: ${latestBatchSummary.runs} runs, avg score ${latestBatchSummary.aggregate.averageFinalScore.toFixed(1)}`,
    );
    console.log(latestBatchSummary);
    console.groupEnd();
    return latestBatchSummary;
  }

  function stepAutopilot(): void {
    if (!activeRun) {
      return;
    }

    const game = options.getGame();
    const snapshot = game?.getDebugSnapshot();
    if (!game || !snapshot) {
      finishRun('game no longer available');
      return;
    }

    const now = performance.now();
    activeRun.samples.push(toSample(snapshot));

    if (now - activeRun.startedAtMs >= activeRun.options.durationMs) {
      finishRun('duration reached');
      return;
    }

    const target = chooseTarget(snapshot, activeRun.options.preferDirection);
    const nextInput = chooseInput(snapshot, target, activeRun.options.preferDirection);
    game.setDebugInput(nextInput);

    const inputKey = serializeInput(nextInput);
    if (inputKey !== activeRun.lastInputKey) {
      activeRun.events.push({
        type: 'decision',
        atMs: now,
        action: 'input',
        note: target
          ? `steer toward pickup ${target.id}`
          : `cruise ${activeRun.options.preferDirection}`,
      });
      activeRun.lastInputKey = inputKey;
    }

    if (madeProgress(snapshot, activeRun.lastSnapshot)) {
      activeRun.lastProgressAtMs = now;
    }

    if (!snapshot.airborne && now - activeRun.lastProgressAtMs >= activeRun.options.jumpIfStuckMs) {
      activeRun.events.push({
        type: 'stuck',
        atMs: now,
        durationMs: Math.round(now - activeRun.lastProgressAtMs),
        x: snapshot.player.x + snapshot.player.width / 2,
        y: snapshot.player.y + snapshot.player.height / 2,
        scrollY: snapshot.scrollY,
        note: snapshot.hitX || snapshot.hitY ? 'blocked against geometry' : 'low progress detected',
      });
      game.triggerJump();
      activeRun.events.push({
        type: 'decision',
        atMs: now,
        action: 'boost',
        note: 'stuck detector fired a small acceleration burst',
      });
      activeRun.lastProgressAtMs = now;
    }

    activeRun.lastSnapshot = snapshot;
  }

  function finishRun(reason: string): AutopilotReport | null {
    if (!activeRun) {
      return latestReport;
    }

    window.clearInterval(activeRun.intervalId);
    const game = options.getGame();
    game?.setDebugInput(null);

    const finalSnapshot = game?.getDebugSnapshot() ?? activeRun.lastSnapshot;
    const report: AutopilotReport = {
      reason,
      url: window.location.href,
      title: document.title,
      durationMs: Math.round(performance.now() - activeRun.startedAtMs),
      initialScore: activeRun.initialScore,
      finalScore: finalSnapshot.score,
      pickupsCollected: countEvents(activeRun.events, 'pickup'),
      scrollDistance: sumScrollDistance(activeRun.events),
      restarts: countEvents(activeRun.events, 'restart'),
      samples: activeRun.samples,
      events: activeRun.events,
      diagnostics: summarizeDiagnostics(activeRun.samples, activeRun.events),
    };

    latestReport = report;
    activeRun.resolve(report);
    activeRun = null;

    console.groupCollapsed(
      `[DOM Racer] autopilot: score ${report.initialScore} -> ${report.finalScore}, pickups ${report.pickupsCollected}, collisions ${report.diagnostics.collisionCount}, stuck ${report.diagnostics.stuckCount}`,
    );
    console.log(report);
    console.table(
      report.events.map((event) =>
        event.type === 'decision' || event.type === 'stuck'
          ? {
              atMs: Math.round(event.atMs),
              type: event.type,
              detail:
                event.type === 'decision'
                  ? `${event.action}: ${event.note}`
                  : `${event.note} @ (${Math.round(event.x)}, ${Math.round(event.y)})`,
            }
          : { atMs: Math.round(event.atMs), type: event.type, detail: JSON.stringify(event) },
      ),
    );
    console.groupEnd();

    return report;
  }

  function downloadLatestReport(filename = defaultFilename('autopilot-report')): string | null {
    if (!latestReport) {
      return null;
    }

    return downloadJson(latestReport, filename);
  }

  function downloadLatestBatchSummary(filename = defaultFilename('autopilot-batch')): string | null {
    if (!latestBatchSummary) {
      return null;
    }

    return downloadJson(latestBatchSummary, filename);
  }
}

function chooseTarget(
  snapshot: GameDebugSnapshot,
  preferDirection: 'down' | 'up',
): GameDebugSnapshot['pickups'][number] | null {
  if (snapshot.pickups.length === 0) {
    return null;
  }

  const playerCenter = rectCenter(snapshot.player);

  return [...snapshot.pickups].sort((left, right) => {
    const leftScore = pickupPriority(left, playerCenter, preferDirection);
    const rightScore = pickupPriority(right, playerCenter, preferDirection);
    return leftScore - rightScore;
  })[0];
}

function pickupPriority(
  pickup: GameDebugSnapshot['pickups'][number],
  playerCenter: { x: number; y: number },
  preferDirection: 'down' | 'up',
): number {
  const dy = pickup.y - playerCenter.y;
  const directionalPenalty = preferDirection === 'down' ? (dy < -24 ? 80 : 0) : dy > 24 ? 80 : 0;
  return Math.abs(pickup.x - playerCenter.x) + Math.abs(dy) * 1.15 + directionalPenalty;
}

function chooseInput(
  snapshot: GameDebugSnapshot,
  target: GameDebugSnapshot['pickups'][number] | null,
  preferDirection: 'down' | 'up',
): Partial<InputState> {
  const playerCenter = rectCenter(snapshot.player);

  if (!target) {
    return preferDirection === 'down' ? { down: true } : { up: true };
  }

  const dx = target.x - playerCenter.x;
  const dy = target.y - playerCenter.y;

  return {
    left: dx < -8,
    right: dx > 8,
    up: dy < -12,
    down: dy > 12,
  };
}

function madeProgress(current: GameDebugSnapshot, previous: GameDebugSnapshot): boolean {
  const moved =
    Math.hypot(current.player.x - previous.player.x, current.player.y - previous.player.y) > 10;
  const scored = current.score > previous.score;
  const scrolled = Math.abs(current.scrollY - previous.scrollY) > 6;
  return moved || scored || scrolled;
}

function serializeInput(input: Partial<InputState>): string {
  return [input.up ? 'U' : '-', input.down ? 'D' : '-', input.left ? 'L' : '-', input.right ? 'R' : '-'].join('');
}

function toSample(snapshot: GameDebugSnapshot): AutopilotSample {
  return {
    atMs: Math.round(snapshot.atMs),
    scrollY: Math.round(snapshot.scrollY),
    score: snapshot.score,
    pickupsRemaining: snapshot.pickupsRemaining,
    playerX: Math.round(snapshot.player.x),
    playerY: Math.round(snapshot.player.y),
    boostActive: snapshot.boostActive,
    airborne: snapshot.airborne,
    speed: Math.round(snapshot.speed),
    hitX: snapshot.hitX,
    hitY: snapshot.hitY,
  };
}

function summarizeDiagnostics(samples: AutopilotSample[], events: AutopilotEvent[]): AutopilotDiagnostics {
  const speeds = samples.map((sample) => sample.speed);
  const collisionEvents = events.filter((event): event is Extract<AutopilotEvent, { type: 'collision' }> => event.type === 'collision');
  const stuckEvents = events.filter((event): event is Extract<AutopilotEvent, { type: 'stuck' }> => event.type === 'stuck');

  return {
    collisionCount: collisionEvents.length,
    stuckCount: stuckEvents.length,
    averageSpeed: speeds.length === 0 ? 0 : speeds.reduce((sum, value) => sum + value, 0) / speeds.length,
    maxSpeed: speeds.length === 0 ? 0 : Math.max(...speeds),
    collisionHotspots: summarizeHotspots(collisionEvents),
    stuckHotspots: summarizeHotspots(stuckEvents),
  };
}

function summarizeBatch(reports: AutopilotReport[]): AutopilotBatchSummary {
  const finalScores = reports.map((report) => report.finalScore);
  const allEvents = reports.flatMap((report) => report.events);

  return {
    url: window.location.href,
    title: document.title,
    runs: reports.length,
    aggregate: {
      averageFinalScore:
        finalScores.length === 0 ? 0 : finalScores.reduce((sum, value) => sum + value, 0) / finalScores.length,
      bestFinalScore: finalScores.length === 0 ? 0 : Math.max(...finalScores),
      worstFinalScore: finalScores.length === 0 ? 0 : Math.min(...finalScores),
      totalPickupsCollected: reports.reduce((sum, report) => sum + report.pickupsCollected, 0),
      totalScrollDistance: reports.reduce((sum, report) => sum + report.scrollDistance, 0),
      totalRestarts: reports.reduce((sum, report) => sum + report.restarts, 0),
    },
    diagnostics: {
      totalCollisionCount: reports.reduce((sum, report) => sum + report.diagnostics.collisionCount, 0),
      totalStuckCount: reports.reduce((sum, report) => sum + report.diagnostics.stuckCount, 0),
      collisionHotspots: summarizeHotspots(
        allEvents.filter((event): event is Extract<AutopilotEvent, { type: 'collision' }> => event.type === 'collision'),
      ),
      stuckHotspots: summarizeHotspots(
        allEvents.filter((event): event is Extract<AutopilotEvent, { type: 'stuck' }> => event.type === 'stuck'),
      ),
    },
    reports,
  };
}

function summarizeHotspots(
  events: Array<
    | Extract<AutopilotEvent, { type: 'collision' }>
    | Extract<AutopilotEvent, { type: 'stuck' }>
  >,
): DiagnosticHotspot[] {
  const buckets = new Map<string, { count: number; x: number; y: number; pageY: number }>();

  for (const event of events) {
    const pageY = event.y + event.scrollY;
    const key = `${Math.round(event.x / HOTSPOT_GRID_SIZE)}:${Math.round(pageY / HOTSPOT_GRID_SIZE)}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.x += event.x;
      existing.y += event.y;
      existing.pageY += pageY;
    } else {
      buckets.set(key, {
        count: 1,
        x: event.x,
        y: event.y,
        pageY,
      });
    }
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      count: bucket.count,
      x: Math.round(bucket.x / bucket.count),
      y: Math.round(bucket.y / bucket.count),
      pageY: Math.round(bucket.pageY / bucket.count),
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
}

function countEvents(events: AutopilotEvent[], type: 'pickup' | 'restart'): number {
  return events.filter((event) => event.type === type).length;
}

function sumScrollDistance(events: AutopilotEvent[]): number {
  return events.reduce((sum, event) => (event.type === 'scroll' ? sum + event.amount : sum), 0);
}

function downloadJson(payload: unknown, filename: string): string {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

function defaultFilename(prefix: string): string {
  const timestamp = new Date().toISOString().replaceAll(':', '-');
  return `dom-racer-${prefix}-${timestamp}.json`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function rectCenter(rect: { x: number; y: number; width: number; height: number }): { x: number; y: number } {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

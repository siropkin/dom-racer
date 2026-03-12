import { PLAYER_SIZE, type InputState, type Rect, type Vector2, type VehicleDesign, type ViewportSize } from '../shared/types';
import { clamp } from '../shared/utils';
import { moveWithCollisions } from './collisions';

const BASE_SPEED = 250;
const BOOST_SPEED = 360;
const SLOW_ZONE_MULTIPLIER = 0.62;
const RESPONSE = 11;
const FRICTION = 7;
const BOOST_HOLD_MS = 400;

interface PlayerUpdateContext {
  input: InputState;
  dtSeconds: number;
  viewport: ViewportSize;
  obstacles: Rect[];
  boosting: boolean;
  slowed: boolean;
}

interface LastStepDiagnostics {
  hitX: boolean;
  hitY: boolean;
  speed: number;
}

export class Player {
  private position: Vector2;
  private velocity: Vector2;
  private angle: number;
  private vehicleDesign: VehicleDesign;
  private boostTimerMs: number;
  private lastStepDiagnostics: LastStepDiagnostics;

  constructor(spawnPoint: Vector2, vehicleDesign: VehicleDesign) {
    this.position = { ...spawnPoint };
    this.velocity = { x: 0, y: 0 };
    this.angle = -Math.PI / 2;
    this.vehicleDesign = vehicleDesign;
    this.boostTimerMs = 0;
    this.lastStepDiagnostics = { hitX: false, hitY: false, speed: 0 };
  }

  reset(spawnPoint: Vector2): void {
    this.position = { ...spawnPoint };
    this.velocity = { x: 0, y: 0 };
    this.angle = -Math.PI / 2;
    this.boostTimerMs = 0;
    this.lastStepDiagnostics = { hitX: false, hitY: false, speed: 0 };
  }

  update(context: PlayerUpdateContext): void {
    const { input, dtSeconds, viewport, obstacles, boosting, slowed } = context;
    const direction = getInputDirection(input);

    if (boosting) {
      this.boostTimerMs = BOOST_HOLD_MS;
    } else {
      this.boostTimerMs = Math.max(0, this.boostTimerMs - dtSeconds * 1000);
    }

    const topSpeed = (this.boostTimerMs > 0 ? BOOST_SPEED : BASE_SPEED) * (slowed ? SLOW_ZONE_MULTIPLIER : 1);

    if (direction.x !== 0 || direction.y !== 0) {
      const blend = Math.min(1, dtSeconds * RESPONSE);
      this.velocity.x += (direction.x * topSpeed - this.velocity.x) * blend;
      this.velocity.y += (direction.y * topSpeed - this.velocity.y) * blend;
    } else {
      const damping = Math.max(0, 1 - dtSeconds * FRICTION);
      this.velocity.x *= damping;
      this.velocity.y *= damping;
    }

    const movement = {
      x: this.velocity.x * dtSeconds,
      y: this.velocity.y * dtSeconds,
    };
    const attemptedSpeed = dtSeconds > 0 ? Math.hypot(movement.x, movement.y) / dtSeconds : 0;
    const moved = moveWithCollisions(
      this.position,
      PLAYER_SIZE,
      movement,
      obstacles,
    );

    this.position = {
      x: clamp(moved.position.x, 0, viewport.width - PLAYER_SIZE.width),
      y: clamp(moved.position.y, 0, viewport.height - PLAYER_SIZE.height),
    };

    if (moved.hitX) {
      this.velocity.x = 0;
    }

    if (moved.hitY) {
      this.velocity.y = 0;
    }

    if (Math.hypot(this.velocity.x, this.velocity.y) > 8) {
      this.angle = Math.atan2(this.velocity.y, this.velocity.x);
    }

    this.lastStepDiagnostics = {
      hitX: moved.hitX,
      hitY: moved.hitY,
      speed: attemptedSpeed,
    };
  }

  getBounds(): Rect {
    return {
      x: this.position.x,
      y: this.position.y,
      width: PLAYER_SIZE.width,
      height: PLAYER_SIZE.height,
    };
  }

  isBoostActive(): boolean {
    return this.boostTimerMs > 0;
  }

  isAirborne(): boolean {
    return false;
  }

  setVehicleDesign(vehicleDesign: VehicleDesign): void {
    this.vehicleDesign = vehicleDesign;
  }

  getLastStepDiagnostics(): LastStepDiagnostics {
    return this.lastStepDiagnostics;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const bounds = this.getBounds();
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.angle);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(-10, -5, 20, 10);

    ctx.globalAlpha = 1;
    drawWheel(ctx, -5, -10);
    drawWheel(ctx, 5, -10);
    drawWheel(ctx, -5, 10);
    drawWheel(ctx, 5, 10);
    drawVehicleBody(ctx, this.vehicleDesign, false);

    if (this.isBoostActive()) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(-10, -6);
      ctx.lineTo(-10, 6);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-15, -3, 3, 2);
      ctx.fillRect(-15, 1, 3, 2);
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(-17, -2.5, 2, 1.5);
      ctx.fillRect(-17, 1, 2, 1.5);
    }

    ctx.restore();
  }
}

function getInputDirection(input: InputState): Vector2 {
  const x = Number(input.right) - Number(input.left);
  const y = Number(input.down) - Number(input.up);
  const magnitude = Math.hypot(x, y);

  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: x / magnitude,
    y: y / magnitude,
  };
}

function drawWheel(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.roundRect(x - 3.5, y - 1.75, 7, 3.5, 1.4);
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.1;
  ctx.stroke();
}

function drawVehicleBody(ctx: CanvasRenderingContext2D, design: VehicleDesign, airborne: boolean): void {
  switch (design) {
    case 'buggy':
      drawBuggyBody(ctx, airborne);
      return;
    case 'truck':
      drawTruckBody(ctx, airborne);
      return;
    case 'coupe':
    default:
      drawCoupeBody(ctx, airborne);
  }
}

function drawCoupeBody(ctx: CanvasRenderingContext2D, airborne: boolean): void {
  ctx.fillStyle = airborne ? '#60a5fa' : '#2563eb';
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(-11.5, -7.5, 22, 15, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.roundRect(-6.5, -10.5, 12, 21, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-7, -1.5, 13, 3);

  ctx.fillStyle = '#dbeafe';
  ctx.beginPath();
  ctx.roundRect(-1.5, -6, 5, 12, 2);
  ctx.fill();

  ctx.fillStyle = '#111827';
  ctx.fillRect(10.5, -3, 2, 2);
  ctx.fillRect(10.5, 1, 2, 2);

  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(-12.5, -3, 2, 2);
  ctx.fillRect(-12.5, 1, 2, 2);

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-11.5, -7.5, 22, 15, 5);
  ctx.stroke();
}

function drawBuggyBody(ctx: CanvasRenderingContext2D, airborne: boolean): void {
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.6;
  ctx.fillStyle = airborne ? '#fb923c' : '#f97316';
  ctx.beginPath();
  ctx.roundRect(-10.5, -7, 20, 14, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#7c2d12';
  ctx.fillRect(-7, -8.5, 9, 17);
  ctx.fillRect(3.5, -5.5, 4, 11);

  ctx.strokeStyle = '#fdba74';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-4.5, -8.5);
  ctx.lineTo(3.5, -2.5);
  ctx.moveTo(-4.5, 8.5);
  ctx.lineTo(3.5, 2.5);
  ctx.stroke();

  ctx.fillStyle = '#fed7aa';
  ctx.fillRect(-1.5, -4, 5, 8);
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(-9.5, -1.5, 2, 3);
  ctx.fillRect(8.5, -1.5, 2, 3);
}

function drawTruckBody(ctx: CanvasRenderingContext2D, airborne: boolean): void {
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.7;
  ctx.fillStyle = airborne ? '#34d399' : '#059669';
  ctx.beginPath();
  ctx.roundRect(-12, -7.5, 24, 15, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#064e3b';
  ctx.beginPath();
  ctx.roundRect(-1.5, -7.5, 12.5, 15, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#d1fae5';
  ctx.fillRect(1.5, -4.5, 6.5, 4);
  ctx.fillStyle = '#a7f3d0';
  ctx.fillRect(-9, -5, 6, 10);

  ctx.fillStyle = '#111827';
  ctx.fillRect(10.5, -2.5, 2, 2);
  ctx.fillRect(10.5, 0.5, 2, 2);
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(-12.5, -2.5, 2, 2);
  ctx.fillRect(-12.5, 0.5, 2, 2);

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-12, -7.5, 24, 15, 4);
  ctx.stroke();
}

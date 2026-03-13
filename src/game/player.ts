import {
  PLAYER_SIZE,
  type InputState,
  type Rect,
  type Vector2,
  type VehicleDesign,
  type ViewportSize,
} from '../shared/types';
import { clamp } from '../shared/utils';
import { moveWithCollisions } from './collisions';
import { renderPlayerSprite } from './playerSprite';

const BASE_SPEED = 250;
const BOOST_SPEED = 360;
const SLOW_ZONE_MULTIPLIER = 0.62;
const RESPONSE = 11;
const FRICTION = 7;
const ICE_RESPONSE = 2.1;
const ICE_FRICTION = 0.42;
const ICE_TOP_SPEED_MULTIPLIER = 1.08;
const ICE_ENTRY_BURST_MS = 240;
const ICE_ENTRY_BURST_MULTIPLIER = 1.12;
const ICE_DRIFT_RESEED_MIN_MS = 90;
const ICE_DRIFT_RESEED_MAX_MS = 220;
const ICE_DRIFT_INPUT_INFLUENCE = 0.2;
const ICE_DRIFT_ACCELERATION = 26;
const BOOST_HOLD_MS = 400;

interface PlayerUpdateContext {
  input: InputState;
  dtSeconds: number;
  viewport: ViewportSize;
  obstacles: Rect[];
  boosting: boolean;
  slowed: boolean;
  onIce: boolean;
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
  private onIceLastFrame: boolean;
  private iceEntryBoostMs: number;
  private iceDriftDirection: Vector2;
  private iceDriftRetargetMs: number;
  private lastStepDiagnostics: LastStepDiagnostics;

  constructor(spawnPoint: Vector2, vehicleDesign: VehicleDesign) {
    this.position = { ...spawnPoint };
    this.velocity = { x: 0, y: 0 };
    this.angle = -Math.PI / 2;
    this.vehicleDesign = vehicleDesign;
    this.boostTimerMs = 0;
    this.onIceLastFrame = false;
    this.iceEntryBoostMs = 0;
    this.iceDriftDirection = { x: 0, y: 0 };
    this.iceDriftRetargetMs = 0;
    this.lastStepDiagnostics = { hitX: false, hitY: false, speed: 0 };
  }

  reset(spawnPoint: Vector2): void {
    this.position = { ...spawnPoint };
    this.velocity = { x: 0, y: 0 };
    this.angle = -Math.PI / 2;
    this.boostTimerMs = 0;
    this.onIceLastFrame = false;
    this.iceEntryBoostMs = 0;
    this.iceDriftDirection = { x: 0, y: 0 };
    this.iceDriftRetargetMs = 0;
    this.lastStepDiagnostics = { hitX: false, hitY: false, speed: 0 };
  }

  update(context: PlayerUpdateContext): void {
    const { input, dtSeconds, viewport, obstacles, boosting, slowed, onIce } = context;
    const direction = getInputDirection(input);

    if (boosting) {
      this.boostTimerMs = BOOST_HOLD_MS;
    } else {
      this.boostTimerMs = Math.max(0, this.boostTimerMs - dtSeconds * 1000);
    }

    if (onIce && !this.onIceLastFrame) {
      this.iceEntryBoostMs = ICE_ENTRY_BURST_MS;
    }
    this.onIceLastFrame = onIce;

    if (onIce) {
      this.iceEntryBoostMs = Math.max(0, this.iceEntryBoostMs - dtSeconds * 1000);
      this.iceDriftRetargetMs = Math.max(0, this.iceDriftRetargetMs - dtSeconds * 1000);
      if (this.iceDriftRetargetMs === 0) {
        const angle = Math.random() * Math.PI * 2;
        this.iceDriftDirection = { x: Math.cos(angle), y: Math.sin(angle) };
        this.iceDriftRetargetMs = randomBetween(ICE_DRIFT_RESEED_MIN_MS, ICE_DRIFT_RESEED_MAX_MS);
      }
    } else {
      this.iceEntryBoostMs = 0;
      this.iceDriftRetargetMs = 0;
      this.iceDriftDirection = { x: 0, y: 0 };
    }

    const iceEntryMultiplier = onIce && this.iceEntryBoostMs > 0 ? ICE_ENTRY_BURST_MULTIPLIER : 1;
    const topSpeed =
      (this.boostTimerMs > 0 ? BOOST_SPEED : BASE_SPEED) *
      (slowed ? SLOW_ZONE_MULTIPLIER : 1) *
      (onIce ? ICE_TOP_SPEED_MULTIPLIER : 1) *
      iceEntryMultiplier;
    const response = onIce ? ICE_RESPONSE : RESPONSE;
    const friction = onIce ? ICE_FRICTION : FRICTION;

    if (direction.x !== 0 || direction.y !== 0) {
      let steerDirection = direction;
      if (onIce) {
        const driftedX = direction.x + this.iceDriftDirection.x * ICE_DRIFT_INPUT_INFLUENCE;
        const driftedY = direction.y + this.iceDriftDirection.y * ICE_DRIFT_INPUT_INFLUENCE;
        const driftedMagnitude = Math.hypot(driftedX, driftedY);
        if (driftedMagnitude > 0.0001) {
          steerDirection = {
            x: driftedX / driftedMagnitude,
            y: driftedY / driftedMagnitude,
          };
        }
      }

      let blend = Math.min(1, dtSeconds * response);
      if (onIce) {
        const speed = Math.hypot(this.velocity.x, this.velocity.y);
        if (speed > 8) {
          const alignment = (this.velocity.x * direction.x + this.velocity.y * direction.y) / speed;
          // Turning against momentum on ice should feel much looser.
          const steeringGrip = alignment < 0 ? 0.34 : 0.52 + Math.max(0, alignment) * 0.3;
          blend *= steeringGrip;
        }
      }
      this.velocity.x += (steerDirection.x * topSpeed - this.velocity.x) * blend;
      this.velocity.y += (steerDirection.y * topSpeed - this.velocity.y) * blend;
    } else {
      const damping = Math.max(0, 1 - dtSeconds * friction);
      this.velocity.x *= damping;
      this.velocity.y *= damping;
    }

    if (onIce) {
      const speed = Math.hypot(this.velocity.x, this.velocity.y);
      if (speed > 20) {
        const driftStrength = Math.min(1, speed / 210);
        this.velocity.x +=
          this.iceDriftDirection.x * ICE_DRIFT_ACCELERATION * driftStrength * dtSeconds;
        this.velocity.y +=
          this.iceDriftDirection.y * ICE_DRIFT_ACCELERATION * driftStrength * dtSeconds;
      }
    }

    const movement = {
      x: this.velocity.x * dtSeconds,
      y: this.velocity.y * dtSeconds,
    };
    const attemptedSpeed = dtSeconds > 0 ? Math.hypot(movement.x, movement.y) / dtSeconds : 0;
    const moved = moveWithCollisions(this.position, PLAYER_SIZE, movement, obstacles);

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

  draw(
    ctx: CanvasRenderingContext2D,
    options?: { opacity?: number; magnetActive?: boolean },
  ): void {
    const bounds = this.getBounds();
    const opacity = Math.max(0.2, Math.min(1, options?.opacity ?? 1));
    renderPlayerSprite(ctx, {
      centerX: bounds.x + bounds.width / 2,
      centerY: bounds.y + bounds.height / 2,
      angle: this.angle,
      design: this.vehicleDesign,
      boostActive: this.isBoostActive(),
      magnetActive: options?.magnetActive ?? false,
      opacity,
      nowMs: performance.now(),
      airborne: false,
    });
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

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

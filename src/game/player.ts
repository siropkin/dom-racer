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
import { PLAYER, TIMING, VEHICLE_STATS } from './gameConfig';
import { randomBetween } from './gameRuntime';
import { renderPlayerSprite } from './sprites';

interface PlayerUpdateContext {
  input: InputState;
  dtSeconds: number;
  viewport: ViewportSize;
  obstacles: Rect[];
  boosting: boolean;
  onIce: boolean;
  speedMultiplier?: number;
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
  private previousAngle: number;
  private vehicleDesign: VehicleDesign;
  private boostTimerMs: number;
  private onIceLastFrame: boolean;
  private wasAirborneLastFrame: boolean;
  private landingTimerMs: number;
  private celebrationTimerMs: number;
  private iceEntryBoostMs: number;
  private iceDriftDirection: Vector2;
  private iceDriftRetargetMs: number;
  private lastStepDiagnostics: LastStepDiagnostics;

  constructor(spawnPoint: Vector2, vehicleDesign: VehicleDesign) {
    this.position = { ...spawnPoint };
    this.velocity = { x: 0, y: 0 };
    this.angle = -Math.PI / 2;
    this.previousAngle = -Math.PI / 2;
    this.vehicleDesign = vehicleDesign;
    this.boostTimerMs = 0;
    this.onIceLastFrame = false;
    this.wasAirborneLastFrame = false;
    this.landingTimerMs = 0;
    this.celebrationTimerMs = 0;
    this.iceEntryBoostMs = 0;
    this.iceDriftDirection = { x: 0, y: 0 };
    this.iceDriftRetargetMs = 0;
    this.lastStepDiagnostics = { hitX: false, hitY: false, speed: 0 };
  }

  reset(spawnPoint: Vector2): void {
    this.position = { ...spawnPoint };
    this.velocity = { x: 0, y: 0 };
    this.angle = -Math.PI / 2;
    this.previousAngle = -Math.PI / 2;
    this.boostTimerMs = 0;
    this.onIceLastFrame = false;
    this.wasAirborneLastFrame = false;
    this.landingTimerMs = 0;
    this.celebrationTimerMs = 0;
    this.iceEntryBoostMs = 0;
    this.iceDriftDirection = { x: 0, y: 0 };
    this.iceDriftRetargetMs = 0;
    this.lastStepDiagnostics = { hitX: false, hitY: false, speed: 0 };
  }

  update(context: PlayerUpdateContext): void {
    const { input, dtSeconds, viewport, obstacles, boosting, onIce } = context;
    this.previousAngle = this.angle;

    const currentlyAirborne = this.isAirborne();
    if (this.wasAirborneLastFrame && !currentlyAirborne) {
      this.landingTimerMs = 150;
    }
    this.wasAirborneLastFrame = currentlyAirborne;
    this.landingTimerMs = Math.max(0, this.landingTimerMs - dtSeconds * 1000);
    this.celebrationTimerMs = Math.max(0, this.celebrationTimerMs - dtSeconds * 1000);

    const direction = getInputDirection(input);

    if (boosting) {
      this.boostTimerMs = TIMING.BOOST_HOLD_MS;
    } else {
      this.boostTimerMs = Math.max(0, this.boostTimerMs - dtSeconds * 1000);
    }

    if (onIce && !this.onIceLastFrame) {
      this.iceEntryBoostMs = PLAYER.ICE_ENTRY_BURST_MS;
    }
    this.onIceLastFrame = onIce;

    if (onIce) {
      this.iceEntryBoostMs = Math.max(0, this.iceEntryBoostMs - dtSeconds * 1000);
      this.iceDriftRetargetMs = Math.max(0, this.iceDriftRetargetMs - dtSeconds * 1000);
      if (this.iceDriftRetargetMs === 0) {
        const angle = Math.random() * Math.PI * 2;
        this.iceDriftDirection = { x: Math.cos(angle), y: Math.sin(angle) };
        this.iceDriftRetargetMs = randomBetween(
          PLAYER.ICE_DRIFT_RESEED_MIN_MS,
          PLAYER.ICE_DRIFT_RESEED_MAX_MS,
        );
      }
    } else {
      this.iceEntryBoostMs = 0;
      this.iceDriftRetargetMs = 0;
      this.iceDriftDirection = { x: 0, y: 0 };
    }

    const stats = VEHICLE_STATS[this.vehicleDesign];
    const iceEntryMultiplier =
      onIce && this.iceEntryBoostMs > 0 ? PLAYER.ICE_ENTRY_BURST_MULTIPLIER : 1;
    const extraMultiplier = context.speedMultiplier ?? 1;
    const topSpeed =
      (this.boostTimerMs > 0 ? stats.boostSpeed : stats.baseSpeed) *
      (onIce ? PLAYER.ICE_TOP_SPEED_MULTIPLIER : 1) *
      iceEntryMultiplier *
      extraMultiplier;
    const response = onIce ? PLAYER.ICE_RESPONSE : stats.response;
    const friction = onIce ? PLAYER.ICE_FRICTION : stats.friction;

    if (direction.x !== 0 || direction.y !== 0) {
      let steerDirection = direction;
      if (onIce) {
        const driftedX = direction.x + this.iceDriftDirection.x * PLAYER.ICE_DRIFT_INPUT_INFLUENCE;
        const driftedY = direction.y + this.iceDriftDirection.y * PLAYER.ICE_DRIFT_INPUT_INFLUENCE;
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
          this.iceDriftDirection.x * PLAYER.ICE_DRIFT_ACCELERATION * driftStrength * dtSeconds;
        this.velocity.y +=
          this.iceDriftDirection.y * PLAYER.ICE_DRIFT_ACCELERATION * driftStrength * dtSeconds;
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

  getAngle(): number {
    return this.angle;
  }

  getAngularDelta(): number {
    let delta = this.angle - this.previousAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return Math.abs(delta);
  }

  getLandingSquashScale(): { scaleX: number; scaleY: number } {
    if (this.landingTimerMs <= 0) return { scaleX: 1, scaleY: 1 };
    const t = this.landingTimerMs / 150;
    return { scaleX: 1 + 0.15 * t, scaleY: 1 - 0.15 * t };
  }

  triggerCelebration(): void {
    this.celebrationTimerMs = 350;
  }

  getCelebrationScale(): number {
    if (this.celebrationTimerMs <= 0) return 1;
    const t = this.celebrationTimerMs / 350;
    return 1 + 0.3 * Math.sin(t * Math.PI) * t;
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
    const squash = this.getLandingSquashScale();
    const celebScale = this.getCelebrationScale();
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
      scaleX: squash.scaleX * celebScale,
      scaleY: squash.scaleY * celebScale,
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

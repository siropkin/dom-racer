/**
 * Centralized gameplay tuning constants.
 *
 * Grouped by system so all timing, scoring, and spacing knobs
 * are discoverable in one place instead of scattered across runtime files.
 */

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

export const TIMING = {
  UNPAUSE_GRACE_MS: 1_500,
  POLICE_WARNING_MS: 1_100,
  PLANE_WARNING_MS: 900,
  BOOST_HOLD_MS: 400,
  NITRO_DURATION_MS: 400,
} as const;

// ---------------------------------------------------------------------------
// Toast presentation
// ---------------------------------------------------------------------------

export const TOAST = {
  MAX_CHARS: 11,
  MAX_VISIBLE: 8,
  DUPLICATE_WINDOW_MS: 260,
  PICKUP_TTL_MS: 1_200,
  EFFECT_TTL_MS: 1_400,
  RUN_START_TTL_MS: 2_200,
} as const;

// ---------------------------------------------------------------------------
// Regular coin economy
// ---------------------------------------------------------------------------

export const COINS = {
  SCORE: 10,
  STARTING_BATCH: 7,
  VISIBLE_CAP: 11,
  REFILL_MIN_MS: 1_600,
  REFILL_MAX_MS: 2_400,
  REFILL_FAST_MIN_MS: 900,
  REFILL_FAST_MAX_MS: 1_400,
  REFILL_LOW_MIN_MS: 750,
  REFILL_LOW_MAX_MS: 1_150,
  LOW_PRESSURE_THRESHOLD: 4,
  RETRY_MIN_MS: 550,
  RETRY_MAX_MS: 900,
  REFILL_BOOST_MS: 2_200,
} as const;

// ---------------------------------------------------------------------------
// Special pickups
// ---------------------------------------------------------------------------

export const SPECIALS = {
  VISIBLE_CAP: 2,
  INITIAL_SPAWN_MIN_MS: 4_800,
  INITIAL_SPAWN_MAX_MS: 7_600,
  RESPAWN_MIN_MS: 7_400,
  RESPAWN_MAX_MS: 11_200,
  RETRY_MIN_MS: 2_400,
  RETRY_MAX_MS: 3_600,
  CAP_RETRY_MIN_MS: 2_600,
  CAP_RETRY_MAX_MS: 4_200,
  BONUS_SCORE: 40,
  PREFERRED_EFFECT_BIAS: 0.52,
  MYSTERY_GUARANTEE_INTERVAL: 3,
  HARMFUL_MAGNET_RADIUS_PX: 90,
  HARMFUL_MAGNET_SPEED: 60,
} as const;

// ---------------------------------------------------------------------------
// Special-effect durations
// ---------------------------------------------------------------------------

export const EFFECTS = {
  INVERT_DURATION_MS: 5_200,
  MAGNET_DURATION_MS: 6_200,
  GHOST_DURATION_MS: 5_600,
  BLUR_DURATION_MS: 4_500,
  OIL_SLICK_DURATION_MS: 3_500,
  OIL_SLICK_SPEED_MULTIPLIER: 0.35,
  REVERSE_DURATION_MS: 3_500,
} as const;

// ---------------------------------------------------------------------------
// Jackpot
// ---------------------------------------------------------------------------

export const JACKPOT = {
  SCORE_MIN: 50,
  SCORE_MAX: 100,
  SPAWN_CHANCE: 0.06,
  PICKUP_SIZE: 26,
} as const;

// ---------------------------------------------------------------------------
// Police encounter
// ---------------------------------------------------------------------------

export const POLICE = {
  START_DELAY_MS: 8_000,
  START_SCORE_THRESHOLD: 20,
  START_COINS_THRESHOLD: 4,
  INITIAL_SPAWN_MIN_MS: 6_000,
  INITIAL_SPAWN_MAX_MS: 10_000,
  RESPAWN_MIN_MS: 11_000,
  RESPAWN_MAX_MS: 17_000,
  POST_SPAWN_MIN_MS: 14_000,
  POST_SPAWN_MAX_MS: 20_000,
  CHASE_DURATION_MIN_MS: 4_000,
  CHASE_DURATION_MAX_MS: 6_000,
  ICE_SPEED_MULTIPLIER: 1.08,
  ICE_TURN_RATE: 3.6,
  HELICOPTER_CHASE_THRESHOLD: 4,
  HELICOPTER_MIN_RUN_TIME_MS: 60_000,
  HELICOPTER_SPEED: 140,
  HELICOPTER_TURN_BLEND: 6,
  HELICOPTER_DURATION_ESCALATION_MS: 2_000,
  HELICOPTER_SPEED_ESCALATION: 15,
  HELICOPTER_MAX_DURATION_MS: 16_000,
  HELICOPTER_MAX_SPEED: 220,
} as const;

// ---------------------------------------------------------------------------
// Plane encounter
// ---------------------------------------------------------------------------

export const PLANE = {
  EVENT_MIN_SCORE: 40,
  EVENT_SPEED: 188,
  EVENT_ENTRY_OFFSET: 56,
  EVENT_CORNER_SPAN: 110,
  INITIAL_MIN_MS: 14_000,
  INITIAL_MAX_MS: 22_000,
  RESPAWN_MIN_MS: 20_000,
  RESPAWN_MAX_MS: 30_000,
  BONUS_PICKUP_SIZE: 20,
  COIN_TRAIL_CHANCE: 0.36,
  COIN_TRAIL_LENGTH_PX: 188,
  COIN_TRAIL_COIN_SIZE_PX: 16,
  COIN_TRAIL_STEP_PX: 24,
  SPOTLIGHT_CHANCE: 0.2,
  SPOTLIGHT_CUE_DURATION_MS: 2_200,
  LUCKY_WIND_CHANCE: 0.14,
  LUCKY_WIND_RADIUS_PX: 180,
  LUCKY_WIND_ROUTE_HALF_SPAN_PX: 120,
  LUCKY_WIND_MAX_SHIFT_PX: 36,
  LUCKY_WIND_MAX_COINS: 8,
  POLICE_DELAY_MODE_CHANCE: 0.36,
  POLICE_DELAY_MIN_MS: 2_600,
  POLICE_DELAY_MAX_MS: 4_200,
  LANE_SPECIAL_STAGGER_MS: 1_500,
  MYSTERY_DROP_CHANCE: 0.18,
} as const;

// ---------------------------------------------------------------------------
// Train encounter
// ---------------------------------------------------------------------------

export const TRAIN = {
  MIN_RUN_TIME_MS: 30_000,
  SPEED: 320,
  WARNING_MS: 1_500,
  BODY_HEIGHT: 20,
  HITBOX_HEIGHT: 16,
  COOLDOWN_MS: 35_000,
  MAX_PER_RUN: 3,
  INITIAL_MIN_MS: 28_000,
  INITIAL_MAX_MS: 42_000,
  LATE_GAME_THRESHOLD_MS: 90_000,
  LATE_GAME_COOLDOWN_MULTIPLIER: 0.65,
} as const;

// ---------------------------------------------------------------------------
// Encounter stagger (shared between plane & police)
// ---------------------------------------------------------------------------

export const ENCOUNTER = {
  STAGGER_MS: 3_800,
  PLANE_AFTER_POLICE_MIN_MS: 8_000,
  PLANE_AFTER_POLICE_MAX_MS: 12_000,
  POLICE_AFTER_PLANE_MIN_MS: 4_500,
  POLICE_AFTER_PLANE_MAX_MS: 7_000,
} as const;

// ---------------------------------------------------------------------------
// Overgrowth
// ---------------------------------------------------------------------------

export const OVERGROWTH = {
  SPAWN_START_MS: 35_000,
  SPAWN_INTERVAL_MIN_MS: 9_000,
  SPAWN_INTERVAL_MAX_MS: 15_000,
  MAX_NODES: 8,
  GROWTH_GRASS_TO_BUSH_MS: 6_000,
  GROWTH_BUSH_TO_TREE_MS: 10_000,
} as const;

// ---------------------------------------------------------------------------
// Near-miss
// ---------------------------------------------------------------------------

export const NEAR_MISS = {
  COOLDOWN_MS: 800,
  THRESHOLD_PX: 5,
  COLOR: '#fb923c',
  TOAST_TTL_MS: 800,
} as const;

// ---------------------------------------------------------------------------
// Micro-objectives
// ---------------------------------------------------------------------------

export const OBJECTIVES = {
  INITIAL_DELAY_MIN_MS: 6_000,
  INITIAL_DELAY_MAX_MS: 10_000,
  COMPLETE_DELAY_MIN_MS: 4_000,
  COMPLETE_DELAY_MAX_MS: 8_000,
  EXPIRE_DELAY_MIN_MS: 3_000,
  EXPIRE_DELAY_MAX_MS: 5_000,
  COMPLETION_COLOR: '#a78bfa',
  TOAST_TTL_MS: 800,
} as const;

// ---------------------------------------------------------------------------
// Vehicle unlock thresholds (lifetime total score)
// ---------------------------------------------------------------------------

export const VEHICLES = {
  BUGGY_UNLOCK_SCORE: 500,
  TRUCK_UNLOCK_SCORE: 1_500,
} as const;

// ---------------------------------------------------------------------------
// Per-vehicle physics profiles
// ---------------------------------------------------------------------------

export const VEHICLE_STATS: Readonly<
  Record<
    string,
    {
      baseSpeed: number;
      boostSpeed: number;
      response: number;
      friction: number;
      nitroCooldownMs: number;
    }
  >
> = {
  coupe: { baseSpeed: 250, boostSpeed: 360, response: 11, friction: 7, nitroCooldownMs: 3_000 },
  buggy: { baseSpeed: 235, boostSpeed: 340, response: 15, friction: 5, nitroCooldownMs: 2_200 },
  truck: { baseSpeed: 275, boostSpeed: 395, response: 8, friction: 9, nitroCooldownMs: 3_800 },
};

// ---------------------------------------------------------------------------
// Player physics (shared across all vehicles)
// ---------------------------------------------------------------------------

export const PLAYER = {
  ICE_RESPONSE: 1.5,
  ICE_FRICTION: 0.25,
  ICE_TOP_SPEED_MULTIPLIER: 1.08,
  ICE_ENTRY_BURST_MS: 240,
  ICE_ENTRY_BURST_MULTIPLIER: 1.12,
  ICE_DRIFT_RESEED_MIN_MS: 90,
  ICE_DRIFT_RESEED_MAX_MS: 220,
  ICE_DRIFT_INPUT_INFLUENCE: 0.32,
  ICE_DRIFT_ACCELERATION: 58,
} as const;

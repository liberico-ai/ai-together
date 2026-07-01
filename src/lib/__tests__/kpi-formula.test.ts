import { describe, it, expect } from 'vitest';
import {
  clampScore,
  composite,
  KPI_WEIGHTS,
  CLAMP_MIN,
  CLAMP_MAX,
} from '../kpi-math';

describe('clampScore', () => {
  it('passes through values already within [0.5, 1.5]', () => {
    expect(clampScore(0.5)).toBe(0.5);
    expect(clampScore(1)).toBe(1);
    expect(clampScore(1.5)).toBe(1.5);
    expect(clampScore(0.87)).toBeCloseTo(0.87);
  });

  it('clamps values below the floor up to CLAMP_MIN', () => {
    expect(clampScore(0)).toBe(CLAMP_MIN);
    expect(clampScore(-3)).toBe(CLAMP_MIN);
    expect(clampScore(0.49)).toBe(CLAMP_MIN);
  });

  it('clamps values above the ceiling down to CLAMP_MAX', () => {
    expect(clampScore(2)).toBe(CLAMP_MAX);
    expect(clampScore(100)).toBe(CLAMP_MAX);
    expect(clampScore(1.51)).toBe(CLAMP_MAX);
  });

  it('treats any non-finite input as the floor', () => {
    // clampScore rejects non-finite values up front, so Infinity/-Infinity/NaN all floor.
    expect(clampScore(NaN)).toBe(CLAMP_MIN);
    expect(clampScore(Infinity)).toBe(CLAMP_MIN);
    expect(clampScore(-Infinity)).toBe(CLAMP_MIN);
  });
});

describe('composite', () => {
  it('uses the 0.35 / 0.25 / 0.25 / 0.15 weighting', () => {
    // Sanity: weights sum to 1 so an all-1 profile yields exactly 1.
    expect(KPI_WEIGHTS.tempo + KPI_WEIGHTS.completion + KPI_WEIGHTS.quality + KPI_WEIGHTS.ai).toBeCloseTo(1);
    expect(composite({ tempo: 1, completion: 1, quality: 1, ai: 1 })).toBeCloseTo(1);
  });

  it('computes the weighted sum for a mixed profile', () => {
    const result = composite({ tempo: 1.5, completion: 1, quality: 0.5, ai: 1 });
    // 0.35*1.5 + 0.25*1 + 0.25*0.5 + 0.15*1 = 0.525 + 0.25 + 0.125 + 0.15 = 1.05
    expect(result).toBeCloseTo(1.05);
  });

  it('clamps each axis before weighting', () => {
    // Raw tempo 3 → clamped to 1.5; raw quality -1 → clamped to 0.5.
    const result = composite({ tempo: 3, completion: 1, quality: -1, ai: 1 });
    // 0.35*1.5 + 0.25*1 + 0.25*0.5 + 0.15*1 = 1.05
    expect(result).toBeCloseTo(1.05);
  });

  it('returns the floor when every axis is at or below the floor', () => {
    expect(composite({ tempo: 0, completion: 0, quality: 0, ai: 0 })).toBeCloseTo(CLAMP_MIN);
  });

  it('returns the ceiling when every axis is at or above the ceiling', () => {
    expect(composite({ tempo: 5, completion: 5, quality: 5, ai: 5 })).toBeCloseTo(CLAMP_MAX);
  });

  it('always yields a result within [0.5, 1.5]', () => {
    const samples: Array<[number, number, number, number]> = [
      [0, 0, 0, 0],
      [10, -10, 3, 0.2],
      [1.2, 0.8, 1.0, 1.4],
      [NaN, 1, 1, 1],
    ];
    for (const [tempo, completion, quality, ai] of samples) {
      const r = composite({ tempo, completion, quality, ai });
      expect(r).toBeGreaterThanOrEqual(CLAMP_MIN);
      expect(r).toBeLessThanOrEqual(CLAMP_MAX);
    }
  });
});

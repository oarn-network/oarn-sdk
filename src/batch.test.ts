import { describe, it, expect } from 'vitest';
import {
  generateParameterGrid,
  findOptimalByMetric,
  filterByThreshold,
  getTopN,
  calculateMetricStats,
  createBatchInputManifest,
  validateBatchInputManifest,
  validateBatchResultManifest,
  computeAggregatedHash,
  computeInputsChecksum,
} from './batch.js';
import type { BatchResult, BatchResultManifest } from './batch.js';

// ============================================
// generateParameterGrid
// ============================================

describe('generateParameterGrid', () => {
  it('returns single empty-params entry for empty config', () => {
    const result = generateParameterGrid({});
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 0, params: {} });
  });

  it('generates range values with correct step count', () => {
    const result = generateParameterGrid({
      temp: { min: 0, max: 100, steps: 3 },
    });
    expect(result).toHaveLength(3);
    expect(result[0].params['temp']).toBeCloseTo(0);
    expect(result[1].params['temp']).toBeCloseTo(50);
    expect(result[2].params['temp']).toBeCloseTo(100);
  });

  it('handles explicit array values', () => {
    const result = generateParameterGrid({
      catalyst: [0.01, 0.05, 0.1],
    });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.params['catalyst'])).toEqual([0.01, 0.05, 0.1]);
  });

  it('generates cartesian product of two params', () => {
    const result = generateParameterGrid({
      a: [1, 2],
      b: [10, 20, 30],
    });
    expect(result).toHaveLength(6);
  });

  it('assigns sequential ids starting from 0', () => {
    const result = generateParameterGrid({ x: [1, 2, 3] });
    expect(result.map((r) => r.id)).toEqual([0, 1, 2]);
  });

  it('generates correct combinations for 3-param grid', () => {
    const result = generateParameterGrid({
      temperature: { min: 20, max: 40, steps: 5 },
      concentration: { min: 0.1, max: 1.0, steps: 10 },
      catalyst: [0.01, 0.05, 0.1],
    });
    expect(result).toHaveLength(5 * 10 * 3);
  });

  it('handles two-step range correctly', () => {
    const result = generateParameterGrid({
      x: { min: 0, max: 10, steps: 2 },
    });
    expect(result).toHaveLength(2);
    expect(result[0].params['x']).toBeCloseTo(0);
    expect(result[1].params['x']).toBeCloseTo(10);
  });
});

// ============================================
// findOptimalByMetric
// ============================================

describe('findOptimalByMetric', () => {
  const results: BatchResult[] = [
    { input_id: 0, output: { accuracy: 0.7 }, hash: 'a' },
    { input_id: 1, output: { accuracy: 0.9 }, hash: 'b' },
    { input_id: 2, output: { accuracy: 0.8 }, hash: 'c' },
  ];

  it('returns null for empty array', () => {
    expect(findOptimalByMetric([], 'accuracy', 'max')).toBeNull();
  });

  it('finds maximum value', () => {
    const best = findOptimalByMetric(results, 'accuracy', 'max');
    expect(best?.input_id).toBe(1);
  });

  it('finds minimum value', () => {
    const best = findOptimalByMetric(results, 'accuracy', 'min');
    expect(best?.input_id).toBe(0);
  });

  it('returns first element when metric is missing', () => {
    const r: BatchResult[] = [
      { input_id: 0, output: { loss: 'not-a-number' }, hash: 'a' },
      { input_id: 1, output: { loss: 'also-not' }, hash: 'b' },
    ];
    const best = findOptimalByMetric(r, 'loss', 'max');
    expect(best?.input_id).toBe(0);
  });

  it('skips non-numeric values', () => {
    const mixed: BatchResult[] = [
      { input_id: 0, output: { score: 'bad' }, hash: 'a' },
      { input_id: 1, output: { score: 5 }, hash: 'b' },
    ];
    const best = findOptimalByMetric(mixed, 'score', 'max');
    expect(best?.input_id).toBe(0); // reduce starts with first, skips non-numeric
  });
});

// ============================================
// filterByThreshold
// ============================================

describe('filterByThreshold', () => {
  const results: BatchResult[] = [
    { input_id: 0, output: { score: 1 }, hash: 'a' },
    { input_id: 1, output: { score: 5 }, hash: 'b' },
    { input_id: 2, output: { score: 10 }, hash: 'c' },
    { input_id: 3, output: { score: 5 }, hash: 'd' },
  ];

  it('filters with gt', () => {
    const r = filterByThreshold(results, 'score', 5, 'gt');
    expect(r.map((x) => x.input_id)).toEqual([2]);
  });

  it('filters with gte', () => {
    const r = filterByThreshold(results, 'score', 5, 'gte');
    expect(r.map((x) => x.input_id)).toEqual([1, 2, 3]);
  });

  it('filters with lt', () => {
    const r = filterByThreshold(results, 'score', 5, 'lt');
    expect(r.map((x) => x.input_id)).toEqual([0]);
  });

  it('filters with lte', () => {
    const r = filterByThreshold(results, 'score', 5, 'lte');
    expect(r.map((x) => x.input_id)).toEqual([0, 1, 3]);
  });

  it('filters with eq', () => {
    const r = filterByThreshold(results, 'score', 5, 'eq');
    expect(r.map((x) => x.input_id)).toEqual([1, 3]);
  });

  it('excludes non-numeric values', () => {
    const mixed: BatchResult[] = [
      { input_id: 0, output: { score: 'oops' }, hash: 'a' },
      { input_id: 1, output: { score: 7 }, hash: 'b' },
    ];
    const r = filterByThreshold(mixed, 'score', 5, 'gt');
    expect(r).toHaveLength(1);
    expect(r[0].input_id).toBe(1);
  });

  it('returns empty when no results match', () => {
    const r = filterByThreshold(results, 'score', 100, 'gt');
    expect(r).toHaveLength(0);
  });
});

// ============================================
// getTopN
// ============================================

describe('getTopN', () => {
  const results: BatchResult[] = [
    { input_id: 0, output: { score: 3 }, hash: 'a' },
    { input_id: 1, output: { score: 1 }, hash: 'b' },
    { input_id: 2, output: { score: 5 }, hash: 'c' },
    { input_id: 3, output: { score: 2 }, hash: 'd' },
    { input_id: 4, output: { score: 4 }, hash: 'e' },
  ];

  it('returns top 3 in descending order by default', () => {
    const top = getTopN(results, 'score', 3);
    expect(top.map((r) => r.output['score'])).toEqual([5, 4, 3]);
  });

  it('returns top 2 in ascending order', () => {
    const top = getTopN(results, 'score', 2, 'asc');
    expect(top.map((r) => r.output['score'])).toEqual([1, 2]);
  });

  it('returns all if n exceeds length', () => {
    const top = getTopN(results, 'score', 100);
    expect(top).toHaveLength(5);
  });

  it('returns empty for empty input', () => {
    expect(getTopN([], 'score', 3)).toHaveLength(0);
  });

  it('excludes non-numeric metric values', () => {
    const mixed: BatchResult[] = [
      { input_id: 0, output: { score: 'bad' }, hash: 'a' },
      { input_id: 1, output: { score: 9 }, hash: 'b' },
    ];
    const top = getTopN(mixed, 'score', 5);
    expect(top).toHaveLength(1);
    expect(top[0].input_id).toBe(1);
  });
});

// ============================================
// calculateMetricStats
// ============================================

describe('calculateMetricStats', () => {
  it('returns null for empty results', () => {
    expect(calculateMetricStats([], 'score')).toBeNull();
  });

  it('returns null when no numeric values for key', () => {
    const r: BatchResult[] = [{ input_id: 0, output: { score: 'bad' }, hash: 'a' }];
    expect(calculateMetricStats(r, 'score')).toBeNull();
  });

  it('computes correct stats for odd-length array', () => {
    const results: BatchResult[] = [
      { input_id: 0, output: { v: 1 }, hash: 'a' },
      { input_id: 1, output: { v: 3 }, hash: 'b' },
      { input_id: 2, output: { v: 5 }, hash: 'c' },
    ];
    const stats = calculateMetricStats(results, 'v');
    expect(stats).not.toBeNull();
    expect(stats!.min).toBe(1);
    expect(stats!.max).toBe(5);
    expect(stats!.mean).toBeCloseTo(3);
    expect(stats!.median).toBe(3);
  });

  it('computes median correctly for even-length array', () => {
    const results: BatchResult[] = [
      { input_id: 0, output: { v: 1 }, hash: 'a' },
      { input_id: 1, output: { v: 2 }, hash: 'b' },
      { input_id: 2, output: { v: 3 }, hash: 'c' },
      { input_id: 3, output: { v: 4 }, hash: 'd' },
    ];
    const stats = calculateMetricStats(results, 'v');
    expect(stats!.median).toBeCloseTo(2.5);
  });

  it('computes stdDev correctly', () => {
    const results: BatchResult[] = [
      { input_id: 0, output: { v: 2 }, hash: 'a' },
      { input_id: 1, output: { v: 4 }, hash: 'b' },
      { input_id: 2, output: { v: 4 }, hash: 'c' },
      { input_id: 3, output: { v: 4 }, hash: 'd' },
      { input_id: 4, output: { v: 5 }, hash: 'e' },
      { input_id: 5, output: { v: 5 }, hash: 'f' },
      { input_id: 6, output: { v: 7 }, hash: 'g' },
      { input_id: 7, output: { v: 9 }, hash: 'h' },
    ];
    const stats = calculateMetricStats(results, 'v');
    // population stdDev for [2,4,4,4,5,5,7,9] = 2
    expect(stats!.stdDev).toBeCloseTo(2);
  });

  it('returns stdDev of 0 for single value', () => {
    const results: BatchResult[] = [{ input_id: 0, output: { v: 42 }, hash: 'a' }];
    const stats = calculateMetricStats(results, 'v');
    expect(stats!.stdDev).toBe(0);
    expect(stats!.min).toBe(42);
    expect(stats!.max).toBe(42);
    expect(stats!.mean).toBe(42);
    expect(stats!.median).toBe(42);
  });
});

// ============================================
// createBatchInputManifest + validateBatchInputManifest
// ============================================

describe('createBatchInputManifest', () => {
  it('creates a valid manifest with correct structure', () => {
    const inputs = [
      { id: 0, params: { x: 1 } },
      { id: 1, params: { x: 2 } },
    ];
    const manifest = createBatchInputManifest('QmModelCid', inputs);

    expect(manifest.version).toBe('1.0');
    expect(manifest.type).toBe('batch_input_manifest');
    expect(manifest.model_cid).toBe('QmModelCid');
    expect(manifest.inputs).toHaveLength(2);
    expect(manifest.total_count).toBe(2);
    expect(typeof manifest.checksum).toBe('string');
    expect(manifest.checksum.startsWith('0x')).toBe(true);
  });

  it('includes optional schema when provided', () => {
    const schema = {
      type: 'object' as const,
      properties: { x: { type: 'number' as const } },
    };
    const manifest = createBatchInputManifest('QmCid', [], schema);
    expect(manifest.parameter_schema).toEqual(schema);
  });

  it('produces deterministic checksum', () => {
    const inputs = [{ id: 0, params: { a: 1 } }];
    const m1 = createBatchInputManifest('QmX', inputs);
    const m2 = createBatchInputManifest('QmX', inputs);
    expect(m1.checksum).toBe(m2.checksum);
  });
});

describe('validateBatchInputManifest', () => {
  it('validates a correct manifest', () => {
    const manifest = createBatchInputManifest('QmCid', [{ id: 0, params: {} }]);
    expect(validateBatchInputManifest(manifest)).toBe(true);
  });

  it('rejects null', () => {
    expect(validateBatchInputManifest(null)).toBe(false);
  });

  it('rejects wrong version', () => {
    const manifest = { ...createBatchInputManifest('QmCid', []), version: '2.0' };
    expect(validateBatchInputManifest(manifest)).toBe(false);
  });

  it('rejects wrong type field', () => {
    const manifest = { ...createBatchInputManifest('QmCid', []), type: 'something_else' };
    expect(validateBatchInputManifest(manifest)).toBe(false);
  });

  it('rejects when inputs.length !== total_count', () => {
    const manifest = { ...createBatchInputManifest('QmCid', [{ id: 0, params: {} }]), total_count: 99 };
    expect(validateBatchInputManifest(manifest)).toBe(false);
  });
});

// ============================================
// validateBatchResultManifest
// ============================================

describe('validateBatchResultManifest', () => {
  const valid: BatchResultManifest = {
    version: '1.0',
    type: 'batch_result_manifest',
    task_id: 1,
    input_manifest_cid: 'QmInputCid',
    node_address: '0xABC',
    results: [],
    aggregated_hash: '0xhash',
    execution_metadata: {
      total_time_ms: 1000,
      parallel_workers: 4,
      framework: 'onnx',
    },
  };

  it('validates a correct result manifest', () => {
    expect(validateBatchResultManifest(valid)).toBe(true);
  });

  it('rejects null', () => {
    expect(validateBatchResultManifest(null)).toBe(false);
  });

  it('rejects wrong version', () => {
    expect(validateBatchResultManifest({ ...valid, version: '2.0' })).toBe(false);
  });

  it('rejects wrong type', () => {
    expect(validateBatchResultManifest({ ...valid, type: 'batch_input_manifest' })).toBe(false);
  });

  it('rejects non-number task_id', () => {
    expect(validateBatchResultManifest({ ...valid, task_id: 'one' })).toBe(false);
  });

  it('rejects missing results array', () => {
    const { results: _r, ...noResults } = valid;
    expect(validateBatchResultManifest(noResults)).toBe(false);
  });
});

// ============================================
// computeAggregatedHash
// ============================================

describe('computeAggregatedHash', () => {
  it('returns a 0x-prefixed hex string', () => {
    const hash = computeAggregatedHash([]);
    expect(hash.startsWith('0x')).toBe(true);
    expect(hash).toHaveLength(66); // 0x + 64 hex chars
  });

  it('is deterministic regardless of input order', () => {
    const results: BatchResult[] = [
      { input_id: 0, output: {}, hash: '0xaaa' },
      { input_id: 1, output: {}, hash: '0xbbb' },
    ];
    const reversed = [...results].reverse();

    const h1 = computeAggregatedHash(results);
    const h2 = computeAggregatedHash(reversed);
    expect(h1).toBe(h2);
  });

  it('produces different hashes for different inputs', () => {
    const r1: BatchResult[] = [{ input_id: 0, output: {}, hash: '0xaaa' }];
    const r2: BatchResult[] = [{ input_id: 0, output: {}, hash: '0xbbb' }];
    expect(computeAggregatedHash(r1)).not.toBe(computeAggregatedHash(r2));
  });
});

// ============================================
// computeInputsChecksum
// ============================================

describe('computeInputsChecksum', () => {
  it('returns a 0x-prefixed hex string', () => {
    const checksum = computeInputsChecksum([]);
    expect(checksum.startsWith('0x')).toBe(true);
    expect(checksum).toHaveLength(66);
  });

  it('is deterministic regardless of input order', () => {
    const inputs = [
      { id: 0, params: { x: 1 } },
      { id: 1, params: { x: 2 } },
    ];
    const reversed = [...inputs].reverse();

    const c1 = computeInputsChecksum(inputs);
    const c2 = computeInputsChecksum(reversed);
    expect(c1).toBe(c2);
  });

  it('produces different checksums for different inputs', () => {
    const a = [{ id: 0, params: { x: 1 } }];
    const b = [{ id: 0, params: { x: 2 } }];
    expect(computeInputsChecksum(a)).not.toBe(computeInputsChecksum(b));
  });
});

/**
 * OARN SDK Batch Task Types and Utilities
 * Enables submitting tasks with multiple input parameters for parallel execution
 */

import { keccak256, toUtf8Bytes } from 'ethers';

// ============================================
// Batch Input Types
// ============================================

/**
 * Single input parameter set for batch processing
 */
export interface BatchInput {
  id: number;
  params: Record<string, unknown>;
}

/**
 * Manifest containing all inputs for a batch task
 * Uploaded to IPFS, hash stored on-chain as inputHash
 */
export interface BatchInputManifest {
  version: string;
  type: 'batch_input_manifest';
  model_cid: string;
  parameter_schema?: ParameterSchema;
  inputs: BatchInput[];
  total_count: number;
  checksum: string;
}

/**
 * Schema describing the parameter structure (optional)
 */
export interface ParameterSchema {
  type: 'object';
  properties: Record<string, ParameterProperty>;
}

export interface ParameterProperty {
  type: 'number' | 'string' | 'boolean' | 'array';
  description?: string;
  min?: number;
  max?: number;
}

// ============================================
// Batch Result Types
// ============================================

/**
 * Single result from batch execution
 */
export interface BatchResult {
  input_id: number;
  output: Record<string, unknown>;
  hash: string;
}

/**
 * Manifest containing all results from batch execution
 * Created by nodes, uploaded to IPFS
 */
export interface BatchResultManifest {
  version: string;
  type: 'batch_result_manifest';
  task_id: number;
  input_manifest_cid: string;
  node_address: string;
  results: BatchResult[];
  aggregated_hash: string;
  execution_metadata: ExecutionMetadata;
}

/**
 * Metadata about batch execution
 */
export interface ExecutionMetadata {
  total_time_ms: number;
  parallel_workers: number;
  framework: string;
  node_version?: string;
}

// ============================================
// Aggregated Results Types
// ============================================

/**
 * Aggregated results from multiple nodes after consensus
 */
export interface AggregatedBatchResults {
  taskId: number;
  consensusReached: boolean;
  totalInputs: number;
  nodesAgreed: number;
  nodesTotal: number;

  /** Results from the consensus (matching nodes) */
  results: BatchResult[];

  /** Metadata from agreeing nodes */
  executionMetadata: ExecutionMetadata[];
}

// ============================================
// Parameter Grid Generation
// ============================================

/**
 * Configuration for generating a parameter grid
 */
export interface ParameterGridConfig {
  [paramName: string]: {
    min: number;
    max: number;
    steps: number;
  } | number[];
}

/**
 * Generate a grid of parameter combinations
 *
 * @example
 * ```typescript
 * const params = generateParameterGrid({
 *   temperature: { min: 20, max: 40, steps: 5 },
 *   concentration: { min: 0.1, max: 1.0, steps: 10 },
 *   catalyst: [0.01, 0.05, 0.1]  // Explicit values
 * });
 * // Returns 5 * 10 * 3 = 150 combinations
 * ```
 */
export function generateParameterGrid(config: ParameterGridConfig): BatchInput[] {
  const paramNames = Object.keys(config);
  const paramValues: Record<string, number[]> = {};

  // Generate values for each parameter
  for (const [name, spec] of Object.entries(config)) {
    if (Array.isArray(spec)) {
      paramValues[name] = spec;
    } else {
      const { min, max, steps } = spec;
      const stepSize = (max - min) / (steps - 1);
      paramValues[name] = Array.from({ length: steps }, (_, i) => min + i * stepSize);
    }
  }

  // Generate all combinations
  const combinations: BatchInput[] = [];
  const indices = paramNames.map(() => 0);
  let id = 0;

  while (true) {
    // Create current combination
    const params: Record<string, number> = {};
    for (let i = 0; i < paramNames.length; i++) {
      params[paramNames[i]] = paramValues[paramNames[i]][indices[i]];
    }
    combinations.push({ id: id++, params });

    // Increment indices (like counting in mixed radix)
    let pos = paramNames.length - 1;
    while (pos >= 0) {
      indices[pos]++;
      if (indices[pos] < paramValues[paramNames[pos]].length) {
        break;
      }
      indices[pos] = 0;
      pos--;
    }

    if (pos < 0) break; // All combinations generated
  }

  return combinations;
}

// ============================================
// Manifest Utilities
// ============================================

/**
 * Create a batch input manifest
 */
export function createBatchInputManifest(
  modelCid: string,
  inputs: BatchInput[],
  schema?: ParameterSchema
): BatchInputManifest {
  const checksum = computeInputsChecksum(inputs);

  return {
    version: '1.0',
    type: 'batch_input_manifest',
    model_cid: modelCid,
    parameter_schema: schema,
    inputs,
    total_count: inputs.length,
    checksum,
  };
}

/**
 * Compute deterministic checksum for inputs
 */
export function computeInputsChecksum(inputs: BatchInput[]): string {
  // Sort by id and serialize deterministically
  const sorted = [...inputs].sort((a, b) => a.id - b.id);
  const serialized = JSON.stringify(sorted);
  return keccak256(toUtf8Bytes(serialized));
}

/**
 * Validate a batch input manifest
 */
export function validateBatchInputManifest(manifest: unknown): manifest is BatchInputManifest {
  if (typeof manifest !== 'object' || manifest === null) return false;

  const m = manifest as BatchInputManifest;

  return (
    m.version === '1.0' &&
    m.type === 'batch_input_manifest' &&
    typeof m.model_cid === 'string' &&
    Array.isArray(m.inputs) &&
    typeof m.total_count === 'number' &&
    typeof m.checksum === 'string' &&
    m.inputs.length === m.total_count &&
    m.inputs.every(
      (input) =>
        typeof input.id === 'number' &&
        typeof input.params === 'object'
    )
  );
}

/**
 * Validate a batch result manifest
 */
export function validateBatchResultManifest(manifest: unknown): manifest is BatchResultManifest {
  if (typeof manifest !== 'object' || manifest === null) return false;

  const m = manifest as BatchResultManifest;

  return (
    m.version === '1.0' &&
    m.type === 'batch_result_manifest' &&
    typeof m.task_id === 'number' &&
    typeof m.input_manifest_cid === 'string' &&
    typeof m.node_address === 'string' &&
    Array.isArray(m.results) &&
    typeof m.aggregated_hash === 'string' &&
    typeof m.execution_metadata === 'object'
  );
}

/**
 * Compute aggregated hash from results (must be deterministic)
 */
export function computeAggregatedHash(results: BatchResult[]): string {
  // Sort by input_id for determinism
  const sorted = [...results].sort((a, b) => a.input_id - b.input_id);

  // Concatenate all result hashes in order
  const concatenated = sorted.map((r) => r.hash).join('');

  return keccak256(toUtf8Bytes(concatenated));
}

// ============================================
// Result Analysis Utilities
// ============================================

/**
 * Find the result with optimal value for a given metric
 */
export function findOptimalByMetric(
  results: BatchResult[],
  metricKey: string,
  optimize: 'max' | 'min'
): BatchResult | null {
  if (results.length === 0) return null;

  return results.reduce((best, current) => {
    const currentValue = current.output[metricKey] as number;
    const bestValue = best.output[metricKey] as number;

    if (typeof currentValue !== 'number' || typeof bestValue !== 'number') {
      return best;
    }

    if (optimize === 'max') {
      return currentValue > bestValue ? current : best;
    } else {
      return currentValue < bestValue ? current : best;
    }
  });
}

/**
 * Filter results by threshold
 */
export function filterByThreshold(
  results: BatchResult[],
  metricKey: string,
  threshold: number,
  comparison: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
): BatchResult[] {
  return results.filter((result) => {
    const value = result.output[metricKey] as number;
    if (typeof value !== 'number') return false;

    switch (comparison) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
    }
  });
}

/**
 * Get top N results by metric
 */
export function getTopN(
  results: BatchResult[],
  metricKey: string,
  n: number,
  order: 'asc' | 'desc' = 'desc'
): BatchResult[] {
  return [...results]
    .filter((r) => typeof r.output[metricKey] === 'number')
    .sort((a, b) => {
      const aVal = a.output[metricKey] as number;
      const bVal = b.output[metricKey] as number;
      return order === 'desc' ? bVal - aVal : aVal - bVal;
    })
    .slice(0, n);
}

/**
 * Calculate statistics for a metric across all results
 */
export function calculateMetricStats(
  results: BatchResult[],
  metricKey: string
): { min: number; max: number; mean: number; median: number; stdDev: number } | null {
  const values = results
    .map((r) => r.output[metricKey])
    .filter((v): v is number => typeof v === 'number');

  if (values.length === 0) return null;

  values.sort((a, b) => a - b);

  const min = values[0];
  const max = values[values.length - 1];
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;

  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 === 0
    ? (values[mid - 1] + values[mid]) / 2
    : values[mid];

  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { min, max, mean, median, stdDev };
}

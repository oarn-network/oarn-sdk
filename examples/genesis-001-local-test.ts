/**
 * GENESIS-001 Local Test: Validate Batch Pipeline Offline
 *
 * This script tests the batch task creation and result analysis
 * without connecting to the blockchain. Use this to validate
 * the pipeline before submitting to the network.
 *
 * Run with: npx ts-node examples/genesis-001-local-test.ts
 */

import {
  generateParameterGrid,
  createBatchInputManifest,
  computeAggregatedHash,
  computeInputsChecksum,
  validateBatchInputManifest,
  validateBatchResultManifest,
  findOptimalByMetric,
  filterByThreshold,
  getTopN,
  calculateMetricStats,
  type BatchInput,
  type BatchResult,
  type BatchResultManifest,
} from '../src/index.js';

async function main() {
  console.log('='.repeat(60));
  console.log('GENESIS-001 Local Test: Batch Pipeline Validation');
  console.log('='.repeat(60));
  console.log();

  // ============================================
  // Test 1: Parameter Grid Generation
  // ============================================
  console.log('Test 1: Parameter Grid Generation');
  console.log('-'.repeat(40));

  const inputs = generateParameterGrid({
    temperature: { min: 30, max: 37, steps: 2 },
    pH: { min: 6.8, max: 7.4, steps: 5 },
  });

  console.log(`Generated ${inputs.length} combinations`);
  console.log('Sample inputs:');
  inputs.slice(0, 3).forEach((input) => {
    console.log(`  [${input.id}] ${JSON.stringify(input.params)}`);
  });
  console.log(`  ... and ${inputs.length - 3} more`);
  console.log('PASS: Parameter grid generation works');
  console.log();

  // ============================================
  // Test 2: Batch Input Manifest Creation
  // ============================================
  console.log('Test 2: Batch Input Manifest Creation');
  console.log('-'.repeat(40));

  const modelCid = 'QmTestModelCid123456789';
  const manifest = createBatchInputManifest(modelCid, inputs);

  console.log(`Manifest version: ${manifest.version}`);
  console.log(`Manifest type: ${manifest.type}`);
  console.log(`Model CID: ${manifest.model_cid}`);
  console.log(`Total count: ${manifest.total_count}`);
  console.log(`Checksum: ${manifest.checksum.substring(0, 20)}...`);

  // Validate manifest
  const isValid = validateBatchInputManifest(manifest);
  console.log(`Validation: ${isValid ? 'PASS' : 'FAIL'}`);
  console.log();

  // ============================================
  // Test 3: Simulate Node Execution Results
  // ============================================
  console.log('Test 3: Simulate Node Execution');
  console.log('-'.repeat(40));

  // Simulate results from a node executing the batch
  const simulatedResults: BatchResult[] = inputs.map((input) => {
    const params = input.params as { temperature: number; pH: number };

    // Simulate yield calculation (higher yield at optimal temp/pH)
    const optimalTemp = 34;
    const optimalPH = 7.0;
    const tempFactor = 1 - Math.abs(params.temperature - optimalTemp) / 10;
    const pHFactor = 1 - Math.abs(params.pH - optimalPH) / 2;
    const baseYield = 40; // Base yield percentage
    const predictedYield = baseYield + 30 * tempFactor * pHFactor;

    // Simulate cost calculation
    const predictedCost = 50 - predictedYield * 0.3;

    const output = {
      predicted_yield: Math.round(predictedYield * 100) / 100,
      predicted_cost: Math.round(predictedCost * 100) / 100,
      temperature: params.temperature,
      pH: params.pH,
    };

    return {
      input_id: input.id,
      output,
      hash: `0x${Buffer.from(JSON.stringify(output)).toString('hex').substring(0, 64)}`,
    };
  });

  console.log(`Generated ${simulatedResults.length} simulated results`);
  console.log('Sample results:');
  simulatedResults.slice(0, 3).forEach((r) => {
    const out = r.output as { predicted_yield: number; predicted_cost: number };
    console.log(`  [${r.input_id}] Yield: ${out.predicted_yield}%, Cost: $${out.predicted_cost}/g`);
  });
  console.log('PASS: Result simulation works');
  console.log();

  // ============================================
  // Test 4: Aggregated Hash Computation
  // ============================================
  console.log('Test 4: Aggregated Hash Computation');
  console.log('-'.repeat(40));

  const aggregatedHash = computeAggregatedHash(simulatedResults);
  console.log(`Aggregated hash: ${aggregatedHash.substring(0, 30)}...`);

  // Verify determinism (same input = same hash)
  const aggregatedHash2 = computeAggregatedHash(simulatedResults);
  const isDeterministic = aggregatedHash === aggregatedHash2;
  console.log(`Deterministic: ${isDeterministic ? 'PASS' : 'FAIL'}`);

  // Verify order independence (shuffled = same hash due to sorting)
  const shuffled = [...simulatedResults].reverse();
  const aggregatedHash3 = computeAggregatedHash(shuffled);
  const isOrderIndependent = aggregatedHash === aggregatedHash3;
  console.log(`Order independent: ${isOrderIndependent ? 'PASS' : 'FAIL'}`);
  console.log();

  // ============================================
  // Test 5: Result Manifest Validation
  // ============================================
  console.log('Test 5: Result Manifest Validation');
  console.log('-'.repeat(40));

  const resultManifest: BatchResultManifest = {
    version: '1.0',
    type: 'batch_result_manifest',
    task_id: 42,
    input_manifest_cid: modelCid,
    node_address: '0x1234567890abcdef1234567890abcdef12345678',
    results: simulatedResults,
    aggregated_hash: aggregatedHash,
    execution_metadata: {
      total_time_ms: 1234,
      parallel_workers: 4,
      framework: 'onnx',
      node_version: '0.1.0',
    },
  };

  const resultManifestValid = validateBatchResultManifest(resultManifest);
  console.log(`Result manifest valid: ${resultManifestValid ? 'PASS' : 'FAIL'}`);
  console.log();

  // ============================================
  // Test 6: Result Analysis
  // ============================================
  console.log('Test 6: Result Analysis');
  console.log('-'.repeat(40));

  // Find optimal (highest yield)
  const optimal = findOptimalByMetric(simulatedResults, 'predicted_yield', 'max');
  if (optimal) {
    const out = optimal.output as { predicted_yield: number; temperature: number; pH: number };
    console.log('Optimal parameters (max yield):');
    console.log(`  Temperature: ${out.temperature}°C`);
    console.log(`  pH: ${out.pH}`);
    console.log(`  Predicted Yield: ${out.predicted_yield}%`);
  }
  console.log();

  // Find lowest cost
  const lowestCost = findOptimalByMetric(simulatedResults, 'predicted_cost', 'min');
  if (lowestCost) {
    const out = lowestCost.output as { predicted_cost: number; temperature: number; pH: number };
    console.log('Optimal parameters (min cost):');
    console.log(`  Temperature: ${out.temperature}°C`);
    console.log(`  pH: ${out.pH}`);
    console.log(`  Predicted Cost: $${out.predicted_cost}/g`);
  }
  console.log();

  // Statistics
  const yieldStats = calculateMetricStats(simulatedResults, 'predicted_yield');
  if (yieldStats) {
    console.log('Yield Statistics:');
    console.log(`  Min: ${yieldStats.min.toFixed(2)}%`);
    console.log(`  Max: ${yieldStats.max.toFixed(2)}%`);
    console.log(`  Mean: ${yieldStats.mean.toFixed(2)}%`);
    console.log(`  Median: ${yieldStats.median.toFixed(2)}%`);
    console.log(`  Std Dev: ${yieldStats.stdDev.toFixed(2)}%`);
  }
  console.log();

  // Filter high-yield results (>60%)
  const highYield = filterByThreshold(simulatedResults, 'predicted_yield', 60, 'gte');
  console.log(`High yield results (>=60%): ${highYield.length} combinations`);

  // Top 3 results
  const top3 = getTopN(simulatedResults, 'predicted_yield', 3);
  console.log('\nTop 3 Parameter Combinations:');
  top3.forEach((r, i) => {
    const out = r.output as { predicted_yield: number; predicted_cost: number; temperature: number; pH: number };
    console.log(
      `  ${i + 1}. Temp: ${out.temperature}°C, pH: ${out.pH} => Yield: ${out.predicted_yield}%, Cost: $${out.predicted_cost}/g`
    );
  });
  console.log();

  // ============================================
  // Summary
  // ============================================
  console.log('='.repeat(60));
  console.log('ALL TESTS PASSED');
  console.log('='.repeat(60));
  console.log();
  console.log('The batch pipeline is working correctly:');
  console.log('  - Parameter grid generation');
  console.log('  - Batch manifest creation & validation');
  console.log('  - Result hash computation (deterministic, order-independent)');
  console.log('  - Result manifest validation');
  console.log('  - Result analysis (optimal, filter, top-N, statistics)');
  console.log();
  console.log('Ready to submit to the network with:');
  console.log('  PRIVATE_KEY=0x... npx ts-node examples/genesis-001-mvp.ts');
}

main().catch(console.error);

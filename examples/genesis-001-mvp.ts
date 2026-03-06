/**
 * GENESIS-001 MVP: Insulin Synthesis Parameter Optimization
 *
 * This MVP demonstrates the batch task pipeline with 10 parameter combinations.
 * It validates:
 * - Parameter grid generation
 * - Batch task submission
 * - Result aggregation
 * - Optimal parameter identification
 *
 * Run with: npx ts-node examples/genesis-001-mvp.ts
 */

import {
  OARNClient,
  ConsensusType,
  generateParameterGrid,
  parseTokenAmount,
} from '../dist/esm/index.js';

// Simulated insulin synthesis model (placeholder for real ONNX model)
// In production, this would be an actual ML model trained on synthesis data
const INSULIN_SYNTHESIS_MODEL = JSON.stringify({
  name: 'insulin-synthesis-yield-predictor',
  version: '0.1.0-mvp',
  type: 'regression',
  framework: 'onnx',
  description: 'Predicts insulin synthesis yield based on fermentation parameters',
  inputs: ['temperature', 'pH', 'glucose_concentration'],
  outputs: ['predicted_yield', 'predicted_cost'],
  // This is a placeholder - real model would be binary ONNX data
});

async function main() {
  console.log('='.repeat(60));
  console.log('GENESIS-001 MVP: Insulin Synthesis Optimization');
  console.log('='.repeat(60));
  console.log();

  // Check for required environment variables
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('Error: PRIVATE_KEY environment variable is required');
    console.error('Usage: PRIVATE_KEY=0x... npx ts-node examples/genesis-001-mvp.ts');
    process.exit(1);
  }

  // Initialize client
  const client = new OARNClient({
    privateKey,
    // Uses Arbitrum Sepolia testnet by default
  });

  const address = client.getAddress();
  console.log(`Wallet: ${address}`);

  // Check balances
  const balance = await client.getBalance(address!);
  console.log(`ETH Balance: ${formatEther(balance.eth)} ETH`);
  console.log();

  // ============================================
  // Step 1: Generate Parameter Grid (10 combinations)
  // ============================================
  console.log('-'.repeat(60));
  console.log('Step 1: Generating Parameter Grid');
  console.log('-'.repeat(60));

  // MVP: Small grid with 10 combinations (2 x 5 = 10)
  // Full GENESIS-001 will use 10,000+ combinations
  const inputs = generateParameterGrid({
    // Temperature in Celsius (fermentation temperature)
    temperature: { min: 30, max: 37, steps: 2 },
    // pH level (optimal range for E. coli expression)
    pH: { min: 6.8, max: 7.4, steps: 5 },
  });

  console.log(`Generated ${inputs.length} parameter combinations:`);
  console.log();
  inputs.forEach((input, i) => {
    const params = input.params as { temperature: number; pH: number };
    console.log(
      `  [${i}] Temperature: ${params.temperature.toFixed(1)}°C, pH: ${params.pH.toFixed(2)}`
    );
  });
  console.log();

  // ============================================
  // Step 2: Submit Batch Task
  // ============================================
  console.log('-'.repeat(60));
  console.log('Step 2: Submitting Batch Task');
  console.log('-'.repeat(60));

  // Calculate deadline (2 hours from now)
  const deadline = Math.floor(Date.now() / 1000) + 7200;

  console.log(`Model: insulin-synthesis-yield-predictor v0.1.0-mvp`);
  console.log(`Inputs: ${inputs.length} parameter combinations`);
  console.log(`Required Nodes: 3 (for consensus)`);
  console.log(`Reward per Node: 0.001 ETH`);
  console.log(`Deadline: ${new Date(deadline * 1000).toISOString()}`);
  console.log(`Consensus: SuperMajority (>66%)`);
  console.log();

  try {
    console.log('Uploading model and manifest to IPFS...');

    const result = await client.submitBatchTask(
      INSULIN_SYNTHESIS_MODEL,
      inputs,
      parseTokenAmount('0.001'), // 0.001 ETH per node
      3, // 3 nodes required for consensus
      deadline,
      ConsensusType.SuperMajority
    );

    console.log();
    console.log('Batch task submitted successfully!');
    console.log(`  Task ID: ${result.taskId}`);
    console.log(`  Transaction: ${result.tx.hash}`);
    console.log(`  Model CID: ${result.modelCid}`);
    console.log(`  Manifest CID: ${result.manifestCid}`);
    console.log(`  Total Inputs: ${result.totalInputs}`);
    console.log();

    // ============================================
    // Step 3: Monitor Task Progress
    // ============================================
    console.log('-'.repeat(60));
    console.log('Step 3: Monitoring Task Progress');
    console.log('-'.repeat(60));

    // Set up event listeners
    client.onTaskClaimed((taskId, node) => {
      if (taskId === result.taskId) {
        console.log(`  Node claimed task: ${node.substring(0, 10)}...`);
      }
    });

    client.onResultSubmitted((taskId, node, resultHash) => {
      if (taskId === result.taskId) {
        console.log(`  Result submitted by: ${node.substring(0, 10)}...`);
        console.log(`    Hash: ${resultHash.substring(0, 18)}...`);
      }
    });

    client.onConsensusReached(async (taskId, resultHash) => {
      if (taskId === result.taskId) {
        console.log();
        console.log('CONSENSUS REACHED!');
        console.log(`  Winning Hash: ${resultHash}`);
        console.log();

        // ============================================
        // Step 4: Analyze Results
        // ============================================
        await analyzeResults(client, result.taskId);

        client.removeAllListeners();
        process.exit(0);
      }
    });

    console.log('Waiting for nodes to process batch task...');
    console.log('(Nodes will execute all 10 parameter combinations in parallel)');
    console.log();
    console.log('Press Ctrl+C to exit');

    // Keep script running
    await new Promise(() => {});
  } catch (error) {
    console.error('\nError:', error);
    process.exit(1);
  }
}

async function analyzeResults(client: OARNClient, taskId: number) {
  console.log('-'.repeat(60));
  console.log('Step 4: Analyzing Results');
  console.log('-'.repeat(60));

  try {
    const results = await client.getBatchResults(taskId);

    console.log(`Consensus Reached: ${results.consensusReached}`);
    console.log(`Nodes Agreed: ${results.nodesAgreed}/${results.nodesTotal}`);
    console.log(`Total Inputs Processed: ${results.totalInputs}`);
    console.log();

    if (results.results.length > 0) {
      // Find optimal parameters (highest yield)
      const optimal = client.findOptimalResult(results.results, 'predicted_yield', 'max');

      if (optimal) {
        console.log('OPTIMAL PARAMETERS FOUND:');
        console.log(`  Input ID: ${optimal.input_id}`);
        console.log(`  Parameters: ${JSON.stringify(optimal.output)}`);
        console.log();
      }

      // Get statistics
      const stats = client.getMetricStats(results.results, 'predicted_yield');
      if (stats) {
        console.log('YIELD STATISTICS:');
        console.log(`  Min: ${stats.min.toFixed(2)}%`);
        console.log(`  Max: ${stats.max.toFixed(2)}%`);
        console.log(`  Mean: ${stats.mean.toFixed(2)}%`);
        console.log(`  Std Dev: ${stats.stdDev.toFixed(2)}%`);
        console.log();
      }

      // Show top 3 results
      const top3 = client.getTopResults(results.results, 'predicted_yield', 3);
      console.log('TOP 3 PARAMETER COMBINATIONS:');
      top3.forEach((r, i) => {
        console.log(`  ${i + 1}. Input ${r.input_id}: ${JSON.stringify(r.output)}`);
      });
    } else {
      console.log('No detailed results available yet.');
      console.log('(Results are stored in IPFS, fetch manifest for full data)');
    }
  } catch (error) {
    console.log('Could not fetch detailed results:', error);
  }

  console.log();
  console.log('='.repeat(60));
  console.log('GENESIS-001 MVP COMPLETE');
  console.log('='.repeat(60));
}

function formatEther(wei: bigint): string {
  const ether = Number(wei) / 1e18;
  return ether.toFixed(6);
}

main().catch(console.error);

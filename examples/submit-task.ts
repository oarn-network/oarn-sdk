/**
 * Example: Submit a task to the OARN Network
 *
 * Run with: npx ts-node examples/submit-task.ts
 */

import { OARNClient, TaskStatus, ConsensusType, parseTokenAmount } from '../src/index.js';

async function main() {
  // Check for required environment variables
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('Error: PRIVATE_KEY environment variable is required');
    console.error('Usage: PRIVATE_KEY=0x... npx ts-node examples/submit-task.ts');
    process.exit(1);
  }

  // Initialize client
  const client = new OARNClient({
    privateKey,
    // Uses Arbitrum Sepolia by default
  });

  const address = client.getAddress();
  console.log(`Connected wallet: ${address}`);

  // Check balances
  const balance = await client.getBalance(address!);
  console.log(`\nBalances:`);
  console.log(`  ETH:  ${formatEther(balance.eth)}`);
  console.log(`  COMP: ${formatEther(balance.comp)}`);
  console.log(`  GOV:  ${formatEther(balance.gov)}`);

  // Prepare task data
  const modelData = JSON.stringify({
    type: 'inference',
    model: 'llama-7b',
    parameters: { temperature: 0.7, max_tokens: 100 },
  });

  const inputData = JSON.stringify({
    prompt: 'What is the capital of France?',
  });

  // Calculate deadline (1 hour from now)
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  console.log(`\nSubmitting task...`);
  console.log(`  Model: ${modelData.substring(0, 50)}...`);
  console.log(`  Input: ${inputData.substring(0, 50)}...`);
  console.log(`  Deadline: ${new Date(deadline * 1000).toISOString()}`);

  try {
    // Submit with automatic IPFS upload
    const result = await client.submitTaskWithData(
      modelData,
      inputData,
      parseTokenAmount('0.001'), // 0.001 COMP per node
      3, // 3 nodes required
      deadline,
      ConsensusType.Majority
    );

    console.log(`\nTask submitted successfully!`);
    console.log(`  Task ID: ${result.taskId}`);
    console.log(`  Transaction: ${result.tx.hash}`);
    console.log(`  Model CID: ${result.modelCid}`);
    console.log(`  Input CID: ${result.inputCid}`);

    // Fetch and display task info
    const task = await client.getTask(result.taskId);
    console.log(`\nTask Info:`);
    console.log(`  Status: ${TaskStatus[task.status]}`);
    console.log(`  Requester: ${task.requester}`);
    console.log(`  Required Nodes: ${task.requiredNodes}`);
    console.log(`  Reward per Node: ${formatEther(task.rewardPerNode)} COMP`);

    // Set up event listener for this task
    console.log(`\nListening for task events...`);

    client.onTaskClaimed((taskId, node) => {
      if (taskId === result.taskId) {
        console.log(`  Task claimed by: ${node}`);
      }
    });

    client.onResultSubmitted((taskId, node, resultHash) => {
      if (taskId === result.taskId) {
        console.log(`  Result submitted by: ${node}`);
        console.log(`    Hash: ${resultHash}`);
      }
    });

    client.onConsensusReached((taskId, resultHash) => {
      if (taskId === result.taskId) {
        console.log(`  Consensus reached!`);
        console.log(`    Winning hash: ${resultHash}`);
        client.removeAllListeners();
        process.exit(0);
      }
    });

    // Keep script running for events
    console.log(`\nPress Ctrl+C to exit`);
  } catch (error) {
    console.error('\nError submitting task:', error);
    process.exit(1);
  }
}

function formatEther(wei: bigint): string {
  const ether = Number(wei) / 1e18;
  return ether.toFixed(6);
}

main().catch(console.error);

# @oarnnetwork/sdk

TypeScript/JavaScript SDK for interacting with the OARN Network.

## Installation

```bash
npm install @oarnnetwork/sdk
```

## Quick Start

```typescript
import { OARNClient, TaskStatus, parseTokenAmount } from '@oarnnetwork/sdk';

// Initialize client with private key for transactions
const client = new OARNClient({
  privateKey: process.env.PRIVATE_KEY,
});

// Submit a task
const { taskId, tx } = await client.submitTask({
  modelHash: '0x...', // bytes32 hash of model
  inputHash: '0x...', // bytes32 hash of input
  rewardPerNode: parseTokenAmount('0.01'), // 0.01 COMP per node
  requiredNodes: 3,
  deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
});

console.log(`Task ${taskId} submitted in tx ${tx.hash}`);
```

## Configuration

```typescript
import { OARNClient } from '@oarnnetwork/sdk';

const client = new OARNClient({
  // RPC URL (defaults to Arbitrum Sepolia)
  rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',

  // Private key for signing transactions (optional for read-only)
  privateKey: '0x...',

  // IPFS gateway for downloads
  ipfsGateway: 'https://ipfs.io/ipfs/',

  // IPFS API URL for uploads (local daemon)
  ipfsApiUrl: 'http://127.0.0.1:5001/api/v0',

  // Override contract addresses if needed
  contractAddresses: {
    taskRegistry: '0x...',
  },
});
```

## API Reference

### Task Operations

#### Submit a Task

```typescript
// With pre-computed hashes
const { taskId, tx } = await client.submitTask({
  modelHash: '0x...',
  inputHash: '0x...',
  rewardPerNode: BigInt('10000000000000000'), // 0.01 ETH
  requiredNodes: 3,
  deadline: Math.floor(Date.now() / 1000) + 3600,
  consensusType: ConsensusType.Majority, // optional
});

// With automatic IPFS upload
const result = await client.submitTaskWithData(
  modelBuffer, // model data
  inputBuffer, // input data
  BigInt('10000000000000000'),
  3,
  Math.floor(Date.now() / 1000) + 3600
);
console.log(`Model CID: ${result.modelCid}`);
console.log(`Input CID: ${result.inputCid}`);
```

#### Get Task Information

```typescript
// Get a single task
const task = await client.getTask(taskId);
console.log(task.status); // TaskStatus.Active

// Get task with resolved IPFS CIDs
const taskWithCids = await client.getTaskWithCids(taskId);
console.log(taskWithCids.modelCid);

// Get all tasks (optionally filtered)
const tasks = await client.getTasks({
  requester: '0x...',
  status: TaskStatus.Pending,
});

// Get consensus status
const consensus = await client.getConsensusStatus(taskId);
console.log(`Consensus reached: ${consensus.consensusReached}`);
```

### Node Operator Functions

```typescript
// Claim a task
await client.claimTask(taskId);

// Submit a result
await client.submitResult(taskId, resultHash);

// Or submit with automatic IPFS upload
const { tx, resultCid, resultHash } = await client.submitResultWithData(
  taskId,
  resultBuffer
);
```

### IPFS Storage

```typescript
// Upload data
const cid = await client.uploadToIPFS('Hello, OARN!');

// Download data
const data = await client.downloadFromIPFS(cid);

// Get gateway URL
const url = client.getIPFSUrl(cid);
```

### Token Operations

```typescript
// Get all balances
const balance = await client.getBalance('0x...');
console.log(`ETH: ${balance.eth}`);
console.log(`COMP: ${balance.comp}`);
console.log(`GOV: ${balance.gov}`);

// Approve TaskRegistry to spend COMP
await client.approveTaskRegistry(BigInt('1000000000000000000'));

// Transfer COMP tokens
await client.transferComp('0x...', BigInt('100000000000000000'));
```

### Event Listeners

```typescript
// Listen for new tasks
client.onTaskSubmitted((taskId, requester, modelHash, inputHash) => {
  console.log(`New task ${taskId} from ${requester}`);
});

// Listen for claims
client.onTaskClaimed((taskId, node) => {
  console.log(`Task ${taskId} claimed by ${node}`);
});

// Listen for results
client.onResultSubmitted((taskId, node, resultHash) => {
  console.log(`Result submitted for task ${taskId}`);
});

// Listen for consensus
client.onConsensusReached((taskId, resultHash) => {
  console.log(`Consensus reached for task ${taskId}`);
});

// Clean up
client.removeAllListeners();
```

## Utility Functions

```typescript
import {
  hashResult,
  cidToBytes32,
  bytes32ToCidSync,
  formatTokenAmount,
  parseTokenAmount,
  isValidAddress,
} from '@oarnnetwork/sdk';

// Hash data for result submission
const hash = hashResult(Buffer.from('result data'));

// Convert between CID and bytes32
const bytes32 = cidToBytes32('bafybeig...');
const cid = bytes32ToCidSync(bytes32);

// Format/parse token amounts
const formatted = formatTokenAmount(BigInt('1500000000000000000')); // "1.5"
const wei = parseTokenAmount('1.5'); // 1500000000000000000n

// Validate addresses
if (isValidAddress(address)) {
  // ...
}
```

## Contract Addresses (Arbitrum Sepolia)

| Contract | Address |
|----------|---------|
| OARNRegistry | `0xa122518Cb6E66A804fc37EB26c8a7aF309dCF04C` |
| TaskRegistryV2 | `0xD15530ce13188EE88E43Ab07EDD9E8729fCc55D0` |
| WetLabOracle | `0xF8991A56cB5B9073a3eEC87E95Dfb055fdDF0094` |
| OARNGovernance | `0x56D2826FF4FaEF8d4Db54eF11e86d0421fc2893B` |
| COMP Token | `0x24249A523A251E38CB0001daBd54DD44Ea8f1838` |
| GOV Token | `0xB97eDD49C225d2c43e7203aB9248cAbED2B268d3` |

## Types

```typescript
enum TaskStatus {
  Pending = 0,
  Active = 1,
  Consensus = 2,
  Completed = 3,
  Disputed = 4,
  Cancelled = 5,
  Expired = 6,
}

enum ConsensusType {
  Majority = 0,
  SuperMajority = 1,
  Unanimous = 2,
}

interface Task {
  id: number;
  requester: string;
  modelHash: string;
  inputHash: string;
  rewardPerNode: bigint;
  requiredNodes: number;
  deadline: number;
  status: TaskStatus;
  consensusType: ConsensusType;
}
```

## License

MIT

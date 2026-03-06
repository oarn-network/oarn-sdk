/**
 * OARN SDK
 * TypeScript/JavaScript SDK for the OARN Network
 */

// Main client
export { OARNClient } from './client.js';

// Supporting modules
export { Blockchain } from './blockchain.js';
export { Storage } from './storage.js';

// Utilities
export {
  hashResult,
  cidToBytes32,
  bytes32ToCid,
  bytes32ToCidSync,
  isValidAddress,
  isValidBytes32,
  stringToBytes32,
  formatTokenAmount,
  parseTokenAmount,
} from './utils.js';

// Constants
export {
  ARBITRUM_SEPOLIA_ADDRESSES,
  DEFAULT_RPC_URL,
  DEFAULT_IPFS_GATEWAY,
  DEFAULT_IPFS_API_URL,
  ARBITRUM_SEPOLIA_CHAIN_ID,
  TASK_REGISTRY_ABI,
  OARN_REGISTRY_ABI,
  ERC20_ABI,
} from './constants.js';

// Types
export type {
  Task,
  TaskFilter,
  ConsensusStatus,
  SubmitTaskOptions,
  OARNConfig,
  ContractAddresses,
  Balance,
  NodeInfo,
  ResultSubmission,
} from './types.js';

export { TaskStatus, ConsensusType } from './types.js';

// Batch task types and utilities
export type {
  BatchInput,
  BatchInputManifest,
  BatchResult,
  BatchResultManifest,
  AggregatedBatchResults,
  ParameterGridConfig,
  ParameterSchema,
  ExecutionMetadata,
} from './batch.js';

export {
  generateParameterGrid,
  createBatchInputManifest,
  computeInputsChecksum,
  computeAggregatedHash,
  validateBatchInputManifest,
  validateBatchResultManifest,
  findOptimalByMetric,
  filterByThreshold,
  getTopN,
  calculateMetricStats,
} from './batch.js';

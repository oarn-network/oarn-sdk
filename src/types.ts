/**
 * OARN SDK Type Definitions
 */

// Task status enum matching contract
export enum TaskStatus {
  Pending = 0,
  Active = 1,
  Consensus = 2,
  Completed = 3,
  Disputed = 4,
  Cancelled = 5,
  Expired = 6,
}

// Consensus type enum
export enum ConsensusType {
  Majority = 0,
  SuperMajority = 1,
  Unanimous = 2,
}

// Task interface
export interface Task {
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

// Task filter for querying
export interface TaskFilter {
  requester?: string;
  status?: TaskStatus;
  fromBlock?: number;
  toBlock?: number | 'latest';
}

// Consensus status from contract
export interface ConsensusStatus {
  totalSubmissions: number;
  uniqueResults: number;
  leadingResultHash: string;
  leadingCount: number;
  consensusReached: boolean;
  requiredForConsensus: number;
}

// Submit task options
export interface SubmitTaskOptions {
  modelHash: string;
  inputHash: string;
  rewardPerNode: bigint;
  requiredNodes: number;
  deadline: number;
  consensusType?: ConsensusType;
  /** JSON string with model requirements (framework, memory, batch_mode, etc.) */
  modelRequirements?: string;
}

// Client configuration
export interface OARNConfig {
  rpcUrl?: string;
  privateKey?: string;
  ipfsGateway?: string;
  ipfsApiUrl?: string;
  contractAddresses?: Partial<ContractAddresses>;
}

// Contract addresses
export interface ContractAddresses {
  oarnRegistry: string;
  taskRegistry: string;
  compToken: string;
  govToken: string;
  wetLabOracle?: string;
}

// Balance response
export interface Balance {
  eth: bigint;
  comp: bigint;
  gov: bigint;
}

// Node info from registry
export interface NodeInfo {
  nodeAddress: string;
  rpcUrl: string;
  isActive: boolean;
  stake: bigint;
}

// Result submission
export interface ResultSubmission {
  nodeAddress: string;
  resultHash: string;
  timestamp: number;
}

// WetLab Oracle consensus result
export interface WetLabConsensus {
  taskId: number;
  agreedHash: string;
  confirmingLabCount: number;
  confirmingLabs: string[];
  verifiedAt: number;
}

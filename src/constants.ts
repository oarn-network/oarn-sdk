/**
 * OARN SDK Constants
 * Contract addresses and ABIs for Arbitrum Sepolia
 */

import type { ContractAddresses } from './types.js';

// Arbitrum Sepolia contract addresses
export const ARBITRUM_SEPOLIA_ADDRESSES: ContractAddresses = {
  oarnRegistry: '0x8DD738DBBD4A8484872F84192D011De766Ba5458',
  taskRegistry: '0x7b4898aDf69447d6ED3d62F6917CE10bD6519562',
  compToken: '0x24249A523A251E38CB0001daBd54DD44Ea8f1838',
  govToken: '0xB97eDD49C225d2c43e7203aB9248cAbED2B268d3',
};

// Default RPC URL for Arbitrum Sepolia
export const DEFAULT_RPC_URL = 'https://sepolia-rollup.arbitrum.io/rpc';

// Default IPFS configuration
export const DEFAULT_IPFS_GATEWAY = 'https://ipfs.io/ipfs/';
export const DEFAULT_IPFS_API_URL = 'http://127.0.0.1:5001/api/v0';

// Chain ID for Arbitrum Sepolia
export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;

// TaskRegistryV2 ABI (minimal for SDK usage)
export const TASK_REGISTRY_ABI = [
  // Read functions
  'function tasks(uint256 taskId) view returns (address requester, bytes32 modelHash, bytes32 inputHash, uint256 rewardPerNode, uint8 requiredNodes, uint256 deadline, uint8 status, uint8 consensusType)',
  'function taskCount() view returns (uint256)',
  'function getConsensusStatus(uint256 taskId) view returns (uint8 totalSubmissions, uint8 uniqueResults, bytes32 leadingResultHash, uint8 leadingCount, bool consensusReached, uint8 requiredForConsensus)',
  'function getTaskNodes(uint256 taskId) view returns (address[])',
  'function getNodeResult(uint256 taskId, address node) view returns (bytes32)',

  // Write functions
  'function submitTask(bytes32 modelHash, bytes32 inputHash, uint256 rewardPerNode, uint8 requiredNodes, uint256 deadline, uint8 consensusType) returns (uint256)',
  'function claimTask(uint256 taskId)',
  'function submitResult(uint256 taskId, bytes32 resultHash)',
  'function cancelTask(uint256 taskId)',

  // Events
  'event TaskSubmitted(uint256 indexed taskId, address indexed requester, bytes32 modelHash, bytes32 inputHash, uint256 rewardPerNode, uint8 requiredNodes, uint256 deadline)',
  'event TaskClaimed(uint256 indexed taskId, address indexed node)',
  'event ResultSubmitted(uint256 indexed taskId, address indexed node, bytes32 resultHash)',
  'event ConsensusReached(uint256 indexed taskId, bytes32 resultHash)',
  'event TaskCompleted(uint256 indexed taskId)',
  'event TaskCancelled(uint256 indexed taskId)',
] as const;

// OARNRegistry ABI
export const OARN_REGISTRY_ABI = [
  'function getActiveRPCProviders() view returns (address[])',
  'function getCoreContractsV2() view returns (address taskRegistry, address compToken, address govToken)',
  'function nodes(address) view returns (string rpcUrl, bool isActive, uint256 stake)',
  'function isNodeActive(address node) view returns (bool)',
] as const;

// ERC20 ABI (for COMP and GOV tokens)
export const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
] as const;

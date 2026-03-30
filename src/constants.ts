/**
 * OARN SDK Constants
 * Contract addresses and ABIs for Arbitrum Sepolia
 */

import type { ContractAddresses } from './types.js';

// Arbitrum Sepolia contract addresses
export const ARBITRUM_SEPOLIA_ADDRESSES: ContractAddresses = {
  oarnRegistry: '0xa122518Cb6E66A804fc37EB26c8a7aF309dCF04C',
  taskRegistry: '0xD15530ce13188EE88E43Ab07EDD9E8729fCc55D0',
  compToken: '0x24249A523A251E38CB0001daBd54DD44Ea8f1838',
  govToken: '0xB97eDD49C225d2c43e7203aB9248cAbED2B268d3',
  wetLabOracle: '0xF8991A56cB5B9073a3eEC87E95Dfb055fdDF0094',
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
  'function tasks(uint256 taskId) view returns (address requester, bytes32 modelHash, bytes32 inputHash, uint256 rewardPerNode, uint256 requiredNodes, uint256 deadline, uint8 status, uint8 consensusType)',
  'function taskCount() view returns (uint256)',
  'function getConsensusStatus(uint256 taskId) view returns (uint256 totalSubmissions, uint256 uniqueResults, bytes32 leadingResultHash, uint256 leadingCount, bool consensusReached, uint256 requiredForConsensus)',
  'function getTaskNodes(uint256 taskId) view returns (address[])',
  'function getNodeResult(uint256 taskId, address node) view returns (bytes32)',

  // Write functions
  'function submitTask(bytes32 modelHash, bytes32 inputHash, string modelRequirements, uint256 rewardPerNode, uint256 requiredNodes, uint256 deadline, uint8 consensusType) payable returns (uint256)',
  'function claimTask(uint256 taskId)',
  'function submitResult(uint256 taskId, bytes32 resultHash)',
  'function cancelTask(uint256 taskId)',
  'function fundTask(uint256 taskId) payable',

  // Events
  'event TaskCreated(uint256 indexed taskId, address indexed requester, bytes32 modelHash, uint256 rewardPerNode, uint256 requiredNodes, uint8 consensusType)',
  'event TaskClaimed(uint256 indexed taskId, address indexed node)',
  'event ResultSubmitted(uint256 indexed taskId, address indexed node, bytes32 resultHash)',
  'event ConsensusReached(uint256 indexed taskId, bytes32 resultHash)',
  'event TaskCompleted(uint256 indexed taskId)',
  'event TaskCancelled(uint256 indexed taskId)',
  'event TaskFunded(uint256 indexed taskId, address indexed funder, uint256 fundingAmount, uint256 newRewardPerNode)',
] as const;

// OARNRegistry ABI
export const OARN_REGISTRY_ABI = [
  'function getActiveRPCProviders() view returns (address[])',
  'function getCoreContractsV2() view returns (address taskRegistry, address compToken, address govToken)',
  'function nodes(address) view returns (string rpcUrl, bool isActive, uint256 stake)',
  'function isNodeActive(address node) view returns (bool)',
] as const;

// WetLabOracle ABI
export const WET_LAB_ORACLE_ABI = [
  'function certifiedLabs(address) view returns (bool)',
  'function pendingRewards(address) view returns (uint256)',
  'function rewardPerVerification() view returns (uint256)',
  'function requiredLabConfirmations() view returns (uint256)',
  'function rewardPoolBalance() view returns (uint256)',
  'function isLabCertified(address lab) view returns (bool)',
  'function getTaskSubmitters(uint256 taskId) view returns (address[])',
  'function getVerifiedResult(uint256 taskId) view returns (bytes32 agreedHash, uint256 confirmingLabCount, address[] confirmingLabs, uint256 verifiedAt)',
  'function submitResult(uint256 taskId, bytes32 parametersHash, int256 measuredValue, string metric) nonpayable',
  'function claimReward() nonpayable',
  'function certifyLab(address lab) nonpayable',
  'function decertifyLab(address lab) nonpayable',
  'function depositRewardPool(uint256 amount) nonpayable',
  'function setRewardPerVerification(uint256 newReward) nonpayable',
  'function setRequiredConfirmations(uint256 newRequired) nonpayable',
  'event LabCertified(address indexed lab)',
  'event LabDecertified(address indexed lab)',
  'event ResultSubmitted(uint256 indexed taskId, address indexed lab, bytes32 resultHash)',
  'event ConsensusReached(uint256 indexed taskId, bytes32 resultHash, uint256 labCount)',
  'event RewardClaimed(address indexed lab, uint256 amount)',
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

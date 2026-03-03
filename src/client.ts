/**
 * OARN SDK Client
 * Main entry point for interacting with the OARN Network
 */

import type { ContractTransactionResponse } from 'ethers';
import { Blockchain } from './blockchain.js';
import { Storage } from './storage.js';
import { hashResult, cidToBytes32, bytes32ToCidSync } from './utils.js';
import type {
  OARNConfig,
  Task,
  TaskFilter,
  ConsensusStatus,
  SubmitTaskOptions,
  Balance,
  ConsensusType,
} from './types.js';

export class OARNClient {
  private blockchain: Blockchain;
  private storage: Storage;

  constructor(config: OARNConfig = {}) {
    this.blockchain = new Blockchain({
      rpcUrl: config.rpcUrl,
      privateKey: config.privateKey,
      contractAddresses: config.contractAddresses,
    });

    this.storage = new Storage({
      ipfsGateway: config.ipfsGateway,
      ipfsApiUrl: config.ipfsApiUrl,
    });
  }

  // ============================================
  // Task Operations
  // ============================================

  /**
   * Submit a new task to the OARN network
   *
   * @param options - Task submission options
   * @returns Task ID and transaction response
   *
   * @example
   * ```typescript
   * const { taskId, tx } = await client.submitTask({
   *   modelHash: '0x...',
   *   inputHash: '0x...',
   *   rewardPerNode: parseEther('0.01'),
   *   requiredNodes: 3,
   *   deadline: Math.floor(Date.now() / 1000) + 3600,
   * });
   * ```
   */
  async submitTask(options: SubmitTaskOptions): Promise<{ taskId: number; tx: ContractTransactionResponse }> {
    return this.blockchain.submitTask(options);
  }

  /**
   * Submit a task with IPFS data upload
   *
   * @param modelData - Model data to upload to IPFS
   * @param inputData - Input data to upload to IPFS
   * @param rewardPerNode - Reward per node in wei
   * @param requiredNodes - Number of required nodes
   * @param deadline - Unix timestamp deadline
   * @param consensusType - Consensus type (optional)
   * @returns Task ID, transaction, and CIDs
   */
  async submitTaskWithData(
    modelData: Buffer | string,
    inputData: Buffer | string,
    rewardPerNode: bigint,
    requiredNodes: number,
    deadline: number,
    consensusType?: ConsensusType
  ): Promise<{
    taskId: number;
    tx: ContractTransactionResponse;
    modelCid: string;
    inputCid: string;
  }> {
    // Upload data to IPFS
    const [modelCid, inputCid] = await Promise.all([
      this.storage.upload(modelData),
      this.storage.upload(inputData),
    ]);

    // Convert CIDs to bytes32 for contract
    const modelHash = cidToBytes32(modelCid);
    const inputHash = cidToBytes32(inputCid);

    // Submit task
    const { taskId, tx } = await this.blockchain.submitTask({
      modelHash,
      inputHash,
      rewardPerNode,
      requiredNodes,
      deadline,
      consensusType,
    });

    return { taskId, tx, modelCid, inputCid };
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: number): Promise<Task> {
    return this.blockchain.getTask(taskId);
  }

  /**
   * Get a task with IPFS CIDs resolved
   */
  async getTaskWithCids(taskId: number): Promise<Task & { modelCid: string; inputCid: string }> {
    const task = await this.blockchain.getTask(taskId);

    return {
      ...task,
      modelCid: bytes32ToCidSync(task.modelHash),
      inputCid: bytes32ToCidSync(task.inputHash),
    };
  }

  /**
   * Get multiple tasks with optional filtering
   */
  async getTasks(filter?: TaskFilter): Promise<Task[]> {
    return this.blockchain.getTasks(filter);
  }

  /**
   * Get the total number of tasks
   */
  async getTaskCount(): Promise<number> {
    return this.blockchain.getTaskCount();
  }

  /**
   * Get consensus status for a task
   */
  async getConsensusStatus(taskId: number): Promise<ConsensusStatus> {
    return this.blockchain.getConsensusStatus(taskId);
  }

  /**
   * Get nodes assigned to a task
   */
  async getTaskNodes(taskId: number): Promise<string[]> {
    return this.blockchain.getTaskNodes(taskId);
  }

  /**
   * Cancel a task (requester only)
   */
  async cancelTask(taskId: number): Promise<ContractTransactionResponse> {
    return this.blockchain.cancelTask(taskId);
  }

  // ============================================
  // Node Operator Functions
  // ============================================

  /**
   * Claim a task as a node operator
   */
  async claimTask(taskId: number): Promise<ContractTransactionResponse> {
    return this.blockchain.claimTask(taskId);
  }

  /**
   * Submit a result for a task
   *
   * @param taskId - Task ID
   * @param resultHash - Keccak256 hash of the result (0x prefixed)
   */
  async submitResult(taskId: number, resultHash: string): Promise<ContractTransactionResponse> {
    return this.blockchain.submitResult(taskId, resultHash);
  }

  /**
   * Submit a result by uploading data to IPFS first
   *
   * @param taskId - Task ID
   * @param resultData - Result data to upload
   * @returns Transaction and result CID
   */
  async submitResultWithData(
    taskId: number,
    resultData: Buffer | string
  ): Promise<{ tx: ContractTransactionResponse; resultCid: string; resultHash: string }> {
    // Upload to IPFS
    const resultCid = await this.storage.upload(resultData);

    // Hash the data for the contract
    const resultHash = hashResult(resultData);

    // Submit the hash
    const tx = await this.blockchain.submitResult(taskId, resultHash);

    return { tx, resultCid, resultHash };
  }

  /**
   * Get a node's submitted result hash for a task
   */
  async getNodeResult(taskId: number, nodeAddress: string): Promise<string> {
    return this.blockchain.getNodeResult(taskId, nodeAddress);
  }

  // ============================================
  // Storage Functions
  // ============================================

  /**
   * Upload data to IPFS
   *
   * @param data - Data to upload
   * @returns IPFS CID
   */
  async uploadToIPFS(data: Buffer | string): Promise<string> {
    return this.storage.upload(data);
  }

  /**
   * Download data from IPFS
   *
   * @param cid - IPFS CID
   * @returns Downloaded data
   */
  async downloadFromIPFS(cid: string): Promise<Buffer> {
    return this.storage.download(cid);
  }

  /**
   * Get IPFS gateway URL for a CID
   */
  getIPFSUrl(cid: string): string {
    return this.storage.getGatewayUrl(cid);
  }

  // ============================================
  // Token & Balance Functions
  // ============================================

  /**
   * Get all balances for an address
   */
  async getBalance(address: string): Promise<Balance> {
    const [eth, comp, gov] = await Promise.all([
      this.blockchain.getEthBalance(address),
      this.blockchain.getCompBalance(address),
      this.blockchain.getGovBalance(address),
    ]);

    return { eth, comp, gov };
  }

  /**
   * Approve COMP token spending by TaskRegistry
   */
  async approveTaskRegistry(amount: bigint): Promise<ContractTransactionResponse> {
    const addresses = this.blockchain.getAddresses();
    return this.blockchain.approveComp(addresses.taskRegistry, amount);
  }

  /**
   * Transfer COMP tokens
   */
  async transferComp(to: string, amount: bigint): Promise<ContractTransactionResponse> {
    return this.blockchain.transferComp(to, amount);
  }

  // ============================================
  // Network Functions
  // ============================================

  /**
   * Get active node providers
   */
  async getActiveProviders(): Promise<string[]> {
    return this.blockchain.getActiveProviders();
  }

  /**
   * Check if a node is active
   */
  async isNodeActive(nodeAddress: string): Promise<boolean> {
    return this.blockchain.isNodeActive(nodeAddress);
  }

  /**
   * Get the connected wallet address
   */
  getAddress(): string | null {
    return this.blockchain.signerAddress;
  }

  /**
   * Get contract addresses
   */
  getContractAddresses(): {
    oarnRegistry: string;
    taskRegistry: string;
    compToken: string;
    govToken: string;
  } {
    return this.blockchain.getAddresses();
  }

  // ============================================
  // Event Listeners
  // ============================================

  /**
   * Listen for new task submissions
   */
  onTaskSubmitted(
    callback: (taskId: number, requester: string, modelHash: string, inputHash: string) => void
  ): void {
    this.blockchain.onTaskSubmitted(callback);
  }

  /**
   * Listen for task claims
   */
  onTaskClaimed(callback: (taskId: number, node: string) => void): void {
    this.blockchain.onTaskClaimed(callback);
  }

  /**
   * Listen for result submissions
   */
  onResultSubmitted(callback: (taskId: number, node: string, resultHash: string) => void): void {
    this.blockchain.onResultSubmitted(callback);
  }

  /**
   * Listen for consensus events
   */
  onConsensusReached(callback: (taskId: number, resultHash: string) => void): void {
    this.blockchain.onConsensusReached(callback);
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.blockchain.removeAllListeners();
  }
}

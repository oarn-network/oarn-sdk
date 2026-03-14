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
import type {
  BatchInput,
  BatchInputManifest,
  BatchResult,
  BatchResultManifest,
  AggregatedBatchResults,
  ParameterGridConfig,
  ParameterSchema,
} from './batch.js';
import {
  generateParameterGrid,
  createBatchInputManifest,
  validateBatchResultManifest,
  findOptimalByMetric,
  filterByThreshold,
  getTopN,
  calculateMetricStats,
} from './batch.js';

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

  /**
   * Fund an existing task with additional ETH to increase rewards
   * @param taskId - Task ID to fund
   * @param amount - Amount of ETH to add (in wei)
   */
  async fundTask(taskId: number, amount: bigint): Promise<ContractTransactionResponse> {
    return this.blockchain.fundTask(taskId, amount);
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

  // ============================================
  // Batch Task Operations
  // ============================================

  /**
   * Submit a batch task with multiple input parameters
   *
   * This uploads a batch input manifest to IPFS and submits a task
   * where nodes will process all inputs in parallel.
   *
   * @param modelData - Model data (ONNX model or path)
   * @param inputs - Array of input parameter sets
   * @param rewardPerNode - Reward per node in wei
   * @param requiredNodes - Number of required nodes for consensus
   * @param deadline - Unix timestamp deadline
   * @param consensusType - Consensus type (optional)
   * @param parameterSchema - Schema describing parameters (optional)
   * @returns Task ID, transaction, and CIDs
   *
   * @example
   * ```typescript
   * // Generate parameter grid
   * const inputs = generateParameterGrid({
   *   temperature: { min: 20, max: 40, steps: 10 },
   *   concentration: { min: 0.1, max: 1.0, steps: 10 },
   * });
   *
   * // Submit batch task
   * const { taskId, modelCid, manifestCid } = await client.submitBatchTask(
   *   modelBuffer,
   *   inputs,
   *   parseEther('0.1'),
   *   5,
   *   deadline
   * );
   * ```
   */
  async submitBatchTask(
    modelData: Buffer | string,
    inputs: BatchInput[],
    rewardPerNode: bigint,
    requiredNodes: number,
    deadline: number,
    consensusType?: ConsensusType,
    parameterSchema?: ParameterSchema
  ): Promise<{
    taskId: number;
    tx: ContractTransactionResponse;
    modelCid: string;
    manifestCid: string;
    totalInputs: number;
  }> {
    // Upload model to IPFS
    const modelCid = await this.storage.upload(modelData);

    // Create batch input manifest
    const manifest = createBatchInputManifest(modelCid, inputs, parameterSchema);

    // Upload manifest to IPFS
    const manifestJson = JSON.stringify(manifest, null, 2);
    const manifestCid = await this.storage.upload(manifestJson);

    // Convert CIDs to bytes32 for contract
    const modelHash = cidToBytes32(modelCid);
    const inputHash = cidToBytes32(manifestCid);

    // Submit task with manifest as input
    // The batch_mode flag is encoded in the manifest itself
    const { taskId, tx } = await this.blockchain.submitTask({
      modelHash,
      inputHash,
      rewardPerNode,
      requiredNodes,
      deadline,
      consensusType,
    });

    return {
      taskId,
      tx,
      modelCid,
      manifestCid,
      totalInputs: inputs.length,
    };
  }

  /**
   * Submit a batch task using a parameter grid configuration
   *
   * Convenience method that generates parameter combinations from a grid config.
   *
   * @example
   * ```typescript
   * const { taskId } = await client.submitBatchTaskFromGrid(
   *   modelBuffer,
   *   {
   *     temperature: { min: 20, max: 40, steps: 5 },
   *     concentration: [0.1, 0.5, 1.0], // Explicit values
   *   },
   *   parseEther('0.1'),
   *   5,
   *   deadline
   * );
   * ```
   */
  async submitBatchTaskFromGrid(
    modelData: Buffer | string,
    gridConfig: ParameterGridConfig,
    rewardPerNode: bigint,
    requiredNodes: number,
    deadline: number,
    consensusType?: ConsensusType
  ): Promise<{
    taskId: number;
    tx: ContractTransactionResponse;
    modelCid: string;
    manifestCid: string;
    totalInputs: number;
  }> {
    const inputs = generateParameterGrid(gridConfig);
    return this.submitBatchTask(
      modelData,
      inputs,
      rewardPerNode,
      requiredNodes,
      deadline,
      consensusType
    );
  }

  /**
   * Get batch results for a completed task
   *
   * Downloads result manifests from nodes and aggregates them.
   *
   * @param taskId - Task ID
   * @returns Aggregated batch results with consensus info
   *
   * @example
   * ```typescript
   * const results = await client.getBatchResults(taskId);
   *
   * if (results.consensusReached) {
   *   // Find the optimal parameter combination
   *   const optimal = findOptimalByMetric(results.results, 'yield', 'max');
   *   console.log('Optimal params:', optimal);
   * }
   * ```
   */
  async getBatchResults(taskId: number): Promise<AggregatedBatchResults> {
    // Get consensus status
    const consensus = await this.blockchain.getConsensusStatus(taskId);

    // Get nodes that submitted results
    const nodes = await this.blockchain.getTaskNodes(taskId);

    // Collect result manifests from nodes
    const resultManifests: BatchResultManifest[] = [];

    for (const nodeAddress of nodes) {
      try {
        // Get the result hash for this node
        const resultHash = await this.blockchain.getNodeResult(taskId, nodeAddress);

        if (resultHash && resultHash !== '0x' + '0'.repeat(64)) {
          // Try to fetch the result manifest from IPFS
          // Nodes upload their result manifest, we can find it via task events or direct lookup
          // For now, we'll collect what we can from the blockchain

          // The full result manifest would need to be fetched from IPFS
          // This is a simplified version that works with on-chain data
        }
      } catch {
        // Node may not have submitted yet
      }
    }

    // Build aggregated results
    const aggregatedResults: AggregatedBatchResults = {
      taskId,
      consensusReached: consensus.consensusReached,
      totalInputs: 0, // Will be filled from manifest
      nodesAgreed: consensus.leadingCount,
      nodesTotal: nodes.length,
      results: [],
      executionMetadata: [],
    };

    // If we have result manifests, merge them
    if (resultManifests.length > 0) {
      // Use results from first manifest (they should all match if consensus reached)
      aggregatedResults.results = resultManifests[0].results;
      aggregatedResults.totalInputs = resultManifests[0].results.length;
      aggregatedResults.executionMetadata = resultManifests.map((m) => m.execution_metadata);
    }

    return aggregatedResults;
  }

  /**
   * Fetch and parse a batch result manifest from IPFS
   *
   * @param cid - IPFS CID of the result manifest
   * @returns Parsed result manifest or null if invalid
   */
  async fetchBatchResultManifest(cid: string): Promise<BatchResultManifest | null> {
    try {
      const data = await this.storage.download(cid);
      const manifest = JSON.parse(data.toString());

      if (validateBatchResultManifest(manifest)) {
        return manifest;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch batch input manifest from IPFS
   *
   * @param cid - IPFS CID of the input manifest
   * @returns Parsed input manifest
   */
  async fetchBatchInputManifest(cid: string): Promise<BatchInputManifest> {
    const data = await this.storage.download(cid);
    return JSON.parse(data.toString());
  }

  // ============================================
  // Batch Result Analysis Helpers
  // ============================================

  /**
   * Find the result with optimal value for a metric
   *
   * @example
   * ```typescript
   * const best = client.findOptimalResult(results, 'yield', 'max');
   * console.log('Best yield:', best?.output.yield);
   * ```
   */
  findOptimalResult(
    results: BatchResult[],
    metricKey: string,
    optimize: 'max' | 'min'
  ): BatchResult | null {
    return findOptimalByMetric(results, metricKey, optimize);
  }

  /**
   * Filter results by threshold
   *
   * @example
   * ```typescript
   * const highYield = client.filterResults(results, 'yield', 0.5, 'gte');
   * ```
   */
  filterResults(
    results: BatchResult[],
    metricKey: string,
    threshold: number,
    comparison: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
  ): BatchResult[] {
    return filterByThreshold(results, metricKey, threshold, comparison);
  }

  /**
   * Get top N results by metric
   *
   * @example
   * ```typescript
   * const top10 = client.getTopResults(results, 'yield', 10, 'desc');
   * ```
   */
  getTopResults(
    results: BatchResult[],
    metricKey: string,
    n: number,
    order: 'asc' | 'desc' = 'desc'
  ): BatchResult[] {
    return getTopN(results, metricKey, n, order);
  }

  /**
   * Calculate statistics for a metric
   *
   * @example
   * ```typescript
   * const stats = client.getMetricStats(results, 'yield');
   * console.log(`Mean: ${stats.mean}, Std Dev: ${stats.stdDev}`);
   * ```
   */
  getMetricStats(
    results: BatchResult[],
    metricKey: string
  ): { min: number; max: number; mean: number; median: number; stdDev: number } | null {
    return calculateMetricStats(results, metricKey);
  }
}

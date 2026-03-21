/**
 * OARN SDK Blockchain
 * Contract interactions and transaction helpers
 */

import {
  JsonRpcProvider,
  Wallet,
  Contract,
  type ContractTransactionResponse,
  type EventLog,
} from 'ethers';
import {
  ARBITRUM_SEPOLIA_ADDRESSES,
  DEFAULT_RPC_URL,
  TASK_REGISTRY_ABI,
  OARN_REGISTRY_ABI,
  ERC20_ABI,
  WET_LAB_ORACLE_ABI,
} from './constants.js';
import type {
  ContractAddresses,
  Task,
  TaskStatus,
  ConsensusType,
  ConsensusStatus,
  SubmitTaskOptions,
  TaskFilter,
  WetLabConsensus,
} from './types.js';

export interface BlockchainConfig {
  rpcUrl?: string;
  privateKey?: string;
  contractAddresses?: Partial<ContractAddresses>;
}

export class Blockchain {
  private provider: JsonRpcProvider;
  private signer: Wallet | null = null;
  private addresses: ContractAddresses;

  // Contract instances
  private _taskRegistry: Contract | null = null;
  private _oarnRegistry: Contract | null = null;
  private _compToken: Contract | null = null;
  private _govToken: Contract | null = null;
  private _wetLabOracle: Contract | null = null;

  constructor(config: BlockchainConfig = {}) {
    this.provider = new JsonRpcProvider(config.rpcUrl || DEFAULT_RPC_URL);
    this.addresses = {
      ...ARBITRUM_SEPOLIA_ADDRESSES,
      ...config.contractAddresses,
    };

    if (config.privateKey) {
      this.signer = new Wallet(config.privateKey, this.provider);
    }
  }

  /**
   * Get the signer address
   */
  get signerAddress(): string | null {
    return this.signer?.address || null;
  }

  /**
   * Get TaskRegistry contract instance
   */
  get taskRegistry(): Contract {
    if (!this._taskRegistry) {
      this._taskRegistry = new Contract(
        this.addresses.taskRegistry,
        TASK_REGISTRY_ABI,
        this.signer || this.provider
      );
    }
    return this._taskRegistry;
  }

  /**
   * Get OARNRegistry contract instance
   */
  get oarnRegistry(): Contract {
    if (!this._oarnRegistry) {
      this._oarnRegistry = new Contract(
        this.addresses.oarnRegistry,
        OARN_REGISTRY_ABI,
        this.signer || this.provider
      );
    }
    return this._oarnRegistry;
  }

  /**
   * Get COMP token contract instance
   */
  get compToken(): Contract {
    if (!this._compToken) {
      this._compToken = new Contract(
        this.addresses.compToken,
        ERC20_ABI,
        this.signer || this.provider
      );
    }
    return this._compToken;
  }

  /**
   * Get GOV token contract instance
   */
  get govToken(): Contract {
    if (!this._govToken) {
      this._govToken = new Contract(
        this.addresses.govToken,
        ERC20_ABI,
        this.signer || this.provider
      );
    }
    return this._govToken;
  }

  /**
   * Get WetLabOracle contract instance
   */
  get wetLabOracle(): Contract {
    const addr = this.addresses.wetLabOracle;
    if (!addr) throw new Error('WetLabOracle address not configured');
    if (!this._wetLabOracle) {
      this._wetLabOracle = new Contract(addr, WET_LAB_ORACLE_ABI, this.signer || this.provider);
    }
    return this._wetLabOracle;
  }

  /**
   * Submit a new task to the registry
   */
  async submitTask(options: SubmitTaskOptions): Promise<{ taskId: number; tx: ContractTransactionResponse }> {
    if (!this.signer) {
      throw new Error('Signer required to submit task');
    }

    const {
      modelHash,
      inputHash,
      rewardPerNode,
      requiredNodes,
      deadline,
      consensusType = 0, // Majority by default
      modelRequirements = '', // Empty string if not provided
    } = options;

    // Calculate total reward to send with transaction
    const totalReward = rewardPerNode * BigInt(requiredNodes);

    const tx: ContractTransactionResponse = await this.taskRegistry.submitTask(
      modelHash,
      inputHash,
      modelRequirements,
      rewardPerNode,
      requiredNodes,
      deadline,
      consensusType,
      { value: totalReward }
    );

    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error('Transaction failed');
    }

    // Extract taskId from TaskCreated event
    const event = receipt.logs.find((log): log is EventLog => {
      return 'eventName' in log && log.eventName === 'TaskCreated';
    });

    if (!event || !('args' in event)) {
      throw new Error('TaskCreated event not found');
    }

    const taskId = Number(event.args[0]);

    return { taskId, tx };
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: number): Promise<Task> {
    const result = await this.taskRegistry.tasks(taskId);

    return {
      id: taskId,
      requester: result[0],
      modelHash: result[1],
      inputHash: result[2],
      rewardPerNode: result[3],
      requiredNodes: Number(result[4]),
      deadline: Number(result[5]),
      status: Number(result[6]) as TaskStatus,
      consensusType: Number(result[7]) as ConsensusType,
    };
  }

  /**
   * Get total task count
   */
  async getTaskCount(): Promise<number> {
    const count = await this.taskRegistry.taskCount();
    return Number(count);
  }

  /**
   * Get tasks with optional filtering
   */
  async getTasks(filter?: TaskFilter): Promise<Task[]> {
    const taskCount = await this.getTaskCount();
    const tasks: Task[] = [];

    // Simple implementation: fetch all and filter
    // For production, use event logs for efficient querying
    for (let i = 1; i <= taskCount; i++) {
      const task = await this.getTask(i);

      if (filter) {
        if (filter.requester && task.requester.toLowerCase() !== filter.requester.toLowerCase()) {
          continue;
        }
        if (filter.status !== undefined && task.status !== filter.status) {
          continue;
        }
      }

      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Get consensus status for a task
   */
  async getConsensusStatus(taskId: number): Promise<ConsensusStatus> {
    const result = await this.taskRegistry.getConsensusStatus(taskId);

    return {
      totalSubmissions: Number(result[0]),
      uniqueResults: Number(result[1]),
      leadingResultHash: result[2],
      leadingCount: Number(result[3]),
      consensusReached: result[4],
      requiredForConsensus: Number(result[5]),
    };
  }

  /**
   * Claim a task as a node operator
   */
  async claimTask(taskId: number): Promise<ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required to claim task');
    }

    const tx = await this.taskRegistry.claimTask(taskId);
    await tx.wait();
    return tx;
  }

  /**
   * Submit a result for a task
   */
  async submitResult(taskId: number, resultHash: string): Promise<ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required to submit result');
    }

    const tx = await this.taskRegistry.submitResult(taskId, resultHash);
    await tx.wait();
    return tx;
  }

  /**
   * Cancel a task (requester only)
   */
  async cancelTask(taskId: number): Promise<ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required to cancel task');
    }

    const tx = await this.taskRegistry.cancelTask(taskId);
    await tx.wait();
    return tx;
  }

  /**
   * Fund an existing task with additional ETH to increase rewards
   */
  async fundTask(taskId: number, amount: bigint): Promise<ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required to fund task');
    }

    const tx = await this.taskRegistry.fundTask(taskId, { value: amount });
    await tx.wait();
    return tx;
  }

  /**
   * Get nodes assigned to a task
   */
  async getTaskNodes(taskId: number): Promise<string[]> {
    return await this.taskRegistry.getTaskNodes(taskId);
  }

  /**
   * Get a node's result for a task
   */
  async getNodeResult(taskId: number, nodeAddress: string): Promise<string> {
    return await this.taskRegistry.getNodeResult(taskId, nodeAddress);
  }

  /**
   * Get active RPC providers from registry
   */
  async getActiveProviders(): Promise<string[]> {
    return await this.oarnRegistry.getActiveRPCProviders();
  }

  /**
   * Check if a node is active
   */
  async isNodeActive(nodeAddress: string): Promise<boolean> {
    return await this.oarnRegistry.isNodeActive(nodeAddress);
  }

  /**
   * Get ETH balance
   */
  async getEthBalance(address: string): Promise<bigint> {
    return await this.provider.getBalance(address);
  }

  /**
   * Get COMP token balance
   */
  async getCompBalance(address: string): Promise<bigint> {
    return await this.compToken.balanceOf(address);
  }

  /**
   * Get GOV token balance
   */
  async getGovBalance(address: string): Promise<bigint> {
    return await this.govToken.balanceOf(address);
  }

  /**
   * Approve COMP token spending
   */
  async approveComp(spender: string, amount: bigint): Promise<ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required to approve');
    }

    const tx = await this.compToken.approve(spender, amount);
    await tx.wait();
    return tx;
  }

  /**
   * Transfer COMP tokens
   */
  async transferComp(to: string, amount: bigint): Promise<ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required to transfer');
    }

    const tx = await this.compToken.transfer(to, amount);
    await tx.wait();
    return tx;
  }

  /**
   * Submit a wet lab result to the WetLabOracle
   */
  async submitWetLabResult(
    taskId: number,
    parametersHash: string,
    measuredValue: bigint,
    metric: string
  ): Promise<ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required to submit wet lab result');
    }
    const tx = await this.wetLabOracle.submitResult(taskId, parametersHash, measuredValue, metric);
    await tx.wait();
    return tx;
  }

  /**
   * Get verified wet lab result for a task
   */
  async getVerifiedWetLabResult(taskId: number): Promise<WetLabConsensus> {
    const result = await this.wetLabOracle.getVerifiedResult(taskId);
    return {
      taskId,
      agreedHash: result[0],
      confirmingLabCount: Number(result[1]),
      confirmingLabs: result[2],
      verifiedAt: Number(result[3]),
    };
  }

  /**
   * Get pending wet lab rewards for an address
   */
  async getWetLabPendingRewards(address: string): Promise<bigint> {
    return await this.wetLabOracle.pendingRewards(address);
  }

  /**
   * Claim wet lab verification rewards
   */
  async claimWetLabReward(): Promise<ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required to claim reward');
    }
    const tx = await this.wetLabOracle.claimReward();
    await tx.wait();
    return tx;
  }

  /**
   * Listen for TaskSubmitted events
   */
  onTaskSubmitted(
    callback: (taskId: number, requester: string, modelHash: string, inputHash: string) => void
  ): void {
    this.taskRegistry.on('TaskSubmitted', (taskId, requester, modelHash, inputHash) => {
      callback(Number(taskId), requester, modelHash, inputHash);
    });
  }

  /**
   * Listen for TaskClaimed events
   */
  onTaskClaimed(callback: (taskId: number, node: string) => void): void {
    this.taskRegistry.on('TaskClaimed', (taskId, node) => {
      callback(Number(taskId), node);
    });
  }

  /**
   * Listen for ResultSubmitted events
   */
  onResultSubmitted(callback: (taskId: number, node: string, resultHash: string) => void): void {
    this.taskRegistry.on('ResultSubmitted', (taskId, node, resultHash) => {
      callback(Number(taskId), node, resultHash);
    });
  }

  /**
   * Listen for ConsensusReached events
   */
  onConsensusReached(callback: (taskId: number, resultHash: string) => void): void {
    this.taskRegistry.on('ConsensusReached', (taskId, resultHash) => {
      callback(Number(taskId), resultHash);
    });
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.taskRegistry.removeAllListeners();
    this.oarnRegistry.removeAllListeners();
  }

  /**
   * Get the provider instance
   */
  getProvider(): JsonRpcProvider {
    return this.provider;
  }

  /**
   * Get contract addresses
   */
  getAddresses(): ContractAddresses {
    return { ...this.addresses };
  }
}

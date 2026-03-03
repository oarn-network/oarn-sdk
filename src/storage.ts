/**
 * OARN SDK Storage
 * IPFS integration for data upload/download
 */

import { CID } from 'multiformats/cid';
import { DEFAULT_IPFS_GATEWAY, DEFAULT_IPFS_API_URL } from './constants.js';

export interface StorageConfig {
  ipfsGateway?: string;
  ipfsApiUrl?: string;
}

export class Storage {
  private gateway: string;
  private apiUrl: string;

  constructor(config: StorageConfig = {}) {
    this.gateway = config.ipfsGateway || DEFAULT_IPFS_GATEWAY;
    this.apiUrl = config.ipfsApiUrl || DEFAULT_IPFS_API_URL;
  }

  /**
   * Upload data to IPFS via local daemon
   * @param data - Data to upload
   * @returns IPFS CID
   */
  async upload(data: Buffer | Uint8Array | string): Promise<string> {
    const content = typeof data === 'string' ? new TextEncoder().encode(data) : data;

    // Try local IPFS daemon first
    try {
      return await this.uploadToLocalDaemon(content);
    } catch (error) {
      // Fall back to public pinning services if available
      throw new Error(
        `Failed to upload to IPFS. Ensure IPFS daemon is running at ${this.apiUrl}. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Upload to local IPFS daemon
   */
  private async uploadToLocalDaemon(data: Uint8Array): Promise<string> {
    const formData = new FormData();
    // Create ArrayBuffer copy to satisfy TypeScript's strict BlobPart typing
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    formData.append('file', new Blob([buffer]));

    const response = await fetch(`${this.apiUrl}/add?pin=true`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`IPFS daemon returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result.Hash;
  }

  /**
   * Download data from IPFS
   * @param cid - IPFS CID
   * @returns Downloaded data as Buffer
   */
  async download(cid: string): Promise<Buffer> {
    // Validate CID
    try {
      CID.parse(cid);
    } catch {
      throw new Error(`Invalid CID: ${cid}`);
    }

    // Try multiple gateways
    const gateways = [
      this.gateway,
      'https://dweb.link/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://gateway.pinata.cloud/ipfs/',
    ];

    let lastError: Error | null = null;

    for (const gateway of gateways) {
      try {
        return await this.downloadFromGateway(cid, gateway);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }
    }

    // Try local daemon as last resort
    try {
      return await this.downloadFromLocalDaemon(cid);
    } catch (error) {
      throw new Error(
        `Failed to download from IPFS. Tried ${gateways.length} gateways and local daemon. ` +
        `Last error: ${lastError?.message || 'unknown'}`
      );
    }
  }

  /**
   * Download from an IPFS gateway
   */
  private async downloadFromGateway(cid: string, gateway: string): Promise<Buffer> {
    const url = gateway.endsWith('/') ? `${gateway}${cid}` : `${gateway}/${cid}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Gateway returned ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Download from local IPFS daemon
   */
  private async downloadFromLocalDaemon(cid: string): Promise<Buffer> {
    const response = await fetch(`${this.apiUrl}/cat?arg=${cid}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`IPFS daemon returned ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Check if a CID is pinned locally
   * @param cid - IPFS CID to check
   * @returns true if pinned
   */
  async isPinned(cid: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/pin/ls?arg=${cid}`, {
        method: 'POST',
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      return result.Keys && Object.keys(result.Keys).length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Pin a CID locally
   * @param cid - IPFS CID to pin
   */
  async pin(cid: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/pin/add?arg=${cid}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to pin ${cid}: ${response.statusText}`);
    }
  }

  /**
   * Unpin a CID locally
   * @param cid - IPFS CID to unpin
   */
  async unpin(cid: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/pin/rm?arg=${cid}`, {
      method: 'POST',
    });

    if (!response.ok && response.status !== 500) {
      // 500 often means "not pinned" which is fine
      throw new Error(`Failed to unpin ${cid}: ${response.statusText}`);
    }
  }

  /**
   * Get IPFS gateway URL for a CID
   * @param cid - IPFS CID
   * @returns Full gateway URL
   */
  getGatewayUrl(cid: string): string {
    return this.gateway.endsWith('/')
      ? `${this.gateway}${cid}`
      : `${this.gateway}/${cid}`;
  }
}

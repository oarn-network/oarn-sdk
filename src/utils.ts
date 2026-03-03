/**
 * OARN SDK Utilities
 * Hash and CID conversion helpers
 */

import { keccak256, toUtf8Bytes, hexlify, getBytes } from 'ethers';
import { CID } from 'multiformats/cid';
import * as raw from 'multiformats/codecs/raw';
import { sha256 } from 'multiformats/hashes/sha2';

/**
 * Hash data using Keccak256 (for result submission)
 * @param data - Data to hash (Buffer, Uint8Array, or string)
 * @returns Hex string hash (0x prefixed)
 */
export function hashResult(data: Buffer | Uint8Array | string): string {
  if (typeof data === 'string') {
    return keccak256(toUtf8Bytes(data));
  }
  return keccak256(data);
}

/**
 * Convert IPFS CID to bytes32 for contract storage
 * Extracts the multihash digest from CIDv1
 * @param cid - IPFS CID string
 * @returns bytes32 hex string (0x prefixed)
 */
export function cidToBytes32(cid: string): string {
  const parsed = CID.parse(cid);

  // Get the multihash digest (32 bytes for sha256)
  const digest = parsed.multihash.digest;

  if (digest.length !== 32) {
    throw new Error(`Expected 32-byte digest, got ${digest.length} bytes`);
  }

  return hexlify(digest);
}

/**
 * Convert bytes32 back to IPFS CID
 * Reconstructs a CIDv1 with raw codec and sha256 hash
 * @param hash - bytes32 hex string (0x prefixed)
 * @returns IPFS CID string
 */
export async function bytes32ToCid(hash: string): Promise<string> {
  const bytes = getBytes(hash);

  if (bytes.length !== 32) {
    throw new Error(`Expected 32 bytes, got ${bytes.length}`);
  }

  // Create a multihash from the digest
  const multihash = {
    code: sha256.code,
    size: 32,
    digest: bytes,
    bytes: new Uint8Array([sha256.code, 32, ...bytes]),
  };

  // Create CIDv1 with raw codec
  const cid = CID.create(1, raw.code, multihash as any);
  return cid.toString();
}

/**
 * Convert bytes32 to CID (synchronous version using pre-computed structure)
 * @param hash - bytes32 hex string (0x prefixed)
 * @returns IPFS CID string
 */
export function bytes32ToCidSync(hash: string): string {
  const bytes = getBytes(hash);

  if (bytes.length !== 32) {
    throw new Error(`Expected 32 bytes, got ${bytes.length}`);
  }

  // sha256 multihash: 0x12 (sha256 code) + 0x20 (32 bytes length) + digest
  const multihashBytes = new Uint8Array(34);
  multihashBytes[0] = 0x12; // sha256
  multihashBytes[1] = 0x20; // 32 bytes
  multihashBytes.set(bytes, 2);

  // Create CIDv1 with raw codec (0x55)
  const cid = CID.decode(new Uint8Array([
    0x01, // CIDv1
    0x55, // raw codec
    ...multihashBytes
  ]));

  return cid.toString();
}

/**
 * Validate an Ethereum address
 * @param address - Address to validate
 * @returns true if valid
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate a bytes32 hash
 * @param hash - Hash to validate
 * @returns true if valid
 */
export function isValidBytes32(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Convert a string to bytes32 (pad or truncate as needed)
 * @param str - String to convert
 * @returns bytes32 hex string
 */
export function stringToBytes32(str: string): string {
  const hash = keccak256(toUtf8Bytes(str));
  return hash;
}

/**
 * Format a bigint as a human-readable token amount
 * @param amount - Amount in wei
 * @param decimals - Token decimals (default 18)
 * @returns Formatted string
 */
export function formatTokenAmount(amount: bigint, decimals: number = 18): string {
  const divisor = 10n ** BigInt(decimals);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === 0n) {
    return integerPart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${integerPart}.${fractionalStr}`;
}

/**
 * Parse a token amount string to bigint
 * @param amount - Amount string (e.g., "1.5")
 * @param decimals - Token decimals (default 18)
 * @returns Amount in wei
 */
export function parseTokenAmount(amount: string, decimals: number = 18): bigint {
  const [integerPart, fractionalPart = ''] = amount.split('.');
  const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(integerPart + paddedFractional);
}

import { Connection, PublicKey } from '@solana/web3.js';
import { NextResponse } from 'next/server';

// Cache interface
interface CacheEntry {
    data: SolanaAnalysisResponse;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

// In-memory cache
const analysisCache = new Map<string, CacheEntry>();

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_CACHE_SIZE = 1000; // Maximum number of cached entries

// Fallback RPCs
const FALLBACK_RPCS = [
    'https://rpc.ankr.com/solana',
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com'
];

interface RelatedAccount {
    address: string;
    totalSolVolume: string; // Total volume (SOL + tokens converted to SOL equivalent)
}

interface SolanaAnalysisResponse {
    address: string;
    isValid: boolean;
    relatedAccounts: RelatedAccount[];
    error?: string;
}

interface CacheStatsResponse {
    totalEntries: number;
    maxSize: number;
    ttlMinutes: number;
    entries: Array<{
        address: string;
        ageMinutes: number;
        expiresInMinutes: number;
    }>;
}

function isValidSolanaAddress(address: string): boolean {
    try {
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
}

// Common token mint addresses and their approximate SOL conversion rates
const TOKEN_TO_SOL_RATES: { [mint: string]: number } = {
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 0.004, // USDC (1 USDC ≈ 0.004 SOL)
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 0.004, // USDT 
    'So11111111111111111111111111111111111111112': 1.0,   // Wrapped SOL
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 1.0,   // mSOL (≈ 1 SOL)
    'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': 1.0,   // bSOL
    'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': 0.0035, // JUP token
    '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 0.15, // ETH (1 ETH ≈ 0.15 SOL, updated)
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 0.00000006, // BONK (updated)
    'WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk': 0.000001, // WEN
    'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux': 0.000003, // HNT
    'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5': 0.0001, // MEW
    'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac': 0.0001, // MNGO
    'SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y': 0.000002, // SHDW
    'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM': 0.000001, // USDCet
};

function formatSolAmount(solValue: number): string {
    if (solValue === 0) return '0 SOL';
    if (solValue < 0.001) return solValue.toFixed(6) + ' SOL';
    if (solValue < 1) return solValue.toFixed(3) + ' SOL';
    if (solValue < 1000) return solValue.toFixed(2) + ' SOL';
    return solValue.toFixed(0) + ' SOL';
}

function getTokenValueInSol(mint: string, tokenAmount: number, decimals: number): number {
    const actualAmount = tokenAmount / Math.pow(10, decimals);
    const solRate = TOKEN_TO_SOL_RATES[mint] || 0; // Default to 0 for unknown tokens
    return actualAmount * solRate;
}

// Cache utility functions
function getCacheKey(address: string): string {
    return `analysis:${address}`;
}

function getCachedAnalysis(address: string): SolanaAnalysisResponse | null {
    const key = getCacheKey(address);
    const entry = analysisCache.get(key);
    
    if (!entry) return null;
    
    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;
    
    if (isExpired) {
        analysisCache.delete(key);
        return null;
    }
    
    console.log(`Cache hit for address: ${address}`);
    return entry.data;
}

function setCachedAnalysis(address: string, data: SolanaAnalysisResponse): void {
    const key = getCacheKey(address);
    const now = Date.now();
    
    // Clean up expired entries and manage cache size
    cleanupCache();
    
    analysisCache.set(key, {
        data,
        timestamp: now,
        ttl: CACHE_TTL
    });
    
    console.log(`Cached analysis for address: ${address}`);
}

function cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    // Remove expired entries
    for (const [key, entry] of analysisCache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
            keysToDelete.push(key);
        }
    }
    
    keysToDelete.forEach(key => analysisCache.delete(key));
    
    // If cache is still too large, remove oldest entries
    if (analysisCache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(analysisCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp); // Sort by timestamp (oldest first)
        
        const entriesToRemove = entries.slice(0, analysisCache.size - MAX_CACHE_SIZE);
        entriesToRemove.forEach(([key]) => analysisCache.delete(key));
        
        console.log(`Cleaned up ${entriesToRemove.length} old cache entries`);
    }
    
    if (keysToDelete.length > 0) {
        console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
    }
}

async function analyzeAddress(address: string): Promise<SolanaAnalysisResponse> {
    if (!isValidSolanaAddress(address)) {
        return {
            address,
            isValid: false,
            relatedAccounts: [],
            error: 'Invalid Solana address format'
        };
    }

    // Check cache first
    const cachedResult = getCachedAnalysis(address);
    if (cachedResult) {
        return cachedResult;
    }

    console.log(`Cache miss - analyzing address: ${address}`);

    let connection: Connection;
    const rpcUrl = process.env.HELIUS_RPC_URL || FALLBACK_RPCS[0];

    try {
        connection = new Connection(rpcUrl, 'confirmed');
        const publicKey = new PublicKey(address);

        // Get transaction signatures (limited for rate limits)
        const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 50 });

        if (signatures.length === 0) {
            return {
                address,
                isValid: true,
                relatedAccounts: []
            };
        }

        // Track total volume (SOL + tokens converted to SOL) per account AND account interactions
        const accountVolumes = new Map<string, number>(); // Will store SOL-equivalent values
        const accountInteractions = new Map<string, number>();

        // Use conservative settings for Helius to avoid 429 errors
        const isHelius = rpcUrl.includes('helius');
        const batchSize = isHelius ? 3 : 5; // Much smaller batches for Helius
        const maxTransactions = Math.min(signatures.length, isHelius ? 15 : 25);

        for (let i = 0; i < maxTransactions; i += batchSize) {
            const batch = signatures.slice(i, i + batchSize);
            const txSignatures = batch.map(sig => sig.signature);

            try {
                // Add delay before each batch to respect rate limits
                if (i > 0) {
                    const delayMs = isHelius ? 2000 : 1000; // 2s for Helius, 1s for others
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }

                let transactions;
                
                if (isHelius) {
                    // For Helius free plan, make individual requests (no batch support)
                    transactions = [];
                    for (const txSig of txSignatures) {
                        try {
                            const tx = await connection.getParsedTransaction(txSig, {
                                maxSupportedTransactionVersion: 0,
                                commitment: 'confirmed'
                            });
                            transactions.push(tx);
                            // Small delay between individual requests
                            await new Promise(resolve => setTimeout(resolve, 300));
                        } catch (txError) {
                            console.warn(`Failed to fetch individual transaction ${txSig}:`, txError);
                            transactions.push(null);
                        }
                    }
                } else {
                    // For other RPCs, use batch requests
                    transactions = await connection.getParsedTransactions(txSignatures, {
                        maxSupportedTransactionVersion: 0,
                        commitment: 'confirmed'
                    });
                }

                for (const tx of transactions) {
                    if (!tx || !tx.meta) continue;

                    const accountKeys = tx.transaction?.message?.accountKeys;
                    if (!accountKeys) continue;

                    // Track ALL accounts that appear in this transaction
                    for (let k = 0; k < accountKeys.length; k++) {
                        const accountAddress = accountKeys[k].pubkey.toString();

                        // Skip system accounts and the queried address itself
                        if (accountAddress === address ||
                            accountAddress === '11111111111111111111111111111111' ||
                            accountAddress === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' ||
                            accountAddress === 'ComputeBudget111111111111111111111111111111' ||
                            accountAddress === 'SysvarRent111111111111111111111111111111111' ||
                            accountAddress === 'SysvarClock111111111111111111111111111111111') {
                            continue;
                        }

                        // Count interactions
                        const currentInteractions = accountInteractions.get(accountAddress) || 0;
                        accountInteractions.set(accountAddress, currentInteractions + 1);

                        // Track SOL volume if there are balance changes
                        if (tx.meta.preBalances && tx.meta.postBalances && k < tx.meta.preBalances.length && k < tx.meta.postBalances.length) {
                            const preBalance = tx.meta.preBalances[k] || 0;
                            const postBalance = tx.meta.postBalances[k] || 0;
                            const balanceChange = Math.abs(postBalance - preBalance);

                            if (balanceChange > 0) {
                                const currentVolume = accountVolumes.get(accountAddress) || 0;
                                const solValue = balanceChange / 1e9; // Convert lamports to SOL
                                accountVolumes.set(accountAddress, currentVolume + solValue);
                            }
                        }
                    }

                    // Track token balance changes and convert to SOL value
                    if (tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
                        // Create maps for easier lookup
                        const preTokenMap = new Map();
                        const postTokenMap = new Map();
                        
                        tx.meta.preTokenBalances.forEach(balance => {
                            if (balance.owner && balance.mint) {
                                preTokenMap.set(`${balance.owner}-${balance.mint}`, balance);
                            }
                        });
                        
                        tx.meta.postTokenBalances.forEach(balance => {
                            if (balance.owner && balance.mint) {
                                postTokenMap.set(`${balance.owner}-${balance.mint}`, balance);
                            }
                        });

                        // Check for token balance changes
                        const allTokenKeys = new Set([...preTokenMap.keys(), ...postTokenMap.keys()]);
                        
                        for (const tokenKey of allTokenKeys) {
                            const [owner, mint] = tokenKey.split('-');
                            
                            if (owner === address) continue; // Skip the queried address
                            
                            const preBalance = preTokenMap.get(tokenKey);
                            const postBalance = postTokenMap.get(tokenKey);
                            
                            const preAmount = preBalance?.uiTokenAmount?.amount || '0';
                            const postAmount = postBalance?.uiTokenAmount?.amount || '0';
                            const decimals = preBalance?.uiTokenAmount?.decimals || postBalance?.uiTokenAmount?.decimals || 6;
                            
                            const preNum = parseFloat(preAmount);
                            const postNum = parseFloat(postAmount);
                            const tokenChange = Math.abs(postNum - preNum);
                            
                            if (tokenChange > 0) {
                                // Count interactions
                                const currentInteractions = accountInteractions.get(owner) || 0;
                                accountInteractions.set(owner, currentInteractions + 1);
                                
                                // Convert token value to SOL and add to volume
                                const tokenValueInSol = getTokenValueInSol(mint, tokenChange, decimals);
                                if (tokenValueInSol > 0) {
                                    const currentVolume = accountVolumes.get(owner) || 0;
                                    accountVolumes.set(owner, currentVolume + tokenValueInSol);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn(`Error processing batch ${i}:`, error);
                
                // Handle rate limiting with exponential backoff
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
                    const backoffMs = isHelius ? 5000 : 3000; // 5s for Helius, 3s for others
                    console.log(`Rate limited, waiting ${backoffMs}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
                continue;
            }
        }

        // Combine all unique accounts from both interactions and volumes
        const allAccounts = new Set([
            ...accountInteractions.keys(),
            ...accountVolumes.keys()
        ]);

        // Convert to sorted array - return ALL related accounts
        const relatedAccounts: RelatedAccount[] = Array.from(allAccounts)
            .map(accountAddress => {
                const volumeInSol = accountVolumes.get(accountAddress) || 0; // Already in SOL equivalent
                const interactions = accountInteractions.get(accountAddress) || 0;
                return {
                    address: accountAddress,
                    totalSolVolume: formatSolAmount(volumeInSol),
                    volumeValue: volumeInSol, // For sorting
                    interactions: interactions // For sorting
                };
            })
            .sort((a, b) => {
                // Sort by total volume (SOL + token equivalent) first, then by interaction count
                if (b.volumeValue !== a.volumeValue) {
                    return b.volumeValue - a.volumeValue;
                }
                return b.interactions - a.interactions;
            })
            .map(({ address, totalSolVolume }) => ({
                address,
                totalSolVolume
            }));

        const result = {
            address,
            isValid: true,
            relatedAccounts
        };

        // Cache the successful result
        setCachedAnalysis(address, result);
        
        return result;

    } catch (error) {
        console.error('Error analyzing Solana address:', error);
        const errorResult = {
            address,
            isValid: true,
            relatedAccounts: [],
            error: `Failed to analyze address: ${error instanceof Error ? error.message : 'Unknown error'}`
        };

        // Cache error results for a shorter time to avoid repeated failures
        // but don't cache for too long in case it was a temporary issue
        const shortCacheTime = 60 * 1000; // 1 minute
        const key = getCacheKey(address);
        analysisCache.set(key, {
            data: errorResult,
            timestamp: Date.now(),
            ttl: shortCacheTime
        });

        return errorResult;
    }
}

export async function GET(request: Request): Promise<NextResponse<SolanaAnalysisResponse | CacheStatsResponse>> {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');
        const cacheInfo = searchParams.get('cache');

        // Special endpoint to get cache statistics
        if (cacheInfo === 'stats') {
            const now = Date.now();
            const cacheStats = {
                totalEntries: analysisCache.size,
                maxSize: MAX_CACHE_SIZE,
                ttlMinutes: CACHE_TTL / (60 * 1000),
                entries: Array.from(analysisCache.entries()).map(([key, entry]) => ({
                    address: key.replace('analysis:', ''),
                    ageMinutes: Math.round((now - entry.timestamp) / (60 * 1000)),
                    expiresInMinutes: Math.round((entry.ttl - (now - entry.timestamp)) / (60 * 1000))
                }))
            };
            return NextResponse.json(cacheStats);
        }

        if (!address) {
            return NextResponse.json({
                address: '',
                isValid: false,
                relatedAccounts: [],
                error: 'Address parameter is required'
            }, { status: 400 });
        }

        const startTime = Date.now();
        const result = await analyzeAddress(address);
        const analysisTime = Date.now() - startTime;
        
        console.log(`Analysis completed in ${analysisTime}ms for address: ${address}`);
        
        return NextResponse.json(result);

    } catch (error) {
        console.error('Error in Solana address analysis endpoint:', error);
        return NextResponse.json({
            address: '',
            isValid: false,
            relatedAccounts: [],
            error: 'Internal server error'
        }, { status: 500 });
    }
} 
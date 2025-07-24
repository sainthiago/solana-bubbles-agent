import { Connection, PublicKey } from '@solana/web3.js';
import { NextResponse } from 'next/server';


// Fallback RPCs if Helius is not configured
const FALLBACK_RPCS = [
    'https://rpc.ankr.com/solana',
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com'
];

interface RelatedAccount {
    address: string;
    transactionCount: number;
    lastInteraction: string;
    transactionTypes: string[];
    totalSolFlowLamports?: number; // Keep raw lamports for sorting
    totalSolFlow?: string; // Formatted SOL amount
    totalTokenInteractions?: number; // Track token interactions
}

interface SolanaAnalysisResponse {
    address: string;
    isValid: boolean;
    totalTransactions?: number;
    sampledTransactions?: number;
    relatedAccounts?: RelatedAccount[];
    error?: string;
    debug?: any;
}

function isValidSolanaAddress(address: string): boolean {
    try {
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
}

// Add delay function for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to format lamports to readable SOL
function formatSolAmount(lamports: number): string {
  const sol = lamports / 1e9;
  
  if (sol === 0) return '0 SOL';
  if (sol < 0.000001) return '<0.000001 SOL'; // Very small amounts
  if (sol < 0.001) return sol.toFixed(6) + ' SOL'; // Show 6 decimals for small amounts
  if (sol < 1) return sol.toFixed(3) + ' SOL'; // Show 3 decimals for amounts < 1 SOL
  if (sol < 1000) return sol.toFixed(2) + ' SOL'; // Show 2 decimals for normal amounts
  
  return sol.toFixed(0) + ' SOL'; // Whole numbers for large amounts
}

async function analyzeAddress(address: string): Promise<SolanaAnalysisResponse> {
    if (!isValidSolanaAddress(address)) {
        return {
            address,
            isValid: false,
            error: 'Invalid Solana address format'
        };
    }

    let connection: Connection;
    let rpcUrl: string;

    // Determine which RPC to use
    if (process.env.HELIUS_RPC_URL) {
        rpcUrl = process.env.HELIUS_RPC_URL;
        console.log('Using configured Helius RPC');
    } else {
        rpcUrl = FALLBACK_RPCS[0]; // Use Ankr
        console.log('Using Ankr fallback RPC');
    }

    try {
        console.log('Connecting to RPC:', rpcUrl);
        connection = new Connection(rpcUrl, 'confirmed');
        const publicKey = new PublicKey(address);

        // Test the connection first
        try {
            await connection.getBalance(publicKey);
            console.log('RPC connection successful');
        } catch (connectionError) {
            console.error('RPC connection failed, trying next fallback:', connectionError);
            // Try the next fallback RPC
            rpcUrl = FALLBACK_RPCS[1]; // Standard Solana RPC
            console.log('Switching to standard Solana RPC:', rpcUrl);
            connection = new Connection(rpcUrl, 'confirmed');
        }

        // Get recent transaction signatures
        const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 50 });
        
        // Get the actual total number of transactions (this might be more than our sample)
        let actualTotalTransactions = signatures.length;
        
        // If we hit our limit, try to get a rough estimate of total transactions
        if (signatures.length === 50) {
          try {
            // Get more signatures to estimate total (up to 1000)
            const allSignatures = await connection.getSignaturesForAddress(publicKey, { limit: 1000 });
            actualTotalTransactions = allSignatures.length;
            if (allSignatures.length === 1000) {
              actualTotalTransactions = 1000; // Cap at 1000+ indicator
            }
          } catch (error) {
            console.warn('Could not get full transaction count:', error);
            actualTotalTransactions = signatures.length; // Fall back to sample size
          }
        }
        
        if (signatures.length === 0) {
            return {
                address,
                isValid: true,
                totalTransactions: actualTotalTransactions,
                sampledTransactions: 0,
                relatedAccounts: []
            };
        }

        // Analyze transactions to find related accounts
        const relatedAccountsMap = new Map<string, RelatedAccount>();
        const debugInfo: any = {
            processedTxs: 0,
            totalAccounts: 0,
            filteredAccounts: 0,
            errors: [],
            balanceChanges: 0,
            tokenChanges: 0,
            rpcUsed: rpcUrl
        };

        // Process transactions in batches (use very conservative settings even for Helius due to rate limits)
        const isHelius = rpcUrl.includes('helius');
        const batchSize = 1; // Use single transactions for all RPCs to avoid rate limits
        const processedTransactions = Math.min(signatures.length, isHelius ? 15 : 8); // Fewer transactions
        
        console.log(`Processing ${processedTransactions} transactions with batch size ${batchSize} (Helius: ${isHelius})`);
        
        for (let i = 0; i < processedTransactions; i += batchSize) {
          const batch = signatures.slice(i, i + batchSize);
          const txSignatures = batch.map(sig => sig.signature);
          
          try {
            // Use longer delays for all RPCs to respect rate limits
            if (i > 0) {
              const delayTime = isHelius ? 1500 : 3000; // 1.5s for Helius, 3s for others
              console.log(`Waiting ${delayTime}ms before next batch...`);
              await delay(delayTime);
            }

            // For Helius free plans, make individual requests instead of batch requests
            const transactions = [];
            
            if (isHelius && batchSize === 1) {
              // Individual requests for Helius free plan
              for (const txSig of txSignatures) {
                try {
                  const tx = await connection.getParsedTransaction(txSig, {
                    maxSupportedTransactionVersion: 0,
                    commitment: 'confirmed'
                  });
                  transactions.push(tx);
                  // Small delay between individual requests
                  await delay(200);
                } catch (txError) {
                  console.warn(`Failed to fetch individual transaction ${txSig}:`, txError);
                  transactions.push(null);
                }
              }
            } else {
              // Batch request for paid plans
              const batchResult = await connection.getParsedTransactions(txSignatures, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed'
              });
              transactions.push(...batchResult);
            }

            console.log(`Fetched batch ${i}: ${transactions.length} transactions`);

            for (let j = 0; j < transactions.length; j++) {
                const tx = transactions[j];
                const signature = batch[j];

                if (!tx || !tx.meta) {
                    console.log(`Skipping transaction ${j}: no transaction or meta data`);
                    continue;
                }

                debugInfo.processedTxs++;
                console.log(`Processing transaction ${debugInfo.processedTxs}: ${signature.signature}`);

                // Method 1: Analyze SOL balance changes (preBalances vs postBalances)
                if (tx.meta.preBalances && tx.meta.postBalances && tx.transaction?.message?.accountKeys) {
                    const accountKeys = tx.transaction.message.accountKeys;

                    for (let k = 0; k < accountKeys.length; k++) {
                        const accountKey = accountKeys[k];
                        const accountAddress = accountKey.pubkey.toString();

                        // Skip system accounts and the queried address itself
                        if (accountAddress === address ||
                            accountAddress === '11111111111111111111111111111111' ||
                            accountAddress === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' ||
                            accountAddress === 'ComputeBudget111111111111111111111111111111') {
                            debugInfo.filteredAccounts++;
                            continue;
                        }

                        const preBalance = tx.meta.preBalances[k] || 0;
                        const postBalance = tx.meta.postBalances[k] || 0;
                        const balanceChange = postBalance - preBalance;

                        // Only include accounts that had balance changes
                        if (balanceChange !== 0) {
                            debugInfo.balanceChanges++;
                            debugInfo.totalAccounts++;

                            if (!relatedAccountsMap.has(accountAddress)) {
                                relatedAccountsMap.set(accountAddress, {
                                    address: accountAddress,
                                    transactionCount: 0,
                                    lastInteraction: signature.blockTime ? new Date(signature.blockTime * 1000).toISOString() : 'Unknown',
                                    transactionTypes: [],
                                    totalSolFlowLamports: 0, // Initialize raw lamports
                                    totalSolFlow: '0 SOL', // Initialize formatted SOL
                                    totalTokenInteractions: 0
                                });
                            }

                                                          const relatedAccount = relatedAccountsMap.get(accountAddress)!;
                              relatedAccount.transactionCount++;
                              relatedAccount.totalSolFlowLamports = (relatedAccount.totalSolFlowLamports || 0) + Math.abs(balanceChange);
                              // Don't format here - we'll format the total accumulated amount later

                            // Update last interaction
                            if (signature.blockTime) {
                                const currentTime = new Date(signature.blockTime * 1000).toISOString();
                                if (currentTime > relatedAccount.lastInteraction || relatedAccount.lastInteraction === 'Unknown') {
                                    relatedAccount.lastInteraction = currentTime;
                                }
                            }

                            // Determine transaction type based on balance change
                            if (balanceChange > 0) {
                                if (!relatedAccount.transactionTypes.includes('SOL Inflow')) {
                                    relatedAccount.transactionTypes.push('SOL Inflow');
                                }
                            } else {
                                if (!relatedAccount.transactionTypes.includes('SOL Outflow')) {
                                    relatedAccount.transactionTypes.push('SOL Outflow');
                                }
                            }

                            console.log(`Found SOL balance change: ${accountAddress} (${balanceChange / 1e9} SOL)`);
                        }
                    }
                }

                // Method 2: Analyze token balance changes
                if (tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
                    const preTokenBalances = tx.meta.preTokenBalances;
                    const postTokenBalances = tx.meta.postTokenBalances;

                    // Create maps for easier lookup
                    const preTokenMap = new Map();
                    const postTokenMap = new Map();

                    preTokenBalances.forEach(balance => {
                        if (balance.owner && balance.mint) {
                            preTokenMap.set(`${balance.owner}-${balance.mint}`, balance);
                        }
                    });

                    postTokenBalances.forEach(balance => {
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

                        const preAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
                        const postAmount = postBalance?.uiTokenAmount?.uiAmount || 0;

                        if (preAmount !== postAmount) {
                            debugInfo.tokenChanges++;
                            debugInfo.totalAccounts++;

                            if (!relatedAccountsMap.has(owner)) {
                                relatedAccountsMap.set(owner, {
                                    address: owner,
                                    transactionCount: 0,
                                    lastInteraction: signature.blockTime ? new Date(signature.blockTime * 1000).toISOString() : 'Unknown',
                                    transactionTypes: [],
                                    totalSolFlowLamports: 0, // Initialize raw lamports
                                    totalSolFlow: '0 SOL', // Initialize formatted SOL
                                    totalTokenInteractions: 0
                                });
                            }

                            const relatedAccount = relatedAccountsMap.get(owner)!;
                            relatedAccount.transactionCount++;
                            relatedAccount.totalTokenInteractions = (relatedAccount.totalTokenInteractions || 0) + 1;

                            // Update last interaction
                            if (signature.blockTime) {
                                const currentTime = new Date(signature.blockTime * 1000).toISOString();
                                if (currentTime > relatedAccount.lastInteraction || relatedAccount.lastInteraction === 'Unknown') {
                                    relatedAccount.lastInteraction = currentTime;
                                }
                            }

                            if (!relatedAccount.transactionTypes.includes('Token Transfer')) {
                                relatedAccount.transactionTypes.push('Token Transfer');
                            }

                            console.log(`Found token balance change: ${owner} for mint ${mint}`);
                        }
                    }
                }
            }

        } catch (batchError) {
            console.error(`Error processing batch ${i}-${i + batchSize}:`, batchError);
            debugInfo.errors.push(`Batch ${i}: ${(batchError as Error).message || 'Unknown error'}`);
            await delay(rpcUrl.includes('helius') ? 1000 : 3000); // 3 second delay after error for free RPC
            continue;
        }
    }

    console.log(`Debug info:`, debugInfo);
    console.log(`Found ${relatedAccountsMap.size} related accounts`);

    // Convert map to array, sort first, then format SOL amounts and clean up
    const relatedAccounts = Array.from(relatedAccountsMap.values())
        .sort((a, b) => {
            // Sort by transaction count first, then by SOL flow
            if (b.transactionCount !== a.transactionCount) {
                return b.transactionCount - a.transactionCount;
            }
            // Sort by raw lamports for accurate numerical comparison
            return (b.totalSolFlowLamports || 0) - (a.totalSolFlowLamports || 0);
        })
        .slice(0, 25) // Limit to top 25
        .map(account => {
            const { totalSolFlowLamports, ...cleanAccount } = account;
            return {
                ...cleanAccount,
                totalSolFlow: formatSolAmount(totalSolFlowLamports || 0) // Format accumulated SOL flow
            };
        });

    debugInfo.finalAccountCount = relatedAccounts.length;

    return {
        address,
        isValid: true,
        totalTransactions: actualTotalTransactions,
        sampledTransactions: debugInfo.processedTxs,
        relatedAccounts,
        debug: debugInfo
    };

  } catch (error) {
    console.error('Error analyzing Solana address:', error);
    return {
        address,
        isValid: true,
        error: `Failed to analyze address: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export async function GET(request: Request): Promise<NextResponse<SolanaAnalysisResponse>> {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');

        if (!address) {
            return NextResponse.json({
                address: '',
                isValid: false,
                error: 'Address parameter is required'
            }, { status: 400 });
        }

        const result = await analyzeAddress(address);
        return NextResponse.json(result);

    } catch (error) {
        console.error('Error in Solana address analysis endpoint:', error);
        return NextResponse.json({
            address: '',
            isValid: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
} 
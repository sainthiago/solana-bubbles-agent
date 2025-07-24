import { ACCOUNT_ID } from "@/app/config";
import { NextResponse } from "next/server";

export async function GET() {
    const pluginData = {
        openapi: "3.0.0",
        info: {
            title: "Solana Address Analysis Agent",
            description: "API for analyzing Solana addresses and retrieving related accounts.",
            version: "1.0.0"
        },
        servers: [
            {
                url: "https://agent-next-boilerplate.vercel.app/"
            }
        ],
        "x-mb": {
            "account-id": ACCOUNT_ID,
            email: "youremail@gmail.com",
            assistant: {
                name: "Blockchain Assistant",
                description: "An assistant that analyzes Solana addresses and retrieves related accounts and transaction counts.",
                instructions: "Use the /api/tools/solana-address-analysis endpoint to analyze a Solana address and retrieve related accounts.",
                tools: [],
                image: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/bitte.svg`,
                repo: 'https://github.com/BitteProtocol/agent-next-boilerplate',
                categories: ["DeFi", "DAO", "Social"],
                chainIds: [1, 8453]
            }
        },
        paths: {
            "/api/tools/solana-address-analysis": {
                get: {
                    summary: "Analyze Solana address",
                    description: "Analyzes a Solana address to find related accounts, transaction counts, and transaction types ordered by interaction frequency.",
                    operationId: "analyzeSolanaAddress",
                    parameters: [
                        {
                            name: "address",
                            in: "query",
                            required: true,
                            schema: {
                                type: "string"
                            },
                            description: "The Solana address to analyze"
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Successful response",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            address: {
                                                type: "string",
                                                description: "The analyzed Solana address"
                                            },
                                            isValid: {
                                                type: "boolean",
                                                description: "Whether the address is valid"
                                            },
                                            totalTransactions: {
                                                type: "number",
                                                description: "Total number of transactions for this address"
                                            },
                                            sampledTransactions: {
                                                type: "number",
                                                description: "Number of transactions actually analyzed (subset of total)"
                                            },
                                            relatedAccounts: {
                                                type: "array",
                                                description: "List of related accounts ordered by transaction count",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        address: {
                                                            type: "string",
                                                            description: "The related account address"
                                                        },
                                                        transactionCount: {
                                                            type: "number",
                                                            description: "Number of transactions with this account"
                                                        },
                                                        lastInteraction: {
                                                            type: "string",
                                                            description: "ISO timestamp of last interaction"
                                                        },
                                                        transactionTypes: {
                                                            type: "array",
                                                            items: {
                                                                type: "string"
                                                            },
                                                            description: "Types of transactions (e.g., 'Asset Transfer', 'Complex Transaction')"
                                                        }
                                                    }
                                                }
                                            },
                                            error: {
                                                type: "string",
                                                description: "Error message if analysis failed"
                                            },
                                            debug: {
                                                type: "object",
                                                description: "Debug information (temporary)"
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "400": {
                            description: "Bad request",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            error: {
                                                type: "string",
                                                description: "Error message"
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "500": {
                            description: "Server error",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            error: {
                                                type: "string",
                                                description: "Error message"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    return NextResponse.json(pluginData);
}

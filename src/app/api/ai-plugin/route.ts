import { ACCOUNT_ID } from "@/app/config";
import { NextResponse } from "next/server";

export async function GET() {
    const pluginData = {
        openapi: "3.0.0",
        info: {
            title: "Solana Address Analysis Agent",
            description: "API for analyzing Solana addresses to find related accounts and their SOL transaction volumes.",
            version: "1.0.0"
        },
        servers: [
            {
                url: "https://solana-bubbles-agent.vercel.app/"
            }
        ],
        "x-mb": {
            "account-id": ACCOUNT_ID,
            email: "ruisantiagomr@gmail.com",
            assistant: {
                name: "Solana Bubbles Agent",
                description: "This agent analyzes Solana wallet addresses to find all related accounts and their SOL transaction volumes.",
                instructions: "When given a Solana wallet address, use the analysis tool to find all related accounts that have interacted with it and show their total SOL volume.",
                tools: [{ "type": "submit-query" }],
                image: "https://solana-bubbles-agent.vercel.app/bubble.svg",
                repo: "https://github.com/sainthiago/solana-bubbles-agent",
                categories: ["solana", "wallet", "tracker", "agent"],
                chainIds: [900]
            }
        },
        paths: {
            "/api/tools/solana-address-analysis": {
                get: {
                    summary: "Analyze Solana address",
                    description: "Analyzes a Solana address to find related accounts and their SOL volume.",
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
                            relatedAccounts: {
                                type: "array",
                                description: "List of related accounts ordered by SOL volume",
                                items: {
                                    type: "object",
                                    properties: {
                                        address: {
                                            type: "string",
                                            description: "The related account address"
                                        },
                                        totalSolVolume: {
                                            type: "string",
                                            description: "Total SOL volume with this account (formatted)"
                                        }
                                    }
                                }
                            },
                            error: {
                                type: "string",
                                description: "Error message if analysis failed"
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

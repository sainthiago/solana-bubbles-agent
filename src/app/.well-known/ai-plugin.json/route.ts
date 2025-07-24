import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const apiPluginUrl = `${protocol}://${host}/api/ai-plugin`;

    // Redirect to the actual AI plugin specification
    return NextResponse.redirect(apiPluginUrl);
}
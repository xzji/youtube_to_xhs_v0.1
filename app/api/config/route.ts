import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
    try {
        // In production, API key will be managed via environment variables
        const hasApiKey = !!process.env.OPENROUTER_API_KEY;
        return NextResponse.json({ hasApiKey });
    } catch (error) {
        return NextResponse.json({ hasApiKey: false }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { apiKey } = await req.json();

        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 400 });
        }

        // In Edge Runtime, we cannot write to filesystem
        // API keys should be configured via environment variables in Cloudflare Pages dashboard
        return NextResponse.json({
            success: false,
            error: 'API key configuration is not supported in production. Please set OPENROUTER_API_KEY in Cloudflare Pages environment variables.'
        }, { status: 400 });

    } catch (error: any) {
        console.error('Error handling API key:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

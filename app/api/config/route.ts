import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
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

        const envPath = path.join(process.cwd(), '.env.local');
        let envContent = '';

        // Read existing .env.local if it exists
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf-8');

            // Update existing OPENROUTER_API_KEY or add it
            if (envContent.includes('OPENROUTER_API_KEY=')) {
                envContent = envContent.replace(
                    /OPENROUTER_API_KEY=.*/,
                    `OPENROUTER_API_KEY=${apiKey}`
                );
            } else {
                envContent += `\nOPENROUTER_API_KEY=${apiKey}\n`;
            }
        } else {
            // Create new .env.local
            envContent = `# OpenRouter API Configuration\nOPENROUTER_API_KEY=${apiKey}\n\n# Site URL (for OpenRouter referrer)\nSITE_URL=http://localhost:3000\n`;
        }

        // Write to .env.local
        fs.writeFileSync(envPath, envContent, 'utf-8');

        // Update process.env for current runtime (requires restart for Next.js)
        process.env.OPENROUTER_API_KEY = apiKey;

        return NextResponse.json({
            success: true,
            message: 'API key saved. Please restart the development server for changes to take effect.'
        });
    } catch (error: any) {
        console.error('Error saving API key:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

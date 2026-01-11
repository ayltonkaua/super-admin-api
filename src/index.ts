/**
 * Super Admin API - Entry Point
 *
 * Hono server for super admin operations.
 * Works on both Node.js (local) and Vercel (serverless).
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { handle } from 'hono/vercel';

import { superAdminAuth } from './middleware/auth.js';
import { auth } from './routes/auth.js';
import { stats } from './routes/stats.js';
import { escolas } from './routes/escolas.js';

const app = new Hono().basePath('/api');

// Global middleware
app.use('*', logger());
app.use(
    '*',
    cors({
        origin: (origin) => {
            // Allow localhost for development
            if (origin?.includes('localhost')) return origin;
            // Allow Vercel preview deployments
            if (origin?.includes('vercel.app')) return origin;
            // Allow custom domain
            if (origin?.includes('chamadadiaria.com.br')) return origin;
            // Allow if no origin (like curl or server-to-server)
            if (!origin) return '*';
            return null;
        },
        allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
        exposeHeaders: ['Content-Length', 'X-Request-Id'],
        credentials: true,
        maxAge: 86400, // Cache preflight for 24 hours
    })
);

// Health check (no auth)
app.get('/health', (c) => c.json({ status: 'ok', service: 'super-admin-api' }));

// Public auth routes (no auth required)
app.route('/v1/auth', auth);

// Protected routes
const protectedApi = new Hono();
protectedApi.use('*', superAdminAuth);
protectedApi.route('/stats', stats);
protectedApi.route('/escolas', escolas);

// Mount protected API
app.route('/v1', protectedApi);

// Error handler
app.onError((err, c) => {
    console.error('Error:', err);
    return c.json(
        {
            success: false,
            error: err.message || 'Internal server error',
        },
        500
    );
});

// Export for Vercel
export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);

// Local development server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    import('@hono/node-server').then(({ serve }) => {
        const port = parseInt(process.env.PORT || '3001');
        console.log(`🚀 Super Admin API running on http://localhost:${port}`);
        serve({ fetch: app.fetch, port });
    });
}

export default app;


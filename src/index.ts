/**
 * Super Admin API - Entry Point
 *
 * Hono server for super admin operations.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { superAdminAuth } from './middleware/auth.js';
import { auth } from './routes/auth.js';
import { stats } from './routes/stats.js';
import { escolas } from './routes/escolas.js';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use(
    '*',
    cors({
        origin: ['http://localhost:5173', 'http://localhost:5174', 'https://*.vercel.app'],
        credentials: true,
    })
);

// Health check (no auth)
app.get('/health', (c) => c.json({ status: 'ok', service: 'super-admin-api' }));

// Public auth routes (no auth required)
app.route('/api/v1/auth', auth);

// Protected routes
const api = new Hono();
api.use('*', superAdminAuth);
api.route('/stats', stats);
api.route('/escolas', escolas);

// Mount API
app.route('/api/v1', api);

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

// Start server
const port = parseInt(process.env.PORT || '3001');

console.log(`🚀 Super Admin API running on http://localhost:${port}`);

serve({
    fetch: app.fetch,
    port,
});

export default app;

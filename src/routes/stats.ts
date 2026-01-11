/**
 * Stats Routes
 */

import { Hono } from 'hono';
import { getDashboardStats } from '../services/stats.service.js';

export const stats = new Hono();

/**
 * GET /stats - Dashboard statistics
 */
stats.get('/', async (c) => {
    const data = await getDashboardStats();
    return c.json({ success: true, data });
});

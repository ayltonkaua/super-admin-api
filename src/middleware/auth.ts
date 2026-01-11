/**
 * Super Admin Auth Middleware
 *
 * Verifies JWT and ensures user has super_admin role.
 */

import { Context, Next } from 'hono';
import { verifyJWT } from '../lib/jwt.js';
import { supabase } from '../lib/supabase.js';

interface AuthUser {
    userId: string;
    email?: string;
}

declare module 'hono' {
    interface ContextVariableMap {
        auth: AuthUser;
    }
}

export async function superAdminAuth(c: Context, next: Next) {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ success: false, error: 'Token não fornecido' }, 401);
    }

    const token = authHeader.slice(7);
    const jwtSecret = process.env.SUPABASE_JWT_SECRET!;
    const payload = verifyJWT(token, jwtSecret);

    if (!payload) {
        return c.json({ success: false, error: 'Token inválido ou expirado' }, 401);
    }

    // Check if user has super_admin role
    const { data: roleData, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', payload.sub)
        .eq('role', 'super_admin')
        .maybeSingle();

    if (error || !roleData) {
        return c.json({ success: false, error: 'Acesso negado - Requer permissão de super admin' }, 403);
    }

    // Set auth context
    c.set('auth', {
        userId: payload.sub,
        email: payload.email,
    });

    await next();
}

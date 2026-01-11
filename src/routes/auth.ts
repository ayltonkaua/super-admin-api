/**
 * Auth Routes - Login with email/password
 */

import { Hono } from 'hono';
import { supabase } from '../lib/supabase.js';

export const auth = new Hono();

interface LoginBody {
    email: string;
    password: string;
}

/**
 * POST /auth/login - Login with email and password
 */
auth.post('/login', async (c) => {
    const body = await c.req.json<LoginBody>();

    if (!body.email || !body.password) {
        return c.json({ success: false, error: 'Email e senha são obrigatórios' }, 400);
    }

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: body.email,
        password: body.password,
    });

    if (authError || !authData.user) {
        return c.json({ success: false, error: 'Credenciais inválidas' }, 401);
    }

    // 2. Check if user has super_admin role
    const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .eq('role', 'super_admin')
        .maybeSingle();

    if (roleError || !roleData) {
        // Sign out if not super_admin
        await supabase.auth.signOut();
        return c.json({ success: false, error: 'Acesso negado - Requer permissão de super admin' }, 403);
    }

    // 3. Return session token
    return c.json({
        success: true,
        data: {
            accessToken: authData.session?.access_token,
            refreshToken: authData.session?.refresh_token,
            expiresAt: authData.session?.expires_at,
            user: {
                id: authData.user.id,
                email: authData.user.email,
            },
        },
    });
});

/**
 * POST /auth/refresh - Refresh access token
 */
auth.post('/refresh', async (c) => {
    const body = await c.req.json<{ refreshToken: string }>();

    if (!body.refreshToken) {
        return c.json({ success: false, error: 'Refresh token é obrigatório' }, 400);
    }

    const { data, error } = await supabase.auth.refreshSession({
        refresh_token: body.refreshToken,
    });

    if (error || !data.session) {
        return c.json({ success: false, error: 'Token inválido ou expirado' }, 401);
    }

    return c.json({
        success: true,
        data: {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at,
        },
    });
});

/**
 * POST /auth/logout - Logout
 */
auth.post('/logout', async (c) => {
    await supabase.auth.signOut();
    return c.json({ success: true, message: 'Logout realizado' });
});

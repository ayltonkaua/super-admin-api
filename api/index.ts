/**
 * Vercel Serverless Function Entry Point
 * Super Admin API
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// No basePath - Vercel handles routing via rewrites
const app = new Hono();

// CORS
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
}));

// Health check - accessible at /api/health
app.get('/api/health', (c) => c.json({ status: 'ok', service: 'super-admin-api' }));

// Auth Login - accessible at /api/v1/auth/login
app.post('/api/v1/auth/login', async (c) => {
    try {
        const { email, password } = await c.req.json();

        if (!email || !password) {
            return c.json({ success: false, error: 'Email e senha são obrigatórios' }, 400);
        }

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError || !authData.user) {
            return c.json({ success: false, error: 'Credenciais inválidas' }, 401);
        }

        // Check super_admin role
        const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', authData.user.id)
            .eq('role', 'super_admin')
            .maybeSingle();

        if (!roleData) {
            await supabase.auth.signOut();
            return c.json({ success: false, error: 'Acesso negado - Apenas super admins' }, 403);
        }

        return c.json({
            success: true,
            data: {
                accessToken: authData.session?.access_token,
                refreshToken: authData.session?.refresh_token,
                user: { id: authData.user.id, email: authData.user.email },
            },
        });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

// Stats
app.get('/api/v1/stats', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return c.json({ success: false, error: 'Não autorizado' }, 401);
        }

        const [
            { count: totalEscolas },
            { count: escolasPendentes },
            { count: escolasAtivas },
            { count: escolasRejeitadas },
            { count: totalAlunos },
            { count: totalTurmas },
        ] = await Promise.all([
            supabase.from('escola_configuracao').select('*', { count: 'exact', head: true }),
            supabase.from('escola_configuracao').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
            supabase.from('escola_configuracao').select('*', { count: 'exact', head: true }).eq('status', 'aprovada'),
            supabase.from('escola_configuracao').select('*', { count: 'exact', head: true }).eq('status', 'rejeitada'),
            supabase.from('alunos').select('*', { count: 'exact', head: true }),
            supabase.from('turmas').select('*', { count: 'exact', head: true }),
        ]);

        return c.json({
            success: true,
            data: {
                totalEscolas: totalEscolas || 0,
                escolasPendentes: escolasPendentes || 0,
                escolasAtivas: escolasAtivas || 0,
                escolasRejeitadas: escolasRejeitadas || 0,
                totalAlunos: totalAlunos || 0,
                totalTurmas: totalTurmas || 0,
            },
        });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

// Get Escolas
app.get('/api/v1/escolas', async (c) => {
    try {
        const status = c.req.query('status');
        const search = c.req.query('search');

        let query = supabase.from('escola_configuracao').select('*');

        if (status) query = query.eq('status', status);
        if (search) query = query.ilike('nome', `%${search}%`);

        const { data, error, count } = await query.order('criado_em', { ascending: false });

        if (error) throw error;

        return c.json({
            success: true,
            data: data || [],
            pagination: { total: count || data?.length || 0 },
        });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

// Aprovar Escola
app.patch('/api/v1/escolas/:id/aprovar', async (c) => {
    try {
        const id = c.req.param('id');
        const { error } = await supabase
            .from('escola_configuracao')
            .update({ status: 'aprovada' })
            .eq('id', id);

        if (error) throw error;
        return c.json({ success: true, message: 'Escola aprovada' });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

// Rejeitar Escola
app.patch('/api/v1/escolas/:id/rejeitar', async (c) => {
    try {
        const id = c.req.param('id');
        const { error } = await supabase
            .from('escola_configuracao')
            .update({ status: 'rejeitada' })
            .eq('id', id);

        if (error) throw error;
        return c.json({ success: true, message: 'Escola rejeitada' });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

// Export handlers for Vercel
export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);

export default app;

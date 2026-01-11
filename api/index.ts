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

const app = new Hono();

// CORS
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
}));

// Auth middleware - validates JWT token
async function validateToken(authHeader: string | undefined): Promise<{ valid: boolean; userId?: string }> {
    if (!authHeader?.startsWith('Bearer ')) {
        return { valid: false };
    }

    const token = authHeader.substring(7);

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return { valid: false };
        }

        // Check super_admin role
        const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .eq('role', 'super_admin')
            .maybeSingle();

        if (!roleData) {
            return { valid: false };
        }

        return { valid: true, userId: user.id };
    } catch {
        return { valid: false };
    }
}

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', service: 'super-admin-api' }));

// Auth Login
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

// Stats - with error handling for each query
app.get('/api/v1/stats', async (c) => {
    try {
        const auth = await validateToken(c.req.header('Authorization'));
        if (!auth.valid) {
            return c.json({ success: false, error: 'Não autorizado' }, 401);
        }

        const today = new Date().toISOString().split('T')[0];

        // Execute queries individually to catch specific errors
        const { count: totalEscolas, error: e1 } = await supabase
            .from('escola_configuracao')
            .select('*', { count: 'exact', head: true });

        const { count: escolasPendentes, error: e2 } = await supabase
            .from('escola_configuracao')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pendente');

        const { count: escolasAtivas, error: e3 } = await supabase
            .from('escola_configuracao')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'aprovada');

        const { count: escolasRejeitadas, error: e4 } = await supabase
            .from('escola_configuracao')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'rejeitada');

        const { count: totalAlunos, error: e5 } = await supabase
            .from('alunos')
            .select('*', { count: 'exact', head: true });

        const { count: totalTurmas, error: e6 } = await supabase
            .from('turmas')
            .select('*', { count: 'exact', head: true });

        const { count: totalUsuarios, error: e7 } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true });

        const { count: chamadasHoje, error: e8 } = await supabase
            .from('presencas')
            .select('*', { count: 'exact', head: true })
            .eq('data_chamada', today);

        // Log errors for debugging (visible in Vercel logs)
        const errors: string[] = [];
        if (e1) errors.push(`escola_configuracao: ${e1.message}`);
        if (e2) errors.push(`escolas pendentes: ${e2.message}`);
        if (e3) errors.push(`escolas aprovadas: ${e3.message}`);
        if (e4) errors.push(`escolas rejeitadas: ${e4.message}`);
        if (e5) errors.push(`alunos: ${e5.message}`);
        if (e6) errors.push(`turmas: ${e6.message}`);
        if (e7) errors.push(`user_roles: ${e7.message}`);
        if (e8) errors.push(`presencas: ${e8.message}`);

        if (errors.length > 0) {
            console.error('Stats query errors:', errors);
        }

        return c.json({
            success: true,
            data: {
                totalEscolas: totalEscolas ?? 0,
                escolasPendentes: escolasPendentes ?? 0,
                escolasAtivas: escolasAtivas ?? 0,
                escolasRejeitadas: escolasRejeitadas ?? 0,
                totalAlunos: totalAlunos ?? 0,
                totalTurmas: totalTurmas ?? 0,
                totalUsuarios: totalUsuarios ?? 0,
                chamadasHoje: chamadasHoje ?? 0,
            },
            // Include debug info in development
            _debug: errors.length > 0 ? { errors } : undefined,
        });
    } catch (error: any) {
        console.error('Stats error:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// Get Escolas - with alunos/turmas count
app.get('/api/v1/escolas', async (c) => {
    try {
        const auth = await validateToken(c.req.header('Authorization'));
        if (!auth.valid) {
            return c.json({ success: false, error: 'Não autorizado' }, 401);
        }

        const status = c.req.query('status');
        const search = c.req.query('search');

        let query = supabase.from('escola_configuracao').select('*');

        if (status) query = query.eq('status', status);
        if (search) query = query.ilike('nome', `%${search}%`);

        const { data: escolas, error } = await query.order('criado_em', { ascending: false });

        if (error) throw error;

        // Get counts per school
        const escolasComContagem = await Promise.all(
            (escolas || []).map(async (escola) => {
                const [{ count: totalAlunos }, { count: totalTurmas }] = await Promise.all([
                    supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('escola_id', escola.id),
                    supabase.from('turmas').select('*', { count: 'exact', head: true }).eq('escola_id', escola.id),
                ]);
                return {
                    ...escola,
                    totalAlunos: totalAlunos || 0,
                    totalTurmas: totalTurmas || 0,
                };
            })
        );

        return c.json({
            success: true,
            data: escolasComContagem,
            pagination: { total: escolasComContagem.length },
        });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

// Aprovar Escola
app.patch('/api/v1/escolas/:id/aprovar', async (c) => {
    try {
        const auth = await validateToken(c.req.header('Authorization'));
        if (!auth.valid) {
            return c.json({ success: false, error: 'Não autorizado' }, 401);
        }

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
        const auth = await validateToken(c.req.header('Authorization'));
        if (!auth.valid) {
            return c.json({ success: false, error: 'Não autorizado' }, 401);
        }

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

// Deletar Escola
app.delete('/api/v1/escolas/:id', async (c) => {
    try {
        const auth = await validateToken(c.req.header('Authorization'));
        if (!auth.valid) {
            return c.json({ success: false, error: 'Não autorizado' }, 401);
        }

        const id = c.req.param('id');
        const { error } = await supabase
            .from('escola_configuracao')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return c.json({ success: true, message: 'Escola deletada' });
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

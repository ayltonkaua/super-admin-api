/**
 * Stats Service
 *
 * Provides dashboard statistics.
 */

import { supabase } from '../lib/supabase.js';

export interface DashboardStats {
    totalEscolas: number;
    escolasPendentes: number;
    escolasAtivas: number;
    escolasRejeitadas: number;
    totalAlunos: number;
    totalUsuarios: number;
    totalTurmas: number;
    chamadasHoje: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
    // Parallel queries for performance
    const [
        escolasRes,
        alunosRes,
        usuariosRes,
        turmasRes,
        chamadasRes,
    ] = await Promise.all([
        supabase.from('escola_configuracao').select('status', { count: 'exact' }),
        supabase.from('alunos').select('id', { count: 'exact', head: true }),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }),
        supabase.from('turmas').select('id', { count: 'exact', head: true }),
        supabase
            .from('presencas')
            .select('id', { count: 'exact', head: true })
            .eq('data_chamada', new Date().toISOString().split('T')[0]),
    ]);

    // Count escolas by status
    const escolas = escolasRes.data || [];
    const totalEscolas = escolas.length;
    const escolasPendentes = escolas.filter(e => e.status === 'pendente').length;
    const escolasAtivas = escolas.filter(e => e.status === 'aprovada').length;
    const escolasRejeitadas = escolas.filter(e => e.status === 'rejeitada').length;

    return {
        totalEscolas,
        escolasPendentes,
        escolasAtivas,
        escolasRejeitadas,
        totalAlunos: alunosRes.count || 0,
        totalUsuarios: usuariosRes.count || 0,
        totalTurmas: turmasRes.count || 0,
        chamadasHoje: chamadasRes.count || 0,
    };
}

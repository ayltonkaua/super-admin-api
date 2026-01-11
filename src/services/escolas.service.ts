/**
 * Escolas Service
 *
 * Manage school registrations.
 */

import { supabase } from '../lib/supabase.js';

export interface Escola {
    id: string;
    nome: string;
    email: string;
    telefone?: string;
    endereco?: string;
    status: 'pendente' | 'aprovada' | 'rejeitada';
    criado_em: string;
    totalAlunos?: number;
    totalTurmas?: number;
}

export interface EscolaFilter {
    status?: 'pendente' | 'aprovada' | 'rejeitada';
    search?: string;
    limit?: number;
    offset?: number;
}

export async function getEscolas(filter: EscolaFilter = {}): Promise<{ escolas: Escola[]; total: number }> {
    let query = supabase
        .from('escola_configuracao')
        .select('*', { count: 'exact' });

    if (filter.status) {
        query = query.eq('status', filter.status);
    }

    if (filter.search) {
        query = query.or(`nome.ilike.%${filter.search}%,email.ilike.%${filter.search}%`);
    }

    query = query.order('criado_em', { ascending: false });

    if (filter.limit) {
        query = query.limit(filter.limit);
    }

    if (filter.offset) {
        query = query.range(filter.offset, filter.offset + (filter.limit || 10) - 1);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    // Get counts for each escola
    const escolasWithCounts = await Promise.all(
        (data || []).map(async (escola) => {
            const [alunosRes, turmasRes] = await Promise.all([
                supabase.from('alunos').select('id', { count: 'exact', head: true }).eq('escola_id', escola.id),
                supabase.from('turmas').select('id', { count: 'exact', head: true }).eq('escola_id', escola.id),
            ]);

            return {
                ...escola,
                totalAlunos: alunosRes.count || 0,
                totalTurmas: turmasRes.count || 0,
            };
        })
    );

    return { escolas: escolasWithCounts, total: count || 0 };
}

export async function getEscolaById(id: string): Promise<Escola | null> {
    const { data, error } = await supabase
        .from('escola_configuracao')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) throw error;

    if (!data) return null;

    const [alunosRes, turmasRes] = await Promise.all([
        supabase.from('alunos').select('id', { count: 'exact', head: true }).eq('escola_id', id),
        supabase.from('turmas').select('id', { count: 'exact', head: true }).eq('escola_id', id),
    ]);

    return {
        ...data,
        totalAlunos: alunosRes.count || 0,
        totalTurmas: turmasRes.count || 0,
    };
}

export async function aprovarEscola(id: string): Promise<void> {
    const { error } = await supabase
        .from('escola_configuracao')
        .update({ status: 'aprovada', atualizado_em: new Date().toISOString() })
        .eq('id', id);

    if (error) throw error;
}

export async function rejeitarEscola(id: string): Promise<void> {
    const { error } = await supabase
        .from('escola_configuracao')
        .update({ status: 'rejeitada', atualizado_em: new Date().toISOString() })
        .eq('id', id);

    if (error) throw error;
}

export async function deleteEscola(id: string): Promise<void> {
    // First check if escola has any alunos or turmas
    const [alunosRes, turmasRes] = await Promise.all([
        supabase.from('alunos').select('id', { count: 'exact', head: true }).eq('escola_id', id),
        supabase.from('turmas').select('id', { count: 'exact', head: true }).eq('escola_id', id),
    ]);

    if ((alunosRes.count || 0) > 0 || (turmasRes.count || 0) > 0) {
        throw new Error('Não é possível deletar escola com alunos ou turmas. Remova-os primeiro.');
    }

    const { error } = await supabase
        .from('escola_configuracao')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

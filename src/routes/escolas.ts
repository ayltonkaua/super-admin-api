/**
 * Escolas Routes
 */

import { Hono } from 'hono';
import {
    getEscolas,
    getEscolaById,
    aprovarEscola,
    rejeitarEscola,
    deleteEscola,
} from '../services/escolas.service.js';

export const escolas = new Hono();

/**
 * GET /escolas - List schools
 */
escolas.get('/', async (c) => {
    const status = c.req.query('status') as 'pendente' | 'aprovada' | 'rejeitada' | undefined;
    const search = c.req.query('search');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    const { escolas: data, total } = await getEscolas({ status, search, limit, offset });

    return c.json({
        success: true,
        data,
        pagination: { total, limit, offset },
    });
});

/**
 * GET /escolas/:id - Get school details
 */
escolas.get('/:id', async (c) => {
    const id = c.req.param('id');
    const escola = await getEscolaById(id);

    if (!escola) {
        return c.json({ success: false, error: 'Escola não encontrada' }, 404);
    }

    return c.json({ success: true, data: escola });
});

/**
 * PATCH /escolas/:id/aprovar - Approve school
 */
escolas.patch('/:id/aprovar', async (c) => {
    const id = c.req.param('id');
    await aprovarEscola(id);
    return c.json({ success: true, message: 'Escola aprovada com sucesso' });
});

/**
 * PATCH /escolas/:id/rejeitar - Reject school
 */
escolas.patch('/:id/rejeitar', async (c) => {
    const id = c.req.param('id');
    await rejeitarEscola(id);
    return c.json({ success: true, message: 'Escola rejeitada' });
});

/**
 * DELETE /escolas/:id - Delete school
 */
escolas.delete('/:id', async (c) => {
    const id = c.req.param('id');

    try {
        await deleteEscola(id);
        return c.json({ success: true, message: 'Escola removida com sucesso' });
    } catch (error) {
        if (error instanceof Error) {
            return c.json({ success: false, error: error.message }, 400);
        }
        throw error;
    }
});

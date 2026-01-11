# 🛡️ Super Admin API

API para o painel de controle do Super Admin.

## Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/v1/stats` | Dashboard stats |
| `GET` | `/api/v1/escolas` | Listar escolas |
| `GET` | `/api/v1/escolas/:id` | Detalhes escola |
| `PATCH` | `/api/v1/escolas/:id/aprovar` | Aprovar |
| `PATCH` | `/api/v1/escolas/:id/rejeitar` | Rejeitar |
| `DELETE` | `/api/v1/escolas/:id` | Remover |

## Instalação

```bash
npm install
cp .env.example .env
# Editar variáveis
npm run dev
```

## Deploy no Render

- Build: `npm install && npm run build`
- Start: `npm start`
- Port: 3001

## Autenticação

Requer JWT de usuário com role `super_admin`:

```
Authorization: Bearer <token>
```

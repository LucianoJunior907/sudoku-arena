# Sudoku Arena — Documento A: Resumo Executivo

> Data da auditoria: 28/10/2026 · Base: código-fonte + banco de produção verificado via Supabase Management API · Projeto: `github.com/LucianoJunior907/sudoku-arena` · Produção: `https://sudoku-arena-br.vercel.app`

---

## 1. O que é o Sudoku Arena

Um jogo de Sudoku competitivo web com foco no mercado brasileiro (pt-BR default, en secundário). O jogador treina sozinho, aprende técnicas, completa desafios diários, sobe de nível com XP, e compete em partidas ranqueadas 1v1 com rating estilo Elo e divisões (Bronze → Grandmaster). É um produto único-rota (SPA) — toda a navegação é client-side via Zustand.

## 2. Tecnologias (confirmadas no código)

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16.1.1 (App Router, `output: standalone`, `force-dynamic`) |
| Linguagem | TypeScript 5 (strict com `noImplicitAny: false`) |
| UI | React 19, Tailwind CSS 4, shadcn/ui (new-york), lucide-react |
| Animação | Framer Motion (transições de view), CSS keyframes próprios |
| Estado | Zustand 5 + localStorage (persistência offline-first) |
| Backend | Supabase (Postgres 17 + Auth + Realtime + PostgREST RPCs) — **não há backend Node separado**; 1 única API route real (`/api/submit-match`) |
| Deploy | Vercel (auto-deploy por push GitHub, `bun install`) |
| Banco | Supabase Postgres com RLS em 100% das 11 tabelas, 15 RPCs SECURITY DEFINER |
| Sons | WebAudio sintetizado (zero assets) |
| Gráficos | Recharts (radar de win-rate no Overview) |
| i18n | Sistema custom store-backed (390 chaves pt-BR / 389 en) |

## 3. Funcionalidades e modos

| Modo | Status | Resumo |
|------|--------|--------|
| **Solo** | ✅ Completo | 4 dificuldades, anotações, desfazer/refazer, dicas, pausar, timer, autosave/resume, teclado completo, XP, recordes, exportar imagem, códigos de compartilhamento, estimador de dificuldade, solver didático |
| **Guia** | ✅ Completo | 13 técnicas em 3 níveis com mini-tabuleiros ilustrados e prática jogável que rende XP (0.3×) |
| **Diário** | ✅ Completo* | Tabuleiro determinístico por data+dificuldade, streak com freezes, calendário 13 semanas, replay de dias passados. *Ver bug D-06 (streak corrompe ao replayar dia passado) |
| **Archive** | ✅ Completo | Puzzles semanais determinísticos |
| **Ranked 1v1** | ✅ Funcional c/ ressalvas | Fila com heartbeat, matchmaking atômico, mesmo tabuleiro por seed, primeiro-que-resolve-vence, 3 erros = derrota, Elo K=32 server-side, penalidade de abandono −50, resultado 3–5s, animação de promoção, interceptação de navegação |
| **Duo (2v2)** | ⚠️ Incompleto | Salas com código funcionam (realtime), mas **não há jogo**: botão "Iniciar partida" sem handler, sem tabuleiro compartilhado, sair não remove do banco |
| **Amigos** | ✅ Funcional | Busca por username, pedidos, aceitar/recusar, bloquear (não aplicado server-side) |
| **Leaderboard** | ✅ Funcional | Top 50 por rating, divisões, auto-refresh (focus + 30s) |
| **Perfil** | ✅ Completo | Cosméticos por nível, gráficos, avatar identicon |
| **Conquistas** | ✅ Completo | 15 conquistas com XP bônus |
| **Auth** | ✅ Funcional | Email+senha, username OU email, Google OAuth, reset de senha, visitante, conclusão Google, sessão validada contra servidor |

## 4. Navegação e UX

- Primeiro acesso: modal de idioma → login full-screen (com visitante) → lobby + tour guiado.
- Header sticky: menu mobile, logo, badge de nível/XP, idioma, som, tema, avatar/logout.
- Sidebar desktop + Sheet mobile com 14 itens em 4 grupos. `Alt+←/→` circula views.
- Durante partida ranked, navegação interna é interceptada com modal de abandono.
- Tema claro/escuro completo (oklch). Responsivo mobile-first.

## 5. Como o jogo funciona (visão de produto)

- **Progressão:** XP → nível (`100+50·n`) → cosméticos e freezes nos níveis 3/7/14.
- **Competição:** Elo (K=32, floor 0) por ranked; 7 divisões; animação de promoção full-screen.
- **Motivação diária:** streak com freezes + calendário GitHub-style.
- **Retenção:** 15 conquistas, recordes, histórico (cap 200), gráficos.

## 6. Estado de produção verificado (28/10/2026)

- **Vercel:** build passa, deploy automático por GitHub ativo.
- **Banco (via Management API):** 11 tabelas todas com RLS ✅; 15 RPCs SECURITY DEFINER instaladas ✅; 8 usuários; 8 profiles; 1 ranked_match; fila vazia; `match_solutions` vazia (nunca usada).
- **Dev server sandbox:** erro Turbopack pré-existente (não afeta a produção Vercel).

## 7. Principais problemas (detalhes no Documento D)

1. **CRÍTICO** — `get_email_by_username` exposto a `anon` vaza email de qualquer usuário.
2. **CRÍTICO** — Partidas ranked podem ser forjadas contra vítimas arbitrárias; validação da solução nunca compara com o puzzle real → roubo de Elo em escala.
3. **CRÍTICO** — RPC `update_user_rating` (sem caller no app) dá +100 rating por chamada a qualquer autenticado.
4. **CRÍTICO** — `submit_match_result` aceita `xp_earned` do cliente sem teto → XP infinito.
5. **ALTO** — Solução do ranked é computada no cliente a partir da seed pública.
6. **ALTO** — Race no matchmaking permite jogador em 2 partidas; UPDATE de `ranked_matches` sem restrição de coluna.
7. **ALTO** — `supabase-security.sql` fora do runner de migrations → rebuild do banco perde proteções.
8. **MÉDIO** — Duo sem gameplay; streak bug no replay diário; sem rate limiting; OAuth sem PKCE; senha forte só no frontend.

## 8. Prioridades para lançamento (detalhes no Documento E)

1. Bloquear os 4 vetores críticos — sem isso, não pode ir ao público.
2. Estabilizar Duo (ou esconder).
3. Corrigir bug do streak diário.
4. `supabase-security.sql` no runner.
5. PKCE + senha server-side.

## 9. Métricas do código

- `src/`: ~21.000 linhas (643 app + 5.388 lib + 15.322 components/hooks).
- 11 migrations SQL (1.912 ln) + runner automatizado (`bun run supabase:migrate`).
- ~17 dependências npm não utilizadas; código morto relevante.
- **Zero testes automatizados** de aplicação (lint é a única verificação; QA via agent-browser manual).

---
*Auditoria estática + banco verificado. Nenhum arquivo do projeto foi modificado.*

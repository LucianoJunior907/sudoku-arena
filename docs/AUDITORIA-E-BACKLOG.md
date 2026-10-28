# Sudoku Arena — Documento E: Backlog Recomendado

> Priorização para lançamento público. Cada item: benefício, dificuldade (1-5), riscos, dependências, critério de aceite objetivo.

## Fase 1 — Segurança e integridade (BLOQUEANTE)

| # | Item | Como | Benefício | Dif. | Riscos | Dep. | Critério de aceite |
|---|------|------|----------|------|--------|------|-------------------|
| 1.1 | Revogar `anon` de `get_email_by_username` + login-por-username server-side | `revoke` + nova RPC `login_by_username` que chama signIn internamente ou retorna apenas found:true | elimina vazamento PII (C-01) | 2 | quebrar login por username durante a troca | migrar frontend para nova RPC | `curl` anônimo para a RPC retorna 403; login por username funciona no app |
| 1.2 | Remover `update_user_rating` | `revoke all ... from authenticated` | elimina Elo self-service (C-03) | 1 | nenhum (sem caller) | — | `POST /rest/v1/rpc/update_user_rating` retorna 403 p/ authenticated |
| 1.3 | Teto de XP no `submit_match_result` | recalcular XP server-side (fórmula computeXp portada) e ignorar `p_xp_earned` | elimina XP infinito (C-04) | 3 | divergência de XP entre client e server | — | Submit com xp_earned=999999 resulta no XP calculado pelo server |
| 1.4 | Fechar INSERT direto em `ranked_matches` + validar solução contra o puzzle | remover policy INSERT; matchmake RPC grava solução em `match_solutions`; `finish_ranked_match` compara | mata forjação de partidas + vitória instantânea (C-02/D-01/D-02) | 4 | mudança no fluxo de finish | geração do puzzle server-side OU solução derivada no finish | Insert direto via PostgREST retorna 403; solução inválida retorna error |
| 1.5 | Adicionar `supabase-security.sql` ao runner + idempotizar policies | incluir na lista do run-migrations.sh; drop policy if exists em todos | DB rebuild não perde proteções (D-08) | 1 | ordem de execução | — | `bun run supabase:migrate` 2× seguidas sem erro; trigger presente após rebuild |
| 1.6 | PKCE no OAuth | `createClient(..., {auth: {flowType: 'pkce'}})` em client.ts | tokens fora do fragment (M-03) | 1 | URLs callback já aceitam | — | login Google completa e tokens não aparecem no hash |
| 1.7 | Checar active-match do CHAMADOR no try_matchmake_atomic + advisory lock | `if exists(select 1 from ranked_matches where status=active and (player1_id=v_user_id or player2_id=v_user_id)) then return` | jogador nunca fica em 2 partidas (D-07) | 2 | fila pode demorar mais em edge | — | Dois clientes simultâneos nunca produzem 2 matches para o mesmo user |

## Fase 2 — Correção de bugs

| # | Item | Benefício | Dif. | Critério |
|---|------|----------|------|----------|
| 2.1 | Streak: replay de dia passado não mexe no streak (D-06) | integridade do streak | 1 | Reproduzir replay ontem → streak intacto hoje |
| 2.2 | Duo: leave remove participant (DELETE RPC) (D-09) | assentos não travam | 1 | Sair da sala → participant sumir do banco |
| 2.3 | Duo: fetch username (D-04) + join atômico (count check na RPC) | nomes corretos; sem overbooking | 2 | 2 joins simultâneos → nunca 5 participantes |
| 2.4 | Ranked 3-erros = derrota distinta de abandono (D-08b) | justiça competitiva (sem −50) | 3 | Perder por 3 erros mostra "Derrota" e aplica Elo normal |
| 2.5 | Ranked: dificuldade selecionável | UX | 2 | Fila com easy/medium/hard/expert |
| 2.6 | Diário local-time (D-16) | streak correta p/ BR | 1 | Meia-noite local = novo dia |
| 2.7 | Solo: limite de erros encerra com modal (D-11) ou remove o banner | coerência | 1 | 5 erros → fim de jogo com tela |
| 2.8 | Limpar código morto (auth.ts, ui/*, deps npm) | manutenibilidade, bundle | 2 | build sem warnings de deps unused; grep limpo |

## Fase 3 — Estabilidade multiplayer

| # | Item | Benefício | Dif. | Critério |
|---|------|----------|------|----------|
| 3.1 | Duo: decidir escopo (implementar partida OU esconder modo) | expectativa do usuário | 3 | Duo ou jogável end-to-end ou ocultado da nav |
| 3.2 | Reconexão ranked (refresh volta pra partida ativa via check_my_ranked_match no boot) | partida sobrevive F5 | 2 | F5 durante match → volta ao board |
| 3.3 | Rate limiting mínimo (Edge middleware ou RPC counters) | anti-spam fila/RPCs (M-01) | 3 | 20 joins de fila em 10s → bloqueado |
| 3.4 | Cooldown de revanche (mesmo par <5min não conta Elo) | anti win-trading (L-09) | 2 | 2ª vitória em <5min não altera rating |

## Fase 4 — Ranking e progressão

| 4.1 | Substituir preview local de rating/XP por fetch do profile no boot (fonte única = server) | eliminar double-source (M-08) | 2 | localStorage não é mais fonte de rating |
|---|---|---|---|---|
| 4.2 | XP server-side também para solo/daily (usar submit_match_result como ÚNICO caminho, deletar saveMatchToCloud direto) | consistência | 3 | matches só entra via RPC |
| 4.3 | Divisão promotora no SERVER (retornar promoted no finish) | animação confiável | 1 | finish retorna flag promoted |

## Fase 5 — UX

| 5.1 | Tela de redefinir senha (link do email caía sem destino) | completar fluxo reset | 2 | Fluxo completo pedido→email→nova senha |
|---|---|---|---|---|
| 5.2 | Dicas/undo no ranked OU esconder botões | coerência | 1 | botões funcionam ou somem |
| 5.3 | Onboarding pós-login: se tour reaberto, não sobrepor resultado ranked | polish | 1 | sem sobreposição |
| 5.4 | PWA manifest + meta theme-color | mobile "app" feel | 1 | instalável no Android |

## Fase 6 — Desempenho e custos

| 6.1 | Debounce updateRankedProgress (agora: a CADA placement = ~50 RPCs/match) | menos chamadas RPC | 1 | ≤1 update a cada 2s durante partida |
|---|---|---|---|---|
| 6.2 | Índices FK que faltam (matches.user_id, ranked_matches.playerX, friends) | queries do leaderboard/histórico escalam | 1 | explain plans usam index scan |
| 6.3 | Realtime: garantir apenas colunas de progresso no payload | menor banda websocket | 2 | payload UPDATE ≤ 300 bytes |
| 6.4 | Remover ~17 deps npm não usadas + 34 componentes shadcn mortos | build/bundle menores | 1 | bun install mais rápido; bundle ↓ |

## Fase 7 — Arquitetura / ORM (avaliação, sem rewrite)

**Estado atual:** client pesa a lógica; servidor = PostgREST + 15 RPCs SECURITY DEFINER + 2 triggers. Um ORM (Prisma/Drizzle) só traria valor se houvesse um backend Node com sessions próprias — hoje o Supabase Auth já cobre sessões e as RPCs cobrem as escritas críticas.

**Recomendação:** NÃO migrar para ORM agora. Migrar lógica para o servidor significa:
1. Mover `computeXp` e validação de solução para PL/pgSQL/RPC (já começado — 4.2/1.4).
2. Manter no cliente apenas: input do jogador, render, optimistic UI.
3. Se um dia precisar de jobs (seasons resets, daily distribution), aí sim introduzir Next API routes com service_role (não ORM) para esses jobs.

**Se migrar (futuro):** começar por `matches` (single-writer via submit_match_result), depois `daily_records`, nunca tocar ranked (RPCs já são server-authoritative). Risco de quebrar multiplayer: baixo se ranking não for tocado. Custo: médio; benefício: marginal hoje.

## Fase 8 — Monetização/crescimento (pós-lançamento)

| 8.1 | Daily global com leaderboard do dia (server distributes seed) | viralização | 3 | mesmo board p/ todos verificado server-side |
|---|---|---|---|---|
| 8.2 | Cosméticos premium (avatares extras) | receita | 3 | checkout fake/sandbox |
| 8.3 | Analytics básico (posthog/self-host) | aprender retenção | 1 | evento de vitória/fila |
| 8.4 | Sentry ou logs de erro de produção | debug remoto | 1 | erros visíveis |

## Sequência recomendada

```
Semana 1: 1.1 → 1.2 → 1.5 → 1.6   (quick wins de segurança)
Semana 2: 1.3 → 1.4 → 1.7          (integridade ranked)
Semana 3: 2.1 → 2.4 → 3.2          (bugs que afetam jogadores reais)
Semana 4: 3.1 (decisão Duo) + 4.1 + 6.1
Depois:   Fases 5-8 conforme tração.
```

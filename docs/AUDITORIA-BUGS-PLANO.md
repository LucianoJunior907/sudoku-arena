# Sudoku Arena — Bugs, Backlog e Plano (Arquivo 2 de 2)

> **Consolidação em 2 arquivos** (28/10/2026 22:52 BRT). Este arquivo reúne, sem perda de conteúdo, os antigos Documentos **D (Bugs e Riscos)**, **E (Backlog Recomendado)** e **F (Handoff para outra IA)**.
> O **Arquivo 1** — `docs/AUDITORIA-TECNICA.md` — reúne **A (Resumo Executivo)**, **B (Documentação Técnica)** e **C (Inventário)**.
>
> ⚠️ **Novidades desta consolidação (verificação empírica do banco em 28/10/2026 22:52 BRT):**
> - **C-05 (CRÍTICO, novo):** `finish_ranked_match` não seta o GUC `app.skip_profile_protection` → o trigger `protect_profile` (instalado) reverte rating/XP/level de `profiles`. **Evidência:** única partida ranqueada gravou `player2_rating_after=16` e `xp_earned=80`, mas todos os 8 profiles seguem `rating=0, total_xp=0, level=1`. O ranked "parece" funcionar (RPC retorna valores e o cliente grava local), mas nada persiste.
> - **D-17 (ALTO, novo):** publication `supabase_realtime` contém APENAS `ranked_queue` + `ranked_matches` (confirmado via `pg_publication_tables`) → canais de salas duo e chat nunca recebem eventos.
> - **M-10 (MÉDIO, novo):** fórmulas de level divergentes entre RPCs (`submit_match_result` usa `1+floor(xp/150)`; `finish_ranked_match`/cliente usam `100+50·n`).
> - **L-11 (BAIXO, novo):** flag guest `sudoku-arena-guest` fora do namespace `sudoku-arena:` → `clearAllData`/`exportAll` não cobrem (limpar dados não desloga o visitante).

---

## Índice deste arquivo

- **PARTE I — Bugs e Riscos priorizados** (era Documento D) — inclui C-05/D-17/M-10/L-11 novos
- **PARTE II — Backlog Recomendado** (era Documento E) — inclui itens 1.8/3.5 novos
- **PARTE III — Handoff para Continuar o Desenvolvimento com outra IA** (era Documento F)

---

# PARTE I — BUGS E RISCOS

> Gravidade: CRÍTICA / ALTA / MÉDIA / BAIXA. Status: ✅ CONFIRMADO (evidência no código/SQL/banco) vs ⚠️ HIPÓTESE (precisa teste em runtime).
> **Nenhuma correção foi aplicada — somente levantamento.**

## CRÍTICOS (bloqueiam lançamento)

### C-05 — Rating/XP do ranked NÃO persiste em profiles (trigger × RPC) — CONFIRMADO EMPÍRICAMENTE ⭐ NOVO
- **Arquivos:** `supabase-ranked-xp-matches.sql` (RPC `finish_ranked_match` v2 — UPDATEs em `profiles` sem `set_config('app.skip_profile_protection', ...)`); `supabase-security.sql:62-80` (trigger `protect_profile_fields`: reverte `total_xp/level/rating/streak_freezes` quando o GUC ≠ 'true').
- **Evidência (banco de produção, 28/10/2026):** trigger `protect_profile` INSTALADO (information_schema.triggers); `pg_get_functiondef('finish_ranked_match')` NÃO contém o GUC; única partida ranqueada tem `player2_rating_after=16` e `matches.xp_earned=80` gravados, mas os 8 profiles seguem `rating=0, total_xp=0, level=1`.
- **Impacto:** TODO o progressão competitiva (rating, XP, level) do ranked é silenciosamente descartada. A UI mostra o rating por ~1 sessão (valor retornado pela RPC + colunas `rating_after` da partida), mas o leaderboard global exibe 0 para todos e o perfil reseta ao refresh. O produto-coração (ranked) não retém progressão real.
- **Solução proposta:** dentro de `finish_ranked_match`, antes dos UPDATEs em `profiles`: `perform set_config('app.skip_profile_protection', 'true', true);` (terceiro argumento **`true` = transação-scoped**) e restaurar `'false'` após (ou confiar no escopo de transação). Alternativa: trigger ignorar quando `current_setting('role')` indica RPC — mais frágil, não recomendado.
- **Sub-risco latente:** as RPCs do security.sql usam `set_config(..., 'false')` = **session-scoped**; se a RPC falhar entre o set 'true' e o restaurar 'false' (exception), a SESSÃO fica desprotegida para writes subsequentes. Migrar para `is_local => true` nelas também.
- **Riscos da correção:** baixos; SQL único + re-teste E2E de partida ranked no Vercel.

### C-01 — Vazamento de email de qualquer usuário (CONFIRMADO)
- **Arquivos:** `supabase-fix-username-permissions.sql:27-28`; `supabase-login-username.sql:12-15`; chamado em `auth.tsx:202`.
- **Evidência:** `grant execute on function public.get_email_by_username(text) to anon, authenticated` — SECURITY DEFINER lê `auth.users.email` sem checar auth. O comentário no próprio código admite o trade-off (auth.tsx:195-200).
- **Impacto:** enumeração de usernames (profiles SELECT é `using(true)`) + dump em massa de emails reais. Exposição PII/GDPR/LGPD.
- **Probabilidade:** 100% scriptável com a anon key pública.
- **Solução proposta:** revogar grant de `anon`; substituir login-por-username por RPC SECURITY DEFINER que autentica internamente (não retorna o email), OU bloquear a RPC por RLS de função.
- **Riscos da correção:** quebrar login por username até a nova RPC existir (esse fluxo já quebrou 2× no passado — testar no Vercel após).

### C-02 — Partidas ranked forjadas + vitória com grid qualquer (CONFIRMADO)
- **Arquivos:** `supabase-ranked-overhaul.sql:111-112` (INSERT `with check (auth.uid() = player1_id or player2_id)`), `:384-394` (validação), `:436-437` (update dos DOIS profiles); `validate_sudoku_solution` `:482-533`.
- **Evidência:** (a) qualquer autenticado insere `ranked_matches(player1=eu, player2=vítima, status=active)` sem consentimento — vítimas colhíveis do leaderboard público; (b) `finish_ranked_match` valida apenas que a grade 81 é um Sudoku consistente — **nunca compara com o puzzle derivado da seed**; `match_solutions` (RLS nega tudo) nunca é populada; (c) a RPC atualiza rating de ambos os players.
- **Impacto:** roubo de até +32 Elo por chamada contra QUALQUER uuid, ilimitado; vítima perde rating sem jogar. (Com C-05 ativo, o rating nem persiste — quando C-05 for corrigido, este vetor passa a valer de verdade.)
- **Solução:** INSERT de `ranked_matches` apenas via RPC (remover policy); validar solução contra o puzzle derivado da seed no servidor (guardar solução em `match_solutions` no matchmake via RPC server-side).
- **Riscos:** exige mover geração/validação de board para o servidor.

### C-03 — RPC auto-rating ±100 sem uso no app (CONFIRMADO)
- **Arquivos:** `supabase-security.sql:188-219` (instalada em produção — confirmada via pg_proc); nenhum caller em `src/`.
- **Evidência:** `update_user_rating(p_rating_change)` SECURITY DEFINER, granted `authenticated`, aplica ±100 ao próprio rating, seta o GUC de bypass do trigger.
- **Impacto:** `POST /rest/v1/rpc/update_user_rating {"p_rating_change":100}` em loop = rating infinito = #1 no leaderboard (quando C-05 for corrigido).
- **Solução:** `revoke all on function update_user_rating from authenticated;` (ou drop). Zero impacto no app (não há caller).

### C-04 — XP infinito via submit_match_result (CONFIRMADO)
- **Arquivos:** `supabase-security.sql:102-182` (p_xp_earned sem teto; p_final_board nunca usado); `api/submit-match/route.ts:87-99` repassa `xpEarned` do cliente.
- **Evidência:** o comentário do SQL admite (linhas 136-139). Únicos bounds: elapsed ≤3600s, errors ≤100.
- **Impacto:** XP/level/conquistas/cosméticos infinitos via 1 chamada repetida (afeta perfil/level, não o Elo).
- **Solução:** calcular XP no servidor a partir de (modo, dificuldade, tempo, erros) — fórmula `computeXp` portada pra PL/pgSQL; descartar `p_xp_earned`.

## ALTOS

### D-17 — Publication realtime NÃO cobre rooms/room_participants/chat_messages — CONFIRMADO NO BANCO ⭐ NOVO
- **Evidência (28/10/2026):** `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime'` retorna APENAS `ranked_queue` e `ranked_matches`. Os SQLs só adicionam as tabelas ranked (DO-block idempotente em `supabase-ranked-overhaul.sql`; `supabase-ranked.sql:46-47` usa `alter publication ... add table` cru, não idempotente).
- **Arquivo:** `matches.ts:560-588` (`subscribeToRoom`) e `matches.ts:450-479` (`subscribeToChat`) assinam canais que **nunca emitem eventos**.
- **Impacto:** Duo é "silencioso" — a lista de participantes não atualiza sozinha (só re-fetch manual: cada jogador só vê o estado quando ele mesmo age); chat (dormante) não funcionaria se ativado. O app dá a impressão de realtime sem ter.
- **Solução:** `alter publication supabase_realtime add table public.rooms, public.room_participants, public.chat_messages;` (idempotente via DO-block) + re-teste duo com 2 abas.

### D-01 — Solução do ranked no cliente (CONFIRMADO)
- `RankedView.tsx:293-297` (`setSolution(p.solution)` a partir da seed pública) + C-02 ⇒ vitória instantânea por script mesmo em partida legítima.
- Solução: não enviar `solution` ao cliente; guardar em `match_solutions` no momento do matchmake (RPC server-side).

### D-07 — Race do matchmaking: jogador em 2 partidas (CONFIRMADO no código)
- `supabase-ranked-overhaul.sql:179-206`: FOR UPDATE trava a linha do OPONENTE; A e B chamando simultaneamente criam DUAS partidas A×B. Também: o CHAMADOR nunca é checado por partida ativa (só o oponente).
- Solução: checar active-match do chamador dentro da RPC; advisory lock por usuário.

### D-03 — UPDATE de ranked_matches sem restrição de colunas (CONFIRMADO)
- Três policies permissivas (overhaul:115-117; audit-fixes:104-110) permitem a qualquer player PATCH `status/winner_id/finish_reason/rating_after` direto via PostgREST (RLS do Postgres é row-level; nomes de policy "own fields" NÃO restringem colunas).
- Impacto: forjar resultado no histórico/UX (o Elo real fica no profiles com trigger, mas a partida pode ser "travada" antes da hora).
- Solução: trigger de colunas permitidas, ou remover UPDATE e usar apenas RPCs.

### D-08 — supabase-security.sql fora do runner de migrations (CONFIRMADO)
- `.zscripts/run-migrations.sh:33-44` não inclui o arquivo que instala `protect_profile_fields`, `submit_match_result`, `update_user_rating` e que DROPA policies perigosas do schema base.
- Impacto: **rebuild do banco = perde toda a proteção** (schema.sql recria policies permissivas de matches UPDATE etc.).
- Solução: adicionar ao runner na ordem correta; tornar todos os `create policy` idempotentes.

### D-02 — match_solutions nunca usada (CONFIRMADO)
- Tabela existe com RLS negando tudo (security.sql:17-25) — planejada para guardar a solução — mas nenhuma RPC escreve/lê (verificado: 0 rows, sem referências em SQL/RPCs).
- É a infraestrutura correta para consertar C-02/D-01.

## MÉDIOS

### M-01 — Sem rate limiting (CONFIRMADO)
- Nenhum throttle em RPCs, fila (join/leave spam), writes. Queue churn scriptável.

### M-05 — room_participants exposto; join sem convite (CONFIRMADO)
- SELECT `using(true)` (schema:147) expõe membership de todas as salas; INSERT só checa `auth.uid()=user_id`; código de sala `Math.random` 6 chars (matches.ts:490); capacidade/status checados só no cliente.

### M-03 — Google OAuth fluxo implicit sem PKCE (CONFIRMADO)
- client.ts não seta flowType; default do SDK é implicit (tokens no fragment). `redirectTo` fixado em origin (sem open redirect).

### M-08 — Dupla gravação de partidas solo/daily (CONFIRMADO)
- `use-sudoku-game.ts:553-590` insere direto em `matches`/`daily_records` com xp/score do cliente, E existe a RPC `submit_match_result` (via /api/submit-match) — fontes duplicadas, resultado depende da ordem de migrations (policies podem ter sido recriadas pelo runner). `saveMatchToCloud` é fire-and-forget: se as policies INSERT foram dropadas pelo security.sql, grava falha **silenciosamente**.

### M-06 — Token admin no .env (contido) (CONFIRMADO)
- `SUPABASE_ACCESS_TOKEN` (Management API, admin) em `.env` — NÃO trackado (verificado `git rev-list --all -- .env` vazio; .gitignore:60). Risco residual: snapshot/commit acidental. **Recomendação: rotacionar o token (já foi exposto numa conversa anterior) e considerar secret manager.**

### M-10 — Fórmulas de level divergentes entre RPCs — CONFIRMADO ⭐ NOVO
- `supabase-security.sql` `submit_match_result`: `level = 1 + floor(total_xp/150)`; `finish_ranked_match` (ranked-xp-matches.sql) e o cliente (progression.ts:8-25): laço `while rem >= 100 + level*50`. Um mesmo XP total produz níveis diferentes conforme o modo — perfis podem "pular" ou "voltar" de nível entre partidas solo e ranked.
- Solução: unificar em `100+50·n` (a fórmula que o cliente e o ranked usam).

### D-06 — Replay de dia passado corrompe streak (CONFIRMADO)
- `DailyView.tsx:179-188` chama `recordDaily` com data antiga → `streak.lastDate = data passada` → próximo dia real = gap (freeze queimado ou streak reset).
- Solução: `recordDaily` só atualizar streak quando `date === hoje`.

### D-09 — Duo join race / leave não remove / username null (CONFIRMADO)
- join read-then-insert (matches.ts:537-557); leave sem DELETE server (DuoView:105-110); fetch seleciona `display_name` mas view lê `profiles.username` (sempre null — DuoView:49-53).

### D-16 — Limite diário em UTC (CONFIRMADO)
- `DailyView.tsx:24-26` usa `toISOString()` → "hoje" muda à meia-noite UTC (21h em Brasília).

### M-04 — Senha forte só no frontend (CONFIRMADO)
- Complexidade checada apenas em AuthDialog.tsx:758-773; signup direto pela API Supabase aceita o default do projeto (≥6).

## BAIXOS

- **L-01** Username enumeration via `check_username_available` + profiles público — aceito por design (usernames são públicos).
- **L-04** `auth.ts` duplicado MORTO ao lado de `auth.tsx` — hazard de refator (resolução por extensão funciona hoje: .tsx vence no bundler; verificado nos chunks do build). Mesma família: `use-toast.ts`/`use-mobile.ts` mortos, `getSavedGame/setSavedGame` do store sem chamadas.
- **L-05** `handle_new_user` deriva username do prefixo do email (OAuth) → vaza parte do email + pode colidir com unique index sem tratamento.
- **L-07** `chat_messages` RLS SELECT é author-only ⇒ destinatário NÃO LÊ mensagens (feature dormante; se ativar chat, quebra — além do D-17).
- **L-09** Win-trading entre contas coludidas: sem cooldown de revanche — Elo farm entre 2 contas.
- **L-10** `onAuthStateChange` callback async (anti-pattern supabase-js) — pode perder eventos; benigno hoje (⚠️ hipótese).
- **L-11** Flag guest `sudoku-arena-guest` fora do namespace `sudoku-arena:` — `clearAllData()` (limpar dados) NÃO desloga o visitante e `exportAll/importAll` não a incluem. — CONFIRMADO ⭐ NOVO
- **D-11** Solo: limite de erros só exibe banner, nunca encerra (design a validar).
- **D-12** Dica usa `Math.random()` no target (quebra determinismo do seed; não afeta ranked, que não tem dica).
- **D-13** Prática do guia salva como "solo" (XP mode errado).
- **D-08b** 3 erros ranked tratados como ABANDONO (−50 extra) — penalidade injusta documentada no código (RankedView:526-533); `finish_reason='errors'` previsto no enum mas nunca escrito.
- **D-14 (inconsistência de copy)** Regra ranked exibida diz "dez minutos" (`ranked.rules.1`) mas o timer não tem limite (comentário "no 10 min limit", RankedView:146).
- **M-07** Caddyfile com `XTransformPort` wildcard proxy (artefato do sandbox; não expor publicamente).
- Dev server sandbox com erro Turbopack pré-existente (não afeta produção Vercel).

## Resumo por gravidade

| Gravidade | Confirmados | Hipóteses |
|---|---|---|
| CRÍTICA | **5** (C-01..C-05) | 0 |
| ALTA | **6** (D-01, D-02, D-03, D-07, D-08, D-17) | 0 |
| MÉDIA | 10 (M-01, M-03, M-04, M-05, M-06, M-08, M-10, D-06, D-09, D-16) | 0 |
| BAIXA | 12 | 1 (L-10) |

**Conclusão de segurança/integridade:** o app NÃO está pronto para lançamento público enquanto C-01..C-05 não forem resolvidos. O design server-authoritative do ranked é correto em intenção (Elo atômico, idempotência), mas hoje **nem sequer persiste** (C-05), além de a validação da solução e as policies de INSERT/UPDATE terem lacunas exploráveis pela anon key pública.

---

# PARTE II — BACKLOG RECOMENDADO

> Priorização para lançamento público. Cada item: benefício, dificuldade (1-5), riscos, dependências, critério de aceite objetivo.

## Fase 1 — Segurança e integridade (BLOQUEANTE)

| # | Item | Como | Benefício | Dif. | Riscos | Dep. | Critério de aceite |
|---|------|------|----------|------|--------|------|-------------------|
| 1.0 | **Fix C-05: GUC em `finish_ranked_match`** ⭐ NOVO | `perform set_config('app.skip_profile_protection','true', true)` antes dos UPDATEs de profiles na RPC (re-instalar via SQL); aproveitar para trocar as outras RPCs p/ `is_local=true` | progressão ranked persiste; leaderboard funciona | 1 | baixo (SQL único) | — | Após partida ranked no Vercel, `profiles.rating` do vencedor = `rating_after` da partida (verificável via Management API) |
| 1.1 | Revogar `anon` de `get_email_by_username` + login-por-username server-side | `revoke` + nova RPC `login_by_username` que chama signIn internamente ou retorna apenas `found:true` | elimina vazamento PII (C-01) | 2 | quebrar login por username durante a troca | migrar frontend p/ nova RPC | `curl` anônimo para a RPC retorna 403; login por username funciona no app |
| 1.2 | Remover `update_user_rating` | `revoke all ... from authenticated` | elimina Elo self-service (C-03) | 1 | nenhum (sem caller) | — | `POST /rest/v1/rpc/update_user_rating` retorna 403 p/ authenticated |
| 1.3 | Teto de XP no `submit_match_result` | recalcular XP server-side (fórmula computeXp portada; fórmula de level unificada — resolve M-10) e ignorar `p_xp_earned` | elimina XP infinito (C-04) + consistência (M-10) | 3 | divergência de XP entre client e server | — | Submit com xp_earned=999999 resulta no XP calculado pelo server |
| 1.4 | Fechar INSERT direto em `ranked_matches` + validar solução contra o puzzle | remover policy INSERT; matchmake RPC grava solução em `match_solutions`; `finish_ranked_match` compara (e valida givens) | mata forjação de partidas + vitória instantânea (C-02/D-01/D-02) | 4 | mudança no fluxo de finish | geração do puzzle server-side OU solução derivada no finish | Insert direto via PostgREST retorna 403; solução trocada válida retorna error |
| 1.5 | Adicionar `supabase-security.sql` ao runner + idempotizar policies | incluir na lista do run-migrations.sh; `drop policy if exists` em todos | DB rebuild não perde proteções (D-08) | 1 | ordem de execução | — | `bun run supabase:migrate` 2× seguidas sem erro; trigger presente após rebuild |
| 1.6 | PKCE no OAuth | `createClient(..., {auth: {flowType: 'pkce'}})` em client.ts | tokens fora do fragment (M-03) | 1 | URLs callback já aceitam | — | login Google completa e tokens não aparecem no hash |
| 1.7 | Checar active-match do CHAMADOR no try_matchmake_atomic + advisory lock | `if exists(select 1 from ranked_matches where status='active' and (player1_id=v_user_id or player2_id=v_user_id)) then return` | jogador nunca fica em 2 partidas (D-07) | 2 | fila pode demorar mais em edge | — | Dois clientes simultâneos nunca produzem 2 matches para o mesmo user |
| 1.8 | Publication realtime p/ Duo/Chat | `alter publication supabase_realtime add table public.rooms, public.room_participants, public.chat_messages` (idempotente) ⭐ NOVO | canais duo/chat passam a emitir eventos (D-17) | 1 | payload maior no websocket | — | 2 abas em sala duo: participante novo aparece sem refresh |

## Fase 2 — Correção de bugs

| # | Item | Benefício | Dif. | Critério |
|---|------|----------|------|----------|
| 2.1 | Streak: replay de dia passado não mexe no streak (D-06) | integridade do streak | 1 | Reproduzir replay ontem → streak intacto hoje |
| 2.2 | Duo: leave remove participant (DELETE RPC) (D-09) | assentos não travam | 1 | Sair da sala → participant sumir do banco |
| 2.3 | Duo: fetch username (D-04) + join atômico (count check na RPC) | nomes corretos; sem overbooking | 2 | 2 joins simultâneos → nunca 5 participantes |
| 2.4 | Ranked 3-erros = derrota distinta de abandono (D-08b; usar `finish_reason='errors'`) | justiça competitiva (sem −50) | 3 | Perder por 3 erros mostra "Derrota" e aplica Elo normal |
| 2.5 | Ranked: dificuldade selecionável (fácil→experta na fila) | UX | 2 | Fila com easy/medium/hard/expert |
| 2.6 | Diário local-time (D-16) | streak correta p/ BR | 1 | Meia-noite local = novo dia |
| 2.7 | Solo: limite de erros encerra com modal (D-11) ou remove o banner | coerência | 1 | 5 erros → fim de jogo com tela |
| 2.8 | Limpar código morto (auth.ts, use-toast, use-mobile, ui/* mortos, ~17 deps npm, Prisma, tailwind.config.ts) | manutenibilidade, bundle | 2 | build sem warnings de deps unused; grep limpo |
| 2.9 | Uniformizar copy da regra ranked (timer sem limite) (D-14) ⭐ NOVO | coerência texto×código | 1 | texto da regra não menciona 10min |

## Fase 3 — Estabilidade multiplayer

| # | Item | Benefício | Dif. | Critério |
|---|------|----------|------|----------|
| 3.1 | Duo: decidir escopo (implementar partida OU esconder modo) | expectativa do usuário | 3 | Duo ou jogável end-to-end ou ocultado da nav |
| 3.2 | Reconexão ranked (refresh volta pra partida ativa via check_my_ranked_match no boot) | partida sobrevive F5 | 2 | F5 durante match → volta ao board |
| 3.3 | Rate limiting mínimo (Edge middleware ou RPC counters) | anti-spam fila/RPCs (M-01) | 3 | 20 joins de fila em 10s → bloqueado |
| 3.4 | Cooldown de revanche (mesmo par <5min não conta Elo) | anti win-trading (L-09) | 2 | 2ª vitória em <5min não altera rating |

## Fase 4 — Ranking e progressão

| # | Item | Benefício | Dif. | Critério |
|---|------|----------|------|----------|
| 4.1 | Substituir preview local de rating/XP por fetch do profile no boot (fonte única = server) | eliminar double-source (M-08) | 2 | localStorage não é mais fonte de rating |
| 4.2 | XP server-side também para solo/daily (usar submit_match_result como ÚNICO caminho, deletar saveMatchToCloud direto) | consistência | 3 | matches só entra via RPC |
| 4.3 | Divisão promotora no SERVER (retornar `promoted` no finish) | animação confiável | 1 | finish retorna flag promoted |
| 4.4 | Trigger/cola de colunas sensíveis em ranked_matches (proteger status/winner_id fora de RPC) | fecha D-03 | 2 | PATCH direto de status via PostgREST falha |

## Fase 5 — UX

| # | Item | Benefício | Dif. | Critério |
|---|------|----------|------|----------|
| 5.1 | Tela de redefinir senha (handler do link `#reset` + `updateUser`) | completar fluxo reset | 2 | Fluxo completo pedido→email→nova senha |
| 5.2 | Dicas/undo no ranked OU esconder botões | coerência | 1 | botões funcionam ou somem |
| 5.3 | Onboarding pós-login: se tour reaberto, não sobrepor resultado ranked | polish | 1 | sem sobreposição |
| 5.4 | PWA manifest + meta theme-color | mobile "app" feel | 1 | instalável no Android |
| 5.5 | Incluir guest flag no clearAll/export (L-11) ou movê-la p/ o namespace ⭐ NOVO | "limpar dados" completo | 1 | limpar dados desloga o visitante |

## Fase 6 — Desempenho e custos

| # | Item | Benefício | Dif. | Critério |
|---|------|----------|------|----------|
| 6.1 | Debounce updateRankedProgress (hoje: a CADA placement = ~50 RPCs/match) | menos chamadas RPC | 1 | ≤1 update a cada 2s durante partida |
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

| # | Item | Benefício | Dif. | Critério |
|---|------|----------|------|----------|
| 8.1 | Daily global com leaderboard do dia (server distribui seed) | viralização | 3 | mesmo board p/ todos verificado server-side |
| 8.2 | Cosméticos premium (avatares extras) | receita | 3 | checkout fake/sandbox |
| 8.3 | Analytics básico (posthog/self-host) | aprender retenção | 1 | evento de vitória/fila |
| 8.4 | Sentry ou logs de erro de produção | debug remoto | 1 | erros visíveis |

## Sequência recomendada

```
Semana 1: 1.0 (C-05!) → 1.2 → 1.5 → 1.6 → 1.8   (quick wins; C-05 é o mais urgente de todos)
Semana 2: 1.1 → 1.3 → 1.4 → 1.7                  (integridade ranked + anti-cheat)
Semana 3: 2.1 → 2.4 → 2.9 → 3.2                  (bugs que afetam jogadores reais)
Semana 4: 3.1 (decisão Duo) + 4.1 + 4.4 + 6.1
Depois:   Fases 5-8 conforme tração.
```

---

# PARTE III — HANDOFF PARA CONTINUAR O DESENVOLVIMENTO COM OUTRA IA

> LEIA ESTA PARTE INTEIRA antes de tocar em qualquer funcionalidade. Escrito em 28/10/2026 com base em auditoria completa de código + banco de produção. **Se algo aqui divergir do código, CONFIE NO CÓDIGO** e atualize este doc.

## 1. Objetivo do produto

Sudoku competitivo web (pt-BR primary). Solo com aprendizado (guia de 13 técnicas), desafios diários com streak, e 1v1 ranqueado com Elo/divisões. Monetização futura (cosméticos) ainda não implementada. Público-alvo: jogadores casuais→competitivos BR.

## 2. Stack (confirme antes de adicionar dependências)

- Next.js 16.1.1 App Router, React 19, TS 5 (`strict`, mas `noImplicitAny:false`, `ignoreBuildErrors:true` — erros TS NÃO quebram build).
- Tailwind CSS 4 (via postcss `@tailwindcss/postcss` + `@theme inline` em `globals.css` — `tailwind.config.ts` é LEGADO inerte).
- shadcn/ui new-york em `src/components/ui/` (48 arquivos; SÓ use: button card badge dialog input label progress switch slider dropdown-menu sheet sonner tooltip).
- Zustand 5 (`src/lib/store/app-store.ts`), framer-motion (só ViewTransition), recharts (Overview/ProfileCharts), sonner (toasts), lucide-react (ícones).
- Supabase JS (`@supabase/supabase-js`): client.ts Proxy singleton; auth.tsx Context; matches.ts; ranked.ts.
- Sem ORM (Prisma presente = DEAD CODE). Sem next-intl (i18n é custom store-backed). Sem TanStack/next-auth/zod — deps existem no package.json mas são lixo.
- Vercel deploy por GitHub push (`vercel.json`); bun runtime.

## 3. Arquitetura em 1 parágrafo

SPA de rota única (`page.tsx` troca 16 views por `store.route`). Estado local offline-first (Zustand + localStorage `sudoku-arena:*`) para solo/daily/XP; Supabase para auth (email/senha/username/Google) e competitivo (RPCs SECURITY DEFINER escrevem rating/XP/partidas; realtime para oponente terminar — **apenas nas tabelas ranked, que são as únicas na publication**). UMA API route real: `/api/submit-match` (valida sessão e chama RPC `submit_match_result` — hoje sem caller no cliente). Migrations SQL ficam na RAIZ (`supabase-*.sql`) e são rodadas via `bun run supabase:migrate` (Management API, token no `.env` NÃO commitado).

## 4. Mapa de arquivos críticos (TOQUE COM CUIDADO)

| Arquivo | Por quê |
|---|---|
| `src/lib/supabase/auth.tsx` | ÚNICO auth vivo. Cuidado: `src/lib/supabase/auth.ts` (extensão .ts) é MORTO — imports sem extensão resolvem .tsx. Se criar auth nova, apague o .ts. |
| `src/lib/store/app-store.ts` | Todo estado local. `recordGame`/`recordDaily`/`checkAchievements` têm efeitos cruzados (XP→level→freezes→cosméticos). `hydrate()` é chamado 1x em Providers. |
| `src/hooks/use-sudoku-game.ts` | Reducer do jogo. Win flow (linha ~505-593) encadeia: som→recordGame→(daily)→achievements→cloud save. `persist()` (debounce 400ms) e resume no mount. |
| `src/lib/sudoku/engine.ts` | `generatePuzzle(diff, seed)` determinístico, solução única. Daily/Ranked/Archive dependem do SEED (não mude o formato dos seeds!). |
| `src/components/views/RankedView.tsx` (972 ln) | Estados: lobby→queue→match→result. `handleFinish(abandon, boardToSubmit?)` — o boardToSubmit EXISTE para evitar stale state (bug histórico: partidas viravam "abandoned"). Realtime handler (~310-347) registra a derrota do outro player. Refs `elapsedRef/errorsRef` evitam closure stale. |
| `src/components/layout/AppShell.tsx` | Gate de auth; bloqueio Google-incompleto; interceptação de navegação ranked (events `ranked-abandon-attempt`/`ranked-forfeit-confirm`); TODOS os hooks antes dos early returns (regra dos hooks). |
| `src/components/layout/Providers.tsx` | Ordem: ThemeProvider→AuthProvider→children+OnboardingDialog+AuthedOverlays. `AuthedOverlays` só renderiza tour/toasts autenticado (fix de clique travado no login). |
| `supabase-ranked-overhaul.sql` + `supabase-ranked-xp-matches.sql` | A RPC `finish_ranked_match` VIVA em produção (Elo K=32, abandono −50, idempotente, grava `matches` p/ ambos, atualiza `profiles.total_xp/level` — **mas sem GUC ⇒ trigger reverte: C-05, corrigir primeiro**). Sintaxe PL/pgSQL: NÃO use `declare` no meio do corpo (causou bug histórico silencioso). |
| `.zscripts/run-migrations.sh` | Ordem canônica dos SQLs. `supabase-security.sql` NÃO está incluído (bug conhecido D-08) — se for mexer, adicione. |

## 5. Banco de dados (confirmado em produção 28/10/2026)

11 tabelas com RLS: profiles, matches, daily_records, ranked_queue, ranked_matches, friends, rooms, room_participants, chat_messages, seasons, match_solutions.

RPCs vivas: `finish_ranked_match, try_matchmake_atomic, check_my_ranked_match, heartbeat_ranked_queue, update_ranked_progress, get_email_by_username, check_username_available, set_username, search_user_by_username, submit_match_result, update_user_rating (PERIGOSA, sem caller — revogar), update_display_info, handle_new_user (trigger), protect_profile_fields (trigger), validate_sudoku_solution`.

**Invariante de username:** username = identidade única; `display_name` espelha username (trigger `handle_new_user` sincroniza). NÃO reintroduza campo "nome".

**Invariante de progressão:** `profiles.rating/total_xp/level` só podem mudar via RPC com o GUC `app.skip_profile_protection='true'` (trigger `protect_profile_fields` bloqueia UPDATE direto). ⚠️ **C-05: `finish_ranked_match` hoje NÃO seta o GUC — rating/XP do ranked NÃO persistem.** Se criar/editar RPC que escreva esses campos: `perform set_config('app.skip_profile_protection','true', true)` (transação-scoped, terceiro arg `true`) e **NÃO copie o padrão session-scoped (`false`) das RPCs do security.sql** — lá é bug latente (sessão fica desprotegida se a RPC abortar entre set e restore).

**Idempotência ranked:** `finish_ranked_match` faz `SELECT ... FOR UPDATE` + status check — chamada duplicada retorna o resultado sem aplicar de novo. NÃO quebre isso.

**Realtime:** apenas `ranked_queue`/`ranked_matches` estão na publication `supabase_realtime`. Canais de rooms/chat assinam mas nunca emitem (D-17).

## 6. Regras de negócio principais

1. **Vitória ranked:** primeiro `isComplete(board)` → `finish_ranked_match(matchId, board, false)`. **Derrota:** 3 erros → atualmente `finish_ranked_match(matchId, [], true)` (tratada como ABANDONO com −50 — conhecido e aceito até implementar reason 'errors' server-side).
2. **Elo:** K=32; E=1/(1+10^(ΔR/400)); abandono: Δ −= 50 se perdedor (ou força −50); floor rating 0. Rating inicial **0** (não 1200).
3. **XP:** vitória ranked 60-120 por dificuldade + bônus tempo (≤+50% <5min, +25% <10min) − 5·erro (server, floor 30); derrota 15; abandono 5. Solo client-side `computeXp` = 60·multDif·multModo·fatorTempo − 8·erros − 10·dicas, min 15.
4. **Level:** while xp ≥ 100+50·level (⚠️ exceto `submit_match_result` que usa `1+floor(xp/150)` — divergente, M-10).
5. **Divisões:** 0/800/1600/2400/3200/4000/5000 (bronze..grandmaster). `localDivision` (app-store.ts:637) e `DIVISIONS` (progression.ts:128) DEVEM ficar em sync.
6. **Streak diário:** ontem→hoje +1; gap: consome freeze senão reseta 1. Freeze ganho nos níveis 3/7/14.
7. **Fila ranked:** heartbeat 10s; expira >30s; matchmaking exclui quem tem match ativo (só do OPONENTE hoje — bug D-07); dificuldade hardcoded "medium".
8. **Guest:** `sudoku-arena-guest` no localStorage (fora do namespace — L-11); bloqueado de duo/ranked/leaderboard/friends por `GuestLoginRequired`.
9. **Google sem username:** `AppShell` renderiza `GoogleSignupCompletion` bloqueando TUDO até `setUsername`.

## 7. Bugs conhecidos NÃO corrigidos (resumo — detalhes na Parte I)

- **C-05 (novo, crítico):** rating/XP ranked não persistem em profiles (trigger reverte; RPC não seta GUC) — **primeira correção a fazer**.
- C-01 vazamento email · C-02 forjar partidas/Elo · C-03 update_user_rating · C-04 XP sem teto (todos CRÍTICOS, bloqueiam lançamento).
- D-17 (novo): publication realtime não cobre rooms/chat → canais duo mudos.
- Duo = shell sem jogo (botão sem onClick; leave não limpa; join race; username null).
- Streak quebra com replay de dia passado (D-06); limite diário em UTC (D-16).
- Solução ranked derivável no cliente (D-01); matchmaking race (D-07); UPDATE permissivo em ranked_matches (D-03).
- `supabase-security.sql` fora do runner (D-08); fórmulas de level divergentes (M-10).
- OAuth implicit (sem PKCE); senha forte só frontend; zero rate limiting; zero testes.

## 8. Decisões tomadas (não reverta sem motivo forte)

- Revert do redesign mobile-first geométrico (raio 0.375) → identidade atual raio 0.7rem/XL (oklch emerald/amber).
- Modo visitante como cidadão de 1ª classe (localStorage + gates).
- auth como Context (`AuthProvider`) porque cada componente tinha estado próprio e guest mode não propagava (bug histórico).
- Sonner com zIndex 9999 (login overlay é z-200 e escondia toasts).
- Tour/toasts só renderizam autenticado (overlay do tour travava cliques no login).
- `finish_ranked_match` PL/pgSQL puro (sem declare inline!). Runner de migrations via Management API (token em .env).
- História do git foi reescrita com filter-branch para expurgar token — NÃO force-push sem checar secrets.
- `handleFinish(abandon, boardToSubmit?)`: o board é passado como PARÂMETRO (state stale travou TUDO antigamente — partidas viravam "abandoned").
- `elapsedRef/errorsRef` em RankedView: closures stale davam tempo 0.
- Username unificado: `displayName` sempre espelha `username`; sem campo "nome pessoal" no signup.
- Histórico: derrota ranked exibe "Derrota" (não "Abandonada") — differentiate no HistoryView por `mode==='ranked'`.

## 9. Comandos essenciais

```bash
bun run dev                 # dev :3000 (logs dev.log) — instável na sandbox (Turbopack panic pré-existente)
bun run lint                # ÚNICO gate de qualidade
npx next build              # build (ignoreBuildErrors:true — TS não quebra)
bun run supabase:migrate    # roda supabase-*.sql via Management API (token .env)
git push origin main        # dispara deploy Vercel automático
```
QA é manual via `agent-browser` no Vercel (dev server da sandbox é instável). Produção: `https://sudoku-arena-br.vercel.app`.
Consulta ao banco: Management API `POST https://api.supabase.com/v1/projects/gwcorgidbkqethhowsod/database/query` com `SUPABASE_ACCESS_TOKEN` do `.env`.

## 10. Cuidados para não quebrar

1. NÃO remova `boardToSubmit` do handleFinish, nem os refs elapsed/errors, nem o `already_finished` check.
2. NÃO mova hooks para depois de early returns no AppShell/RankedView (violou rules-of-hooks 2× no passado).
3. NÃO use `declare` inline em PL/pgSQL; suba variáveis pro bloco DECLARE do topo.
4. Ao trocar policies RLS: `drop policy if exists` ANTES de `create` (o mesmo nome exato — o bug 42710 já aconteceu por "heartbeat" faltando no drop).
5. Z-index: login z-200 < Sonner 9999; modais de logout/promo z-300; promoção full-screen z-400.
6. Se tocar `check_username_available`/`get_email_by_username`, teste login-por-username E signup no Vercel após deploy (esses fluxos já quebraram 2×).
7. Toda escrita nova em `profiles.rating/total_xp/level` precisa do GUC do trigger (ver §5, transação-scoped) OU deve virar RPC.
8. `.env` tem token admin (SUPABASE_ACCESS_TOKEN) — JAMAIS commitar; GitHub já bloqueou push uma vez por secret scanning.
9. Ao mexer em realtime: adicione a tabela à publication `supabase_realtime` antes de esperar eventos (D-17).

## 11. Limitações atuais / próximos passos acordados

- Não há backend próprio; toda lógica crítica que precisar de confiança deve virar RPC SECURITY DEFINER (padrão já estabelecido).
- Duo decidir escopo é o próximo grande produto-decision (enquanto isso, considerar esconder da nav — D-17 o deixa ainda mais "morto").
- Antes de lançar público: executar Fase 1 do backlog (Parte II) — começando por 1.0 (C-05) e os 4 fixes críticos C-01..C-04.
- Não existe recuperação pós-link de reset de senha (só o pedido do email).
- Google OAuth E2E e matchmaking com 2 jogadores reais ainda não foram testados E2E de forma documentada.

## 12. Onde verificar estado vivo

- Banco: Management API (select direto) com token do .env — 15 RPCs, RLS 100%, trigger protect_profile instalado, publication = só ranked_*; 8 users; 1 ranked_match (abandoned, `player2_rating_after=16` — evidência viva do C-05 com profiles zerados).
- Produção Vercel: https://sudoku-arena-br.vercel.app (env vars NEXT_PUBLIC_SUPABASE_* configuradas lá).
- Git: `github.com/LucianoJunior907/sudoku-arena` (deploy auto por push).

---

*Fim do Arquivo 2 de 2. Resumo executivo, documentação técnica e inventário estão em `docs/AUDITORIA-TECNICA.md`. Nenhum arquivo de código foi modificado durante esta auditoria.*

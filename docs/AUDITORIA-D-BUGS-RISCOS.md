# Sudoku Arena — Documento D: Bugs e Riscos

> Gravidade: CRÍTICA / ALTA / MÉDIA / BAIXA. Status: ✅ CONFIRMADO (evidência no código/SQL) vs ⚠️ HIPÓTESE (precisa teste em runtime).
> Nenhuma correção foi aplicada — somente levantamento.

## CRÍTICOS (bloqueiam lançamento)

### C-01 — Vazamento de email de qualquer usuário (CONFIRMADO)
- **Arquivos:** `supabase-fix-username-permissions.sql:27-28`; `supabase-login-username.sql:12-15`; chamado em `auth.tsx:202`.
- **Evidência:** `grant execute on function public.get_email_by_username(text) to anon, authenticated` — a SECURITY DEFINER lê `auth.users.email` sem checar auth. O comentário no próprio código admite o trade-off (auth.tsx:195-200).
- **Impacto:** enumeração de usernames (profiles SELECT é `using(true)`) + dump em massa de emails reais. Exposição PII/GDPR.
- **Probabilidade:** 100% scriptável com a anon key pública.
- **Solução proposta:** revogar grant de `anon`; substituir login-por-username por RPC SECURITY DEFINER que autentica internamente (não retorna o email), OU bloquear a RPC por RLS de função.
- **Riscos da correção:** quebrar login por username até a nova RPC existir.

### C-02 — Partidas ranked forjadas + vitória com grid qualquer (CONFIRMADO)
- **Arquivos:** `supabase-ranked-overhaul.sql:111-112` (INSERT `with check (auth.uid() = player1_id or player2_id)`), `:384-394` (validação), `:436-437` (update dos DOIS profiles); `validate_sudoku_solution` `:482-533`.
- **Evidência:** (a) qualquer autenticado insere `ranked_matches(player1=eu, player2=vítima, status=active)` sem consentimento; (b) `finish_ranked_match` valida apenas que a grade 81 é um Sudoku consistente — **nunca compara com o puzzle derivado da seed**; a tabela `match_solutions` (que negaria leitura) nunca é populada; (c) a RPC atualiza rating de ambos os players.
- **Impacto:** roubo de até +32 Elo por chamada contra QUALquer uuid (colhível do leaderboard público), ilimitado; vítima perde rating sem jogar.
- **Solução:** prover INSERT de ranked_matches apenas via RPC (remover policy), e validar solução contra o puzzle derivado da seed no servidor (gerar puzzle no server ou guardar solução em `match_solutions` via trigger).
- **Riscos:** exige mover geração/validação de board para o servidor.

### C-03 — RPC auto-rating +100 sem uso (CONFIRMADO)
- **Arquivos:** `supabase-security.sql:188-219` (installada em produção — confirmado via pg_proc); nenhum caller em `src/`.
- **Evidência:** `update_user_rating(p_rating_change)` SECURITY DEFINER, granted `authenticated`, aplica ±100 ao próprio rating, seta o GUC de bypass do trigger.
- **Impacto:** `POST /rest/v1/rpc/update_user_rating {"p_rating_change":100}` em loop = rating infinito = #1 no leaderboard.
- **Solução:** `revoke all on function update_user_rating from authenticated;` (ou drop). Zero impacto no app (não há caller).

### C-04 — XP infinito via submit_match_result (CONFIRMADO)
- **Arquivos:** `supabase-security.sql:102-182` (p_xp_earned sem teto; p_final_board nunca usado); `api/submit-match/route.ts:87-99` repassa `xpEarned` do cliente.
- **Evidência:** o comentário do SQL admite (linhas 136-139). Únicos bounds: elapsed ≤3600s, errors ≤100.
- **Impacto:** XP/level/conquistas/cosméticos infinitos via 1 chamada repetida.
- **Solução:** calcular XP no servidor a partir de (modo, dificuldade, tempo, erros) — mesma fórmula de `computeXp` portada pra PL/pgSQL; descartar p_xp_earned.

## ALTOS

### D-01 — Solução do ranked no cliente (CONFIRMADO)
- `RankedView.tsx:293-297` (`setSolution(p.solution)` a partir da seed pública) + C-02 ⇒ vitória instantânea por script mesmo em partida legítima.
- Solução: não enviar `solution` ao cliente; guardar em `match_solutions` no momento do matchmake (RPC server-side).

### D-07 — Race do matchmaking: jogador em 2 partidas (CONFIRMADO no código)
- `supabase-ranked-overhaul.sql:179-206`: FOR UPDATE trava a linha do OPONENTE; A e B chamando simultaneamente criam DUAS partidas A×B. Também: o CHAMADOR nunca é checado por partida ativa (só o oponente).
- Solução: checar active-match do chamador dentro da RPC; usar advisory lock por usuário.

### D-03 — UPDATE de ranked_matches sem restrição de colunas (CONFIRMADO)
- Três policies permissivas (overhaul:115-117; audit-fixes:104-110) permitem a qualquer player PATCH `status/winner_id/finish_reason/rating_after` direto via PostgREST.
- Impacto: forjar resultado no histórico/UX (o Elo real fica no profiles com trigger, mas a partida pode ser "travada" antes da hora).
- Solução: trigger de colunas permitidas, ou remover UPDATE e usar apenas RPCs.

### D-08 — supabase-security.sql fora do runner de migrations (CONFIRMADO)
- `.zscripts/run-migrations.sh:33-44` não inclui o arquivo que instala `protect_profile_fields`, `submit_match_result`, `update_user_rating` e que DROPA policies perigosas do schema base.
- Impacto: **rebuild do banco = perde toda a proteção** (schema.sql recria policies permissivas de matches UPDATE etc.).
- Solução: adicionar ao runner na ordem correta; tornar todos os `create policy` idempotentes.

### D-02 — match_solutions nunca usada (CONFIRMADO)
- Tabela existe com RLS negando tudo (security.sql:17-25) — planejada para guardar a solução — mas nenhuma RPC escreve lê (verificado: 0 rows, sem referências em SQL/RPCs).
- É a infraestrutura correta para consertar C-02/D-01.

## MÉDIOS

### M-01 — Sem rate limiting (CONFIRMADO)
- Nenhum throttle em RPCs, fila (join/leave spam), writes. Queue churn scriptável.

### M-05 — room_participants exposto; join sem convite (CONFIRMADO)
- SELECT `using(true)` (schema:147) expõe membership de todas as salas; INSERT só checa `auth.uid()=user_id`; código de sala Math.random 6 chars (matches.ts:490); capacidade/status checados só no cliente.

### M-03 — Google OAuth fluxo implicit sem PKCE (CONFIRMADO)
- client.ts não seta flowType; default do SDK é implicit (tokens no fragment). `redirectTo` fixado em origin (sem open redirect).

### M-08 — Dupla gravação de partidas solo/daily (CONFIRMADO)
- `use-sudoku-game.ts:553-590` insere direto em `matches`/`daily_records` com xp/score do cliente, E existe a RPC `submit_match_result` (via /api/submit-match) — fontes duplicadas, resultado depende da ordem de migrations (policies podem ter sido recriadas pelo runner).

### M-06 — Token admin no .env (contido) (CONFIRMADO)
- `SUPABASE_ACCESS_TOKEN` (Management API, admin) em `.env` — NÃO trackado (verificado `git rev-list --all -- .env` vazio; .gitignore:60). Risco residual: snapshot/commit acidental. Recomendação: rotacionar o token (já foi exposto numa conversa) e considerar secret manager.

### D-06 — Replay de dia passado corrompe streak (CONFIRMADO)
- `DailyView.tsx:179-188` chama `recordDaily` com data antiga → `streak.lastDate = data passada` → próximo dia real = gap (freeze queimado ou streak reset).
- Solução: `recordDaily` só atualizar streak quando `date === hoje`.

### D-09 — Duo join race / leave não remove / username null (CONFIRMADO)
- join read-then-insert (matches.ts:537-557); leave sem DELETE server (DuoView:105-110); fetch seleciona display_name mas view lê `profiles.username` (sempre null — DuoView:49-53).

### D-16 — Limite diário em UTC (CONFIRMADO)
- `DailyView.tsx:24-26` usa `toISOString()` → "hoje" muda à meia-noite UTC (21h em Brasília).

### M-04 — Senha forte só no frontend (CONFIRMADO)
- Complexidade checada apenas em AuthDialog.tsx:758-773; signup direto pela API Supabase aceita o default do projeto (≥6).

## BAIXOS

- **L-01** Username enumeration via check_username_available + profiles public — aceito por design (usernames são públicos).
- **L-04** `auth.ts` duplicado MORTO ao lado de `auth.tsx` — hazard de refator (resolução por extensão funciona hoje: .tsx vence no bundler).
- **L-05** `handle_new_user` deriva username do prefixo do email (OAuth) → vaza parte do email + pode colidir com unique index sem tratamento.
- **L-07** `chat_messages` RLS SELECT é author-only ⇒ destinatário NÃO LÊ mensagens (feature dormante; se ativar chat, quebra).
- **L-10** `onAuthStateChange` callback async (anti-pattern supabase-js) — pode perder eventos; benigno hoje.
- **D-11** Solo: limite de erros só exibe banner, nunca encerra (design a validar).
- **D-12** Dica usa `Math.random()` no target (quebra determinismo do seed; não afeta ranked que não tem dica).
- **D-13** Prática do guia salva como "solo" (XP mode errado).
- **D-08b** 3 erros ranked tratados como ABANDONO (−50 extra) — penalidade injusta documentada no código (RankedView:526-533).
- **L-09** Win-trading entre contas coludidas: sem cooldown de revanche — Elo farm entre 2 contas.
- **M-07** Caddyfile com `XTransformPort` wildcard proxy (artefato do sandbox; não expor publicamente).
- Dev server sandbox com erro Turbopack pré-existente (não afeta produção).

## Resumo por gravidade

| Gravidade | Confirmados | Hipóteses |
|---|---|---|
| CRÍTICA | 4 | 0 |
| ALTA | 5 | 0 |
| MÉDIA | 9 | 0 (M-03 com prob. alta) |
| BAIXA | 11 | 1 (L-10) |

**Conclusão de segurança:** o app NÃO está pronto para lançamento público enquanto C-01..C-04 não forem resolvidos. O design server-authoritative do ranked é correto em intenção (Elo atômico, idempotência), mas a validação da solução e as policies de INSERT/UPDATE têm lacunas exploráveis pela anon key pública.

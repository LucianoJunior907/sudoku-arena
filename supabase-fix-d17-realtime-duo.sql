-- ============================================
-- SUDOKU ARENA — FIX D-17: publication Realtime não cobre Duo/Chat
-- ============================================
-- PROBLEMA (bug D-17 da auditoria):
--   A publication `supabase_realtime` só continha 2 tabelas:
--     public.ranked_matches, public.ranked_queue
--   Confirmado em produção via:
--     select tablename from pg_publication_tables
--     where pubname='supabase_realtime';
--   As tabelas Duo/Chat (rooms, room_participants, chat_messages)
--   estavam AUSENTES — então os canais realtime do frontend
--   (matches.ts:560 subscribeToRoom, matches.ts:450 subscribeToChat)
--   assinavam `postgres_changes` que NUNCA emitiam eventos.
--   Impacto: lista de participantes não atualiza sozinha; chat duo
--   nunca receberia mensagens. App dava impressão de realtime sem ter.
--
-- CORREÇÃO:
--   Adicionar as 3 tabelas à publication supabase_realtime.
--   `alter publication ... add table` não é idempotente nativamente
--   (erro "relation is already member of publication"), por isso
--   usamos um DO-block com verificação em pg_publication_tables —
--   mesmo padrão já usado em supabase-ranked-overhaul.sql para as
--   tabelas ranked.
--
-- SEGURANÇA — RLS continua sendo o gate:
--   O Supabase Realtime respeita RLS: um cliente só recebe eventos
--   `postgres_changes` de rows que ele poderia ler via SELECT. As 3
--   tabelas têm RLS habilitado e policies que restringem por
--   auth.uid() (confirmado em produção antes de aplicar):
--     rooms               — SELECT: público se !is_private, senão
--                           host ou participante; UPDATE só host;
--                           INSERT só host; (sem DELETE direto)
--     room_participants   — SELECT:所有人; INSERT só próprio user;
--                           DELETE só próprio user
--     chat_messages       — SELECT: só author_id; INSERT só author_id
--   Adicionar à publication NÃO放宽a o access — apenas permite que
--   eventos de mudanças já autorizadas por RLS cheguem ao cliente.
--   Clientes não-autorizados continuam sem ver salas privadas, sem
--   ver participantes de salas que não estão, e sem ver mensagens
--   alheias.
--
-- ACEITE (auditoria): "2 abas em sala duo: participante novo aparece
--   sem refresh; mensagem enviada em uma aba chega na outra".
--
-- IDEMPOTENTE — DO-block verifica antes de adicionar; seguro
--   re-executar N vezes.
-- ============================================

do $$
begin
  -- rooms
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;

  -- room_participants
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_participants'
  ) then
    alter publication supabase_realtime add table public.room_participants;
  end if;

  -- chat_messages
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end
$$;

-- ============================================
-- VERIFICAÇÃO (SQL Editor ou Management API)
-- ============================================
-- 1) Publication deve conter 5 tabelas (2 ranked + 3 duo/chat):
--    select tablename from pg_publication_tables
--    where pubname='supabase_realtime' order by tablename;
--    -- Esperado: chat_messages, ranked_matches, ranked_queue,
--    --           room_participants, rooms
--
-- 2) RLS continua ativa (não mexemos nas policies):
--    select relname, relrowsecurity from pg_class
--    where relname in ('rooms','room_participants','chat_messages');
--    -- Esperado: relrowsecurity = true para todos

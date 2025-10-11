// File: frontend/src/hooks/useResolvedSessionId.ts
// Resolve sessionId from query/default/auth context.

import React from "react";
import { useLocation } from "react-router-dom";
import { getDefaultSessionId } from "../lib/http";
import { useTelegramAuth } from "../context/TelegramAuthContext";

// English: same resolver as before, isolated for reuse
function resolveSessionIdFromCtx(ctx: any): string | null {
  return (
    ctx?.activeSessionId ||
    ctx?.sessionId ||
    ctx?.active?.sessionId ||
    ctx?.current?.sessionId ||
    (Array.isArray(ctx?.accounts) &&
      (ctx.accounts.find((a: any) => a?.active)?.sessionId ||
        ctx.accounts[0]?.sessionId)) ||
    null
  );
}

export function useResolvedSessionId(): string | null {
  const auth = useTelegramAuth() as any;
  const location = useLocation();

  const querySid = React.useMemo(() => {
    const p = new URLSearchParams(location.search);
    const s = p.get("s") || p.get("session") || p.get("sessionId");
    return s ? s.trim() : null;
  }, [location.search]);

  return React.useMemo(() => {
    return (
      (
        querySid ||
        getDefaultSessionId() ||
        resolveSessionIdFromCtx(auth) ||
        ""
      ).trim() || null
    );
  }, [querySid, auth]);
}

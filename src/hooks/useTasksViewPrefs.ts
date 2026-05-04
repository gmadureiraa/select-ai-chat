import { useCallback, useEffect, useState } from "react";

export type TasksView = "board" | "list" | "calendar";
export type TasksGroupBy = "status" | "assignee" | "priority" | "client" | "due";

export interface TasksViewPrefs {
  view: TasksView;
  groupBy: TasksGroupBy;
  showDone: boolean;
}

const DEFAULTS: TasksViewPrefs = {
  view: "board",
  groupBy: "status",
  showDone: true,
};

export function useTasksViewPrefs(workspaceId: string | undefined) {
  const key = workspaceId ? `kai:tasks:view:${workspaceId}` : null;
  const [prefs, setPrefs] = useState<TasksViewPrefs>(DEFAULTS);

  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
      else setPrefs(DEFAULTS);
    } catch { setPrefs(DEFAULTS); }
  }, [key]);

  const update = useCallback((patch: Partial<TasksViewPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      if (key) {
        try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* noop */ }
      }
      return next;
    });
  }, [key]);

  return { prefs, update };
}

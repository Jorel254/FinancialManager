import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppSettings } from "@shared/models";
import { getApi, hasApi } from "@/lib/api";

interface SettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  error: string | null;
  setHideAmounts: (hideAmounts: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = { hideAmounts: false };

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hasApi()) {
      setLoading(false);
      setError("Preload no disponible (¿abriste la app con Electron?)");
      return;
    }
    try {
      const result = await getApi().settings.get();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setSettings(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al leer ajustes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setHideAmounts = useCallback(async (hideAmounts: boolean) => {
    if (!hasApi()) {
      setError("Preload no disponible");
      return;
    }
    const previous = settings;
    setSettings({ hideAmounts });
    try {
      const result = await getApi().settings.update({ hideAmounts });
      if (!result.ok) {
        setSettings(previous);
        setError(result.error.message);
        return;
      }
      setError(null);
      setSettings(result.data);
    } catch (err) {
      setSettings(previous);
      setError(
        err instanceof Error ? err.message : "No se pudo guardar el ajuste",
      );
    }
  }, [settings]);

  const value = useMemo(
    () => ({
      settings,
      loading,
      error,
      setHideAmounts,
      refresh,
    }),
    [settings, loading, error, setHideAmounts, refresh],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings debe usarse dentro de SettingsProvider");
  }
  return ctx;
}

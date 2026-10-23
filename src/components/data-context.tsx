"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { Database } from "@/lib/domain";
import { DemoProvider, DataProvider } from "@/lib/provider";
interface Context {
  data: Database | null;
  provider: DataProvider;
  mutate: (action: () => Promise<void>, message: string) => Promise<boolean>;
  toast: (message: string) => void;
  busy: boolean;
}
const DataContext = createContext<Context | null>(null);
export function DataRoot({ children }: { children: ReactNode }) {
  const [provider] = useState(() => new DemoProvider());
  const [data, setData] = useState<Database | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    provider
      .load()
      .then(setData)
      .catch(() =>
        setMessage("Could not load demo data. Reload to try again."),
      );
  }, [provider]);
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  const mutate = useCallback(
    async (action: () => Promise<void>, success: string) => {
      setBusy(true);
      try {
        await action();
        setData(await provider.load());
        setMessage(success);
        return true;
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [provider],
  );
  return (
    <DataContext.Provider
      value={{ data, provider, mutate, toast: setMessage, busy }}
    >
      {children}
      <div
        className={`toast ${message ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </DataContext.Provider>
  );
}
export function useData() {
  const value = useContext(DataContext);
  if (!value) throw new Error("DataRoot required");
  return value;
}

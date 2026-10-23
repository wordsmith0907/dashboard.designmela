"use client";
import { useSearchParams } from "next/navigation";
import { EditableCollection } from "@/lib/domain";
import { RecordsPage } from "./records-page";
import { CrmPage } from "./crm-page";
/** Remount detail selection when global search targets another record on this route. */
export function RecordsRoute({
  collection,
}: {
  collection: EditableCollection;
}) {
  const params = useSearchParams();
  if (collection === "leads") return <CrmPage key={params.toString()} />;
  return (
    <RecordsPage key={params.get("record") ?? "list"} collection={collection} />
  );
}

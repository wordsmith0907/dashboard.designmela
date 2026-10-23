import { Suspense } from "react";
import { RecordsRoute } from "@/components/records-route";
import { Skeleton } from "@/components/ui";
export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <RecordsRoute collection="leads" />
    </Suspense>
  );
}

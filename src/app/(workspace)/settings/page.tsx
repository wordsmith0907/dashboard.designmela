import DemoPage from "./demo";
import { WorkspacePage } from "@/components/connected/workspace-page";
export default function Page({searchParams}:{searchParams:Promise<{page?:string}>}) {
  return <WorkspacePage path="/settings" demo={<DemoPage />} searchParams={searchParams} />;
}

import { PageSkeleton } from "@/components/ui/skeleton";

// Route-group loading. Renders inside the sidebar shell instantly on any
// navigation under /client, so the user sees structure within ~50ms instead
// of a blank screen while the server fetches data.
export default function ClientLoading() {
  return <PageSkeleton />;
}

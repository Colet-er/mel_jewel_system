import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

interface ModulePlaceholderProps {
  title: string;
  description: string;
}

export function ModulePlaceholder({ title, description }: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <EmptyState
        title="Coming in an upcoming phase"
        description={description}
      />
    </div>
  );
}

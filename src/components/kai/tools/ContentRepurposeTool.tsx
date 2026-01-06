import { BulkContentCreator } from "./BulkContentCreator";

interface ContentRepurposeToolProps {
  clientId: string;
}

export function ContentRepurposeTool({ clientId }: ContentRepurposeToolProps) {
  return <BulkContentCreator clientId={clientId} />;
}

// Citation type definition - moved from CitationChip.tsx for better modularity

export interface Citation {
  id: string;
  title: string;
  type: "content_library" | "reference_library" | "format" | "assignee" | "client" | "performance";
  category: string;
}

import { useQuery } from "@tanstack/react-query";
import { fetchWorkspaceData, type WorkspaceStats } from "@/services/workspaceData";

export function useWorkspaceData() {
  return useQuery<WorkspaceStats>({
    queryKey: ["workspace-data"],
    queryFn: fetchWorkspaceData,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}
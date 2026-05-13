import { useGraphStore } from "../store/graphStore";
import { Node } from "../types/domain";

export function useNode(id: string): Node | undefined {
  return useGraphStore((state) => state.nodes[id]);
}

export function useNodeChildren(id: string): string[] {
  return useGraphStore((state) => state.nodes[id]?.children || []);
}

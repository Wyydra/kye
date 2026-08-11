export type AppLifecycleState =
  | { status: "UNINITIALIZED" }
  | { status: "NO_WORKSPACE" }
  | { status: "LOADING_WORKSPACE"; path?: string }
  | { status: "READY"; path: string }
  | { status: "FATAL_ERROR"; message: string };

export interface WorkspaceStatus {
  isSelected: boolean;
  path: string | null;
}

import { Command } from "./domain";

export interface RemotePeer {
  id: string;
  name: string;
  url: string;
  pin: string;
  lastSync?: string;
}

export interface DiffLine {
  type: "add" | "remove" | "info";
  text: string;
}

export interface ReviewableCommand {
  id: string;
  selected: boolean;
  description: string;
  cmd: Command;
  nodeTitle?: string;
  diffLines: DiffLine[];
}



import React, { createContext, useContext } from "react";
import { BlockTypeSpec, MarkSpec } from "../extensions/registry";
import { CORE_BLOCK_TYPES, CORE_MARKS } from "../extensions/coreBlocks";

interface EditorContextValue {
  blockTypes: BlockTypeSpec[];
  marks: MarkSpec[];
}

const EditorContext = createContext<EditorContextValue>({
  blockTypes: CORE_BLOCK_TYPES,
  marks: CORE_MARKS,
});

export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <EditorContext.Provider value={{ blockTypes: CORE_BLOCK_TYPES, marks: CORE_MARKS }}>
    {children}
  </EditorContext.Provider>
);

export const useEditor = () => useContext(EditorContext);

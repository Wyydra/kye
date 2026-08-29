import React from "react";
import { ParagraphWidget } from "./ParagraphWidget";
import { HeadingWidget } from "./HeadingWidget";
import { TaskWidget } from "./TaskWidget";
import { FlashcardWidget } from "./FlashcardWidget";
import { ImageWidget } from "./ImageWidget";
import { FileWidget } from "./FileWidget";
import { Node } from "../../../types/domain";

export type WidgetComponent = React.FC<{ node: Node }>;

export const WIDGET_REGISTRY: Record<string, WidgetComponent> = {
  paragraph: ParagraphWidget,
  heading: HeadingWidget,
  task: TaskWidget,
  image: ImageWidget,
  flashcard: FlashcardWidget,
  file: FileWidget,
  asset: FileWidget,
};

export function registerWidget(name: string, component: WidgetComponent) {
  WIDGET_REGISTRY[name] = component;
}

export function getWidget(name: string): WidgetComponent | undefined {
  return WIDGET_REGISTRY[name];
}

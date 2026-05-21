import { LAYOUT_REGISTRY } from "./registry";
import { DocumentLayout } from "./DocumentLayout";
import { StackLayout } from "./StackLayout";
import { WidgetLayout } from "./WidgetLayout";
import { CanvasLayout } from "./CanvasLayout";

export function bootstrapLayouts() {
  LAYOUT_REGISTRY["Document"] = DocumentLayout;
  LAYOUT_REGISTRY["Stack"] = StackLayout;
  LAYOUT_REGISTRY["Widget"] = WidgetLayout;
  LAYOUT_REGISTRY["Canvas"] = CanvasLayout;
}

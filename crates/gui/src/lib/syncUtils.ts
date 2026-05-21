import { Value } from "../types/domain";

export const formatValue = (value: Value | undefined): string => {
  if (!value) return "null";
  switch (value.t) {
    case "Null": return "null";
    case "Bool": return value.v ? "true" : "false";
    case "Int":
    case "Float":
    case "Text":
    case "Ref":
    case "Date":
    case "DateTime":
    case "Color":
      return String(value.v);
    case "Rich":
      return value.v.spans.map(s => s.text).join("");
    case "Array":
      return `[${value.v.map(formatValue).join(", ")}]`;
    default:
      return JSON.stringify(value);
  }
};

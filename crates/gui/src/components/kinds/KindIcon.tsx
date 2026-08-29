import React from "react";
import {
  FileText,
  LayoutGrid,
  CheckSquare,
  Volume2,
  Image,
  Database,
  File,
  Layers,
  Search,
  Inbox,
  CircleDot,
} from "lucide-react";
import { KindDef } from "../../types/domain";
import { cn } from "../../lib/utils";

interface KindIconProps {
  kind: string;
  kindDef?: KindDef;
  className?: string;
  size?: number;
}

export const KindIcon: React.FC<KindIconProps> = ({
  kind,
  kindDef,
  className,
  size = 14,
}) => {
  const iconProps = {
    size,
    className: cn("shrink-0 stroke-[1.75]", className),
  };

  switch (kind) {
    case "core.page":
      return <FileText {...iconProps} />;
    case "core.canvas":
      return <LayoutGrid {...iconProps} />;
    case "core.task":
      return <CheckSquare {...iconProps} />;
    case "core.audio":
      return <Volume2 {...iconProps} />;
    case "core.image":
      return <Image {...iconProps} />;
    case "core.database":
      return <Database {...iconProps} />;
    case "core.file":
    case "core.binary":
      return <File {...iconProps} />;
    case "core.flashcard":
      return <Layers {...iconProps} />;
    case "core.query":
      return <Search {...iconProps} />;
    case "core.inbox":
      return <Inbox {...iconProps} />;
    default:
      if (kindDef?.icon && kindDef.icon.length <= 2) {
        return (
          <span
            className={cn("shrink-0 text-center font-mono font-bold leading-none", className)}
            style={{ fontSize: `${size}px` }}
          >
            {kindDef.icon}
          </span>
        );
      }
      return <CircleDot {...iconProps} />;
  }
};

import {
  AppWindow,
  BookOpen,
  Box,
  Cpu,
  Database,
  Disc,
  File,
  FileArchive,
  FileCode2,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  KeyRound,
  Music,
  Network,
  Package,
  Palette,
  Presentation,
  Scroll,
  Smartphone,
  SquareTerminal,
  Terminal,
  Type,
  Video,
} from "lucide-react";
import { resolveAttachmentKind } from "@edgeever/shared";
import { cn } from "@/lib/utils";

export const AttachmentFileIcon = ({
  mimeType,
  filename,
  className,
}: {
  mimeType?: string | null;
  filename?: string | null;
  className?: string;
}) => {
  const kind = resolveAttachmentKind(mimeType, filename);
  const commonClassName = cn("h-8 w-8 shrink-0", className);

  switch (kind) {
    case "image": return <ImageIcon className={cn("text-emerald-500", commonClassName)} aria-hidden="true" />;
    case "audio": return <Music className={cn("text-sky-500", commonClassName)} aria-hidden="true" />;
    case "video": return <Video className={cn("text-rose-500", commonClassName)} aria-hidden="true" />;
    case "pdf": return <FileText className={cn("text-rose-600", commonClassName)} aria-hidden="true" />;
    case "spreadsheet": return <FileSpreadsheet className={cn("text-green-600", commonClassName)} aria-hidden="true" />;
    case "document": return <FileText className={cn("text-blue-600", commonClassName)} aria-hidden="true" />;
    case "presentation": return <Presentation className={cn("text-orange-500", commonClassName)} aria-hidden="true" />;
    case "archive": return <FileArchive className={cn("text-amber-500", commonClassName)} aria-hidden="true" />;
    case "code": return <FileCode2 className={cn("text-violet-500", commonClassName)} aria-hidden="true" />;
    case "script": return <SquareTerminal className={cn("text-emerald-600", commonClassName)} aria-hidden="true" />;
    case "text": return <FileText className={cn("text-slate-500", commonClassName)} aria-hidden="true" />;
    case "apk": return <Smartphone className={cn("text-emerald-500", commonClassName)} aria-hidden="true" />;
    case "exe": return <AppWindow className={cn("text-sky-500", commonClassName)} aria-hidden="true" />;
    case "dmg": return <Package className={cn("text-violet-500", commonClassName)} aria-hidden="true" />;
    case "linux": return <Terminal className={cn("text-orange-500", commonClassName)} aria-hidden="true" />;
    case "executable": return <Cpu className={cn("text-teal-600", commonClassName)} aria-hidden="true" />;
    case "book": return <BookOpen className={cn("text-amber-700", commonClassName)} aria-hidden="true" />;
    case "font": return <Type className={cn("text-indigo-500", commonClassName)} aria-hidden="true" />;
    case "diskimage": return <Disc className={cn("text-cyan-600", commonClassName)} aria-hidden="true" />;
    case "database": return <Database className={cn("text-fuchsia-600", commonClassName)} aria-hidden="true" />;
    case "design": return <Palette className={cn("text-pink-500", commonClassName)} aria-hidden="true" />;
    case "model3d": return <Box className={cn("text-blue-500", commonClassName)} aria-hidden="true" />;
    case "log": return <Scroll className={cn("text-zinc-500", commonClassName)} aria-hidden="true" />;
    case "certificate": return <KeyRound className={cn("text-amber-600", commonClassName)} aria-hidden="true" />;
    case "diagram": return <Network className={cn("text-teal-600", commonClassName)} aria-hidden="true" />;
    default: return <File className={cn("text-slate-400", commonClassName)} aria-hidden="true" />;
  }
};

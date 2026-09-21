import { useEffect, type ReactNode } from "react";
import { BubbleMenu, EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { Button } from "@/app/components/ui/button";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Table as TableIcon,
  Minus,
  Quote,
  Undo2,
  Redo2,
} from "lucide-react";
import { cn } from "@/app/helpers/utils";

type LegalRichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
};

export function LegalRichTextEditor({ value, onChange, disabled }: LegalRichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder: "Write or paste the legal document…" }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "tiptap ProseMirror max-w-full min-w-0",
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) return null;

  return (
    <div className={cn("legal-editor min-w-0 max-w-full overflow-x-hidden rounded-lg border bg-background", disabled && "opacity-70")}>
      <div className="sticky top-14 z-20 flex min-w-0 max-w-full flex-wrap gap-1 border-b bg-background/95 p-2 shadow-sm backdrop-blur sm:top-16">
        <FormatButtons editor={editor} />
      </div>
      {!disabled ? (
        <BubbleMenu
          editor={editor}
          updateDelay={50}
          tippyOptions={{
            duration: 100,
            placement: "top",
            offset: [0, 10],
            zIndex: 60,
            maxWidth: "none",
          }}
          shouldShow={({ editor: instance }) => instance.isEditable && instance.isFocused}
          className="legal-bubble-toolbar z-[60] flex flex-wrap items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg"
        >
          <FormatButtons editor={editor} compact />
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} className="legal-editor-content legal-prose min-w-0 max-w-full overflow-x-hidden" />
    </div>
  );
}

function FormatButtons({ editor, compact }: { editor: Editor; compact?: boolean }) {
  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  return (
    <>
      <ToolbarButton label="Bold" active={editor.isActive("bold")} compact={compact} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive("italic")} compact={compact} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Underline" active={editor.isActive("underline")} compact={compact} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Heading 2" active={editor.isActive("heading", { level: 2 })} compact={compact} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Heading 3" active={editor.isActive("heading", { level: 3 })} compact={compact} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} compact={compact} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} compact={compact} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={editor.isActive("blockquote")} compact={compact} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      {!compact ? (
        <ToolbarButton label="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-4 w-4" />
        </ToolbarButton>
      ) : null}
      <ToolbarButton label="Link" active={editor.isActive("link")} compact={compact} onClick={setLink}>
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>
      {!compact ? (
        <>
          <ToolbarButton label="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <TableIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>
        </>
      ) : null}
    </>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  label,
  compact,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  label: string;
  compact?: boolean;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant={active ? "secondary" : "ghost"}
      className={cn("h-8 w-8", compact && "h-7 w-7")}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

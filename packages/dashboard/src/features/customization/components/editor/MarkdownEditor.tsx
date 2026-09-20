import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef } from "react";
import { markdownExtensions } from "./markdown-extensions";
import "./markdown-editor.css";

export interface MarkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
  label?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  readOnly = false,
  label = "本文・作業方針",
}: MarkdownEditorProps) {
  const synchronized = useRef(value);
  const editor = useEditor({
    extensions: markdownExtensions,
    content: value,
    contentType: "markdown",
    editable: !readOnly,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": label,
        "aria-multiline": "true",
        "aria-readonly": String(readOnly),
        class: "markdown-editor__content",
        tabindex: "0",
      },
    },
    onUpdate: ({ editor: current }) => {
      if (readOnly || !current.isEditable) return;
      const markdown = current.getMarkdown();
      synchronized.current = markdown;
      onChange(markdown);
    },
  });
  useEffect(() => {
    if (!editor || synchronized.current === value) return;
    synchronized.current = value;
    editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
  }, [editor, value]);
  useEffect(() => {
    editor?.setEditable(!readOnly, false);
  }, [editor, readOnly]);
  if (!editor) return null;
  return (
    <div className="markdown-editor min-w-0 rounded-lg border" data-readonly={readOnly}>
      <EditorContent editor={editor} />
    </div>
  );
}

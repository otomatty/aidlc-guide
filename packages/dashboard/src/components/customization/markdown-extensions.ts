import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Paragraph } from "@tiptap/extension-paragraph";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import { Node } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

// Preserve embedded HTML as literal source; never execute it or drop comments.
function rawHtml(inline: boolean) {
  return Node.create({
    name: inline ? "rawHtmlInline" : "rawHtmlBlock",
    group: inline ? "inline" : "block",
    inline,
    atom: true,
    addAttributes: () => ({ raw: { default: "" } }),
    markdownTokenName: "html",
    parseMarkdown: (token) =>
      Boolean(token.block) === !inline
        ? {
            type: inline ? "rawHtmlInline" : "rawHtmlBlock",
            attrs: { raw: token.raw ?? token.text ?? "" },
          }
        : [],
    renderMarkdown: (node) => node.attrs?.raw ?? "",
    parseHTML: () => [],
    renderHTML: ({ node }) => [
      inline ? "span" : "pre",
      { class: "markdown-literal" },
      node.attrs.raw,
    ],
  });
}

// Images retain their Markdown without fetching arbitrary document URLs.
const ImageReference = Node.create({
  name: "imageReference",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({ raw: { default: "" }, alt: { default: "画像" } }),
  markdownTokenName: "image",
  parseMarkdown: (token) => ({
    type: "imageReference",
    attrs: { raw: token.raw, alt: token.text || "画像" },
  }),
  renderMarkdown: (node) => node.attrs?.raw ?? "",
  parseHTML: () => [],
  renderHTML: ({ node }) => ["span", { class: "markdown-literal" }, `画像: ${node.attrs.alt}`],
});

export const markdownExtensions = [
  StarterKit.configure({
    underline: false,
    paragraph: false,
    link: { openOnClick: false, autolink: false },
  }),
  Paragraph.extend({
    parseMarkdown(token, helpers) {
      // The default paragraph parser lifts standalone images into block nodes.
      // Our image references are inline, so keep their containing paragraph.
      if (token.tokens?.length === 1 && token.tokens[0]?.type === "image")
        return helpers.createNode("paragraph", undefined, helpers.parseInline(token.tokens));
      return Paragraph.config.parseMarkdown?.call(this, token, helpers) ?? [];
    },
  }),
  TableKit,
  TaskList,
  TaskItem.configure({ nested: true }),
  rawHtml(false),
  rawHtml(true),
  ImageReference,
  Markdown.configure({ markedOptions: { gfm: true } }),
];

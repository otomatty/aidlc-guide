import { ArrowRight, BookOpen, PanelsTopLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DocsCategory } from "./docs-navigation.ts";

const CATEGORIES = [
  {
    id: "workflow",
    title: "ワークフロー",
    description: "aidlc-workflows の公式ドキュメントと更新履歴",
    icon: BookOpen,
    topics: [
      "AI-DLC の概要とユーザーガイド",
      "ハーネスの設定・カスタマイズ",
      "開発者リファレンス・RFC",
      "更新のハイライト・バージョンごとの変更点",
    ],
    action: "ワークフローのドキュメントを探す",
  },
  {
    id: "extension",
    title: "拡張機能",
    description: "AIDLC Guide の導入と日々の操作",
    icon: PanelsTopLeft,
    topics: [
      "インストールと初期設定",
      "Dashboard・成果物の読み方",
      "ドキュメントの設定とチーム共有",
    ],
    action: "拡張機能のドキュメントを探す",
  },
] as const;

export function DocsHome({
  onOpenCategory,
  questionPanel,
}: {
  onOpenCategory: (category: DocsCategory) => void;
  questionPanel?: ReactNode;
}): ReactNode {
  return (
    <section
      className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12"
      aria-labelledby="docs-home-title"
      data-testid="docs-home"
    >
      <header className="flex max-w-2xl flex-col gap-3">
        <h1 id="docs-home-title" className="font-heading text-2xl font-semibold tracking-tight">
          ドキュメント
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          aidlc-workflows の公式情報と、AIDLC Guide 拡張機能の使い方をまとめています。
          調べたい内容に合わせて、ドキュメントを選んでください。
        </p>
      </header>

      {questionPanel}
      <div className="grid gap-4 md:grid-cols-2">
        {CATEGORIES.map(({ id, title, description, icon: Icon, topics, action }) => (
          <Card key={id}>
            <CardHeader className="gap-3">
              <CardTitle className="flex items-center gap-3">
                <Icon aria-hidden="true" />
                <h2>{title}</h2>
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="flex list-disc flex-col gap-2 pl-4 text-sm leading-relaxed text-muted-foreground">
                {topics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => onOpenCategory(id)}>
                {action}
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}

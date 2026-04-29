import { TemplateSearch } from "@/components/template-search";

export default function TemplatesPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-semibold">Discover Meme Templates</h1>
      <p className="text-zinc-400">Pinterest-style blacked out wall with fuzzy finder and expandable images.</p>
      <TemplateSearch />
    </main>
  );
}

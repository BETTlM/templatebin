import { TemplateSearch } from "@/components/template-search";
import { TemplateUpload } from "@/components/template-upload";

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
      <header className="mb-5 flex items-center justify-between rounded-2xl border border-zinc-900/80 bg-black/60 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-white" />
          <p className="text-sm font-medium tracking-wide text-zinc-100">Meme Vault</p>
        </div>
        <p className="text-xs text-zinc-500">FYP</p>
      </header>

      <section className="rounded-3xl border border-zinc-900/80 bg-black/45 p-4 backdrop-blur-xl sm:p-5">
        <TemplateSearch />
      </section>

      <TemplateUpload />
    </main>
  );
}

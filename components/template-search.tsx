"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Search, X } from "lucide-react";
import type { MemeTemplate } from "@/lib/types";

const PAGE_SIZE = 24;
type TagCount = { tag: string; count: number };

export function TemplateSearch() {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const [allTags, setAllTags] = useState<TagCount[]>([]);
  const [items, setItems] = useState<MemeTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [expanded, setExpanded] = useState<MemeTemplate | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");
  const [tagBusy, setTagBusy] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const requestCache = useRef(new Map<string, MemeTemplate[]>());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const tagMenuRef = useRef<HTMLDivElement | null>(null);
  const tags = selectedTags;
  const isFyp = !query.trim() && tags.length === 0;
  const filteredTagOptions = useMemo(() => {
    const needle = tagQuery.trim().toLowerCase();
    return allTags
      .filter((entry) => !selectedTags.includes(entry.tag))
      .filter((entry) => (needle ? entry.tag.includes(needle) : true))
      .slice(0, 50);
  }, [allTags, selectedTags, tagQuery]);

  const fetchTags = useCallback(async () => {
    if (allTags.length || loadingTags) return;
    setLoadingTags(true);
    try {
      const response = await fetch("/api/templates/tags");
      const payload = (await response.json()) as { data?: TagCount[] };
      setAllTags(payload.data ?? []);
    } finally {
      setLoadingTags(false);
    }
  }, [allTags.length, loadingTags]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      const cacheKey = isFyp
        ? `/api/templates/recent?offset=0&limit=${PAGE_SIZE}`
        : `/api/templates/search?${new URLSearchParams({
            q: query,
            tags: tags.join(","),
          }).toString()}`;
      const cached = requestCache.current.get(cacheKey);
      if (cached) {
        setItems(cached);
        setPage(1);
        setHasMore(cached.length === PAGE_SIZE);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(cacheKey, { signal: controller.signal });
        const payload = (await response.json()) as { data: MemeTemplate[] };
        const nextItems = payload.data ?? [];
        requestCache.current.set(cacheKey, nextItems);
        setItems(nextItems);
        setPage(1);
        setHasMore(isFyp ? nextItems.length === PAGE_SIZE : false);
      } catch {
        // no-op for aborted request
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [isFyp, query, tags]);

  useEffect(() => {
    if (!showTagMenu) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!tagMenuRef.current?.contains(event.target as Node)) {
        setShowTagMenu(false);
      }
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [showTagMenu]);

  useEffect(() => {
    if (!expanded && !showTagMenu) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (expanded) {
        setExpanded(null);
        return;
      }
      setShowTagMenu(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded, showTagMenu]);

  const openExpanded = (item: MemeTemplate) => {
    setExpanded(item);
    setNewTag("");
    setTagError(null);
  };

  useEffect(() => {
    if (!isFyp || loading || items.length === 0 || !hasMore) return;
    const endpoint = `/api/templates/recent?offset=${PAGE_SIZE}&limit=${PAGE_SIZE}`;
    if (requestCache.current.has(endpoint)) return;

    const run = () => {
      void fetch(endpoint)
        .then((response) => response.json() as Promise<{ data: MemeTemplate[] }>)
        .then((payload) => {
          requestCache.current.set(endpoint, payload.data ?? []);
        })
        .catch(() => {});
    };

    const browserWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (browserWindow.requestIdleCallback && browserWindow.cancelIdleCallback) {
      const idleId = browserWindow.requestIdleCallback(run, { timeout: 1200 });
      return () => browserWindow.cancelIdleCallback?.(idleId);
    }

    const timer = globalThis.setTimeout(run, 250);
    return () => globalThis.clearTimeout(timer);
  }, [hasMore, isFyp, items.length, loading]);

  useEffect(() => {
    if (!isFyp) return;
    if (!hasMore || loading || loadingMore) return;

    const target = sentinelRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        void (async () => {
          setLoadingMore(true);
          try {
            const offset = page * PAGE_SIZE;
            const endpoint = `/api/templates/recent?offset=${offset}&limit=${PAGE_SIZE}`;
            const cached = requestCache.current.get(endpoint);
            const nextItems = cached
              ? cached
              : await fetch(endpoint)
                  .then((response) => response.json() as Promise<{ data: MemeTemplate[] }>)
                  .then((payload) => payload.data ?? []);

            requestCache.current.set(endpoint, nextItems);
            setItems((current) => [...current, ...nextItems]);
            setPage((current) => current + 1);
            setHasMore(nextItems.length === PAGE_SIZE);
          } finally {
            setLoadingMore(false);
          }
        })();
      },
      { rootMargin: "800px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isFyp, loading, loadingMore, page]);

  const onCopyTemplate = async (item: MemeTemplate) => {
    if (!item.preview_url || !navigator.clipboard) return;
    setCopyingId(item.id);
    setCopiedId(null);
    try {
      const response = await fetch(item.preview_url);
      if (!response.ok) throw new Error("Failed to fetch image");
      const blob = await response.blob();

      if ("ClipboardItem" in window && navigator.clipboard.write) {
        const type = blob.type || "image/png";
        const clipboardItem = new ClipboardItem({ [type]: blob });
        await navigator.clipboard.write([clipboardItem]);
      } else {
        await navigator.clipboard.writeText(item.preview_url);
      }

      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 1800);
    } catch {
      setCopiedId(null);
    } finally {
      setCopyingId(null);
    }
  };

  const syncTemplateTags = (templateId: string, tags: string[]) => {
    setItems((current) => current.map((item) => (item.id === templateId ? { ...item, tags } : item)));
    setExpanded((current) => (current && current.id === templateId ? { ...current, tags } : current));
  };

  const addTagToExpanded = async () => {
    if (!expanded) return;
    const tag = newTag.trim();
    if (!tag || tagBusy) return;
    setTagBusy(true);
    setTagError(null);
    try {
      const response = await fetch(`/api/templates/${expanded.id}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag }),
      });
      const payload = (await response.json().catch(() => ({}))) as { tags?: string[]; error?: string };
      if (!response.ok || !payload.tags) {
        throw new Error(payload.error ?? "Failed to add tag");
      }
      syncTemplateTags(expanded.id, payload.tags);
      setNewTag("");
    } catch (error) {
      setTagError(error instanceof Error ? error.message : "Failed to add tag");
    } finally {
      setTagBusy(false);
    }
  };

  const removeTagFromExpanded = async (tag: string) => {
    if (!expanded || tagBusy) return;
    setTagBusy(true);
    setTagError(null);
    try {
      const response = await fetch(`/api/templates/${expanded.id}/tags`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag }),
      });
      const payload = (await response.json().catch(() => ({}))) as { tags?: string[]; error?: string };
      if (!response.ok || !payload.tags) {
        throw new Error(payload.error ?? "Failed to remove tag");
      }
      syncTemplateTags(expanded.id, payload.tags);
    } catch (error) {
      setTagError(error instanceof Error ? error.message : "Failed to remove tag");
    } finally {
      setTagBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      {selectedTags.length ? (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTags((current) => current.filter((item) => item !== tag))}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200"
            >
              {tag}
              <X size={12} />
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-[1fr_220px]">
        <label className="group flex items-center gap-2 rounded-xl border border-zinc-800/90 bg-zinc-950/70 px-3 py-2 focus-within:border-zinc-600">
          <Search size={16} className="text-zinc-500 group-focus-within:text-zinc-300" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search templates"
            className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
        </label>
        <div ref={tagMenuRef} className="relative">
          <input
            value={tagQuery}
            onFocus={() => {
              setShowTagMenu(true);
              void fetchTags();
            }}
            onChange={(event) => {
              setTagQuery(event.target.value);
              if (!showTagMenu) setShowTagMenu(true);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              if (!filteredTagOptions.length) return;
              event.preventDefault();
              const first = filteredTagOptions[0]!;
              setSelectedTags((current) => [...current, first.tag]);
              setTagQuery("");
            }}
            placeholder="Tags"
            className="w-full rounded-xl border border-zinc-800/90 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-600"
          />
          {showTagMenu ? (
            <div className="absolute z-30 mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-xl shadow-black">
              <div className="max-h-56 overflow-auto pr-1">
                {loadingTags ? <p className="px-2 py-1 text-xs text-zinc-500">Loading tags...</p> : null}
                {!loadingTags && filteredTagOptions.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-zinc-500">No tags</p>
                ) : null}
                {filteredTagOptions.map((entry) => (
                  <button
                    key={entry.tag}
                    type="button"
                    onClick={() => {
                      setSelectedTags((current) => [...current, entry.tag]);
                      setTagQuery("");
                    }}
                    className="mb-1 inline-flex w-full items-center justify-between rounded-lg border border-zinc-800 px-2 py-1.5 text-left text-xs text-zinc-200 transition hover:border-zinc-600"
                  >
                    <span>{entry.tag}</span>
                    <span className="text-zinc-500">{entry.count}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="columns-1 gap-4 sm:columns-2 xl:columns-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="mb-4 h-56 break-inside-avoid animate-pulse rounded-2xl border border-zinc-800/80 bg-zinc-900/60"
            />
          ))}
        </div>
      ) : null}
      <div className="columns-1 gap-4 sm:columns-2 xl:columns-4">
        {items.map((item, index) => (
          <article
            key={item.id}
            className="group mb-4 break-inside-avoid rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-2.5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition hover:border-zinc-700/90"
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => openExpanded(item)}
                className="w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-black"
              >
                {item.preview_url ? (
                  <Image
                    src={item.preview_url}
                    alt={item.title}
                    width={item.width ?? 1200}
                    height={item.height ?? 1200}
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                    loading={index < 2 ? "eager" : "lazy"}
                    priority={index < 2}
                    unoptimized
                    className="h-auto w-full object-cover"
                  />
                ) : (
                  <div className="flex min-h-40 items-center justify-center text-sm text-zinc-500">No preview</div>
                )}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void onCopyTemplate(item);
                }}
                className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border border-zinc-700/80 bg-black/80 px-2 py-1 text-[11px] text-zinc-100 opacity-0 transition group-hover:opacity-100 hover:border-zinc-500"
              >
                {copiedId === item.id ? <Check size={12} /> : <Copy size={12} />}
                {copyingId === item.id ? "Copying" : copiedId === item.id ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="px-1 pb-1">
              <h3 className="mt-2.5 line-clamp-1 text-sm font-medium text-zinc-100">{item.title}</h3>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="line-clamp-1 text-[11px] text-zinc-500">
                  {item.uploader_name?.trim() ? item.uploader_name : "anonymous"}
                </p>
                <a
                  className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 transition hover:border-zinc-500"
                  href={`/api/templates/${item.id}/download`}
                  download
                >
                  Download
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
      {isFyp ? <div ref={sentinelRef} className="h-4" /> : null}
      {loadingMore ? <p className="text-xs text-zinc-500">Loading more...</p> : null}

      {expanded ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="grid w-full max-w-6xl gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black md:grid-cols-[1fr_280px]">
            <div className="flex min-h-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-black p-2">
              {expanded.preview_url ? (
                <Image
                  src={expanded.preview_url}
                  alt={expanded.title}
                  width={expanded.width ?? 1600}
                  height={expanded.height ?? 1600}
                  sizes="(max-width: 1024px) 90vw, 70vw"
                  unoptimized
                  className="max-h-[78vh] w-auto max-w-full rounded-lg object-contain"
                />
              ) : null}
            </div>

            <aside className="flex max-h-[78vh] flex-col overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-zinc-100">{expanded.title}</h3>
                <button
                  type="button"
                  onClick={() => setExpanded(null)}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-sm text-zinc-300 transition hover:border-zinc-500"
                >
                  Close
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <p className="text-zinc-300">
                  <span className="text-zinc-500">Uploader: </span>
                  {expanded.uploader_name?.trim() ? expanded.uploader_name : "anon"}
                </p>
                <div>
                  <p className="mb-1 text-zinc-500">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {expanded.tags.length ? (
                      expanded.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => void removeTagFromExpanded(tag)}
                          disabled={tagBusy}
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                          title="Remove tag"
                        >
                          {tag}
                          <X size={11} />
                        </button>
                      ))
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={newTag}
                      onChange={(event) => setNewTag(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        void addTagToExpanded();
                      }}
                      placeholder="Add tag"
                      className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={() => void addTagToExpanded()}
                      disabled={tagBusy || !newTag.trim()}
                      className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-100 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {tagBusy ? "..." : "Add"}
                    </button>
                  </div>
                </div>
                <p className="text-zinc-300">
                  <span className="text-zinc-500">Type: </span>
                  {expanded.mime_type}
                </p>
                <p className="text-zinc-300">
                  <span className="text-zinc-500">Dimensions: </span>
                  {expanded.width && expanded.height ? `${expanded.width} x ${expanded.height}` : "Unknown"}
                </p>
                <p className="text-zinc-300">
                  <span className="text-zinc-500">Downloads: </span>
                  {expanded.download_count}
                </p>
                <p className="text-zinc-300">
                  <span className="text-zinc-500">Added: </span>
                  {new Date(expanded.created_at).toLocaleString()}
                </p>
              </div>
              {tagError ? <p className="mt-2 text-xs text-rose-300">{tagError}</p> : null}

              <a
                className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-100 transition hover:border-zinc-500"
                href={`/api/templates/${expanded.id}/download`}
                download
              >
                Download
              </a>
            </aside>
          </div>
        </div>
      ) : null}
    </section>
  );
}

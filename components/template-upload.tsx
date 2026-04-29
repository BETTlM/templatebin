"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

type UploadState = {
  loading: boolean;
  error: string | null;
  success: string | null;
};

export function TemplateUpload() {
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [uploaderName, setUploaderName] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [state, setState] = useState<UploadState>({ loading: false, error: null, success: null });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const setFileWithPreview = useCallback((file: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setSelectedFile(file);
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
  }, []);

  const uploadFile = useCallback(async () => {
    if (!selectedFile) return;
    setState({ loading: true, error: null, success: null });
    try {
      const formData = new FormData();
      formData.set("file", selectedFile);
      formData.set("title", title || selectedFile.name.replace(/\.[^.]+$/, ""));
      formData.set("tags", tags);
      formData.set("uploaderName", uploaderName);

      const response = await fetch("/api/templates/upload", { method: "POST", body: formData });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Upload failed");
      }

      setState({ loading: false, error: null, success: "Template uploaded." });
      setFileWithPreview(null);
      setOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setState({ loading: false, error: message, success: null });
    }
  }, [selectedFile, title, tags, uploaderName, setFileWithPreview]);

  const pickFromClipboardItems = useCallback((items: DataTransferItemList) => {
    const imageItem = Array.from(items).find((item) => item.type.startsWith("image/"));
    if (!imageItem) return false;

    const file = imageItem.getAsFile();
    if (!file) return false;

    setFileWithPreview(new File([file], `clipboard-${Date.now()}.png`, { type: file.type || "image/png" }));
    setState({ loading: false, error: null, success: null });
    return true;
  }, [setFileWithPreview]);

  const onPaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!pickFromClipboardItems(event.clipboardData.items)) return;
    event.preventDefault();
  }, [pickFromClipboardItems]);

  useEffect(() => {
    if (!open) return;

    const handleWindowPaste = (event: ClipboardEvent) => {
      if (!event.clipboardData) return;
      const hasImage = Array.from(event.clipboardData.items).some((item) => item.type.startsWith("image/"));
      if (!hasImage) return;

      event.preventDefault();
      pickFromClipboardItems(event.clipboardData.items);
    };

    window.addEventListener("paste", handleWindowPaste);
    return () => {
      window.removeEventListener("paste", handleWindowPaste);
    };
  }, [open, pickFromClipboardItems]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== "Enter") return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      const isFormControl = tagName === "input" || tagName === "textarea" || tagName === "select";
      if (!isFormControl) return;
      if (target instanceof HTMLInputElement && target.type === "file") return;
      if (!selectedFile || state.loading) return;

      event.preventDefault();
      void uploadFile();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedFile, state.loading, uploadFile]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-5 bottom-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-zinc-200/70 bg-white text-black shadow-2xl shadow-black/70 transition hover:scale-105 hover:bg-zinc-100"
        aria-label="Upload template"
      >
        <Plus size={22} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
          <section
            onPaste={onPaste}
            className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950/95 p-5 shadow-2xl shadow-black"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-100">New template</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:border-zinc-500"
              >
                Close
              </button>
            </div>

            <div className="grid gap-3">
              <input
                className="rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm outline-none focus:border-zinc-600"
                placeholder="Name"
                value={uploaderName}
                onChange={(event) => setUploaderName(event.target.value)}
                maxLength={40}
              />
              <input
                className="rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm outline-none focus:border-zinc-600"
                placeholder="Title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <input
                className="rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm outline-none focus:border-zinc-600"
                placeholder="Tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="rounded-lg border border-dashed border-zinc-700 p-3 text-sm"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setFileWithPreview(file);
                  setState({ loading: false, error: null, success: null });
                }}
              />
              {selectedFile ? (
                <p className="text-xs text-zinc-500">Selected: {selectedFile.name}</p>
              ) : null}
              {previewUrl ? (
                <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
                  <img src={previewUrl} alt="Selected template preview" className="h-auto max-h-56 w-full object-contain" />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => void uploadFile()}
                disabled={!selectedFile || state.loading}
                className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
              >
                {state.loading ? "Uploading..." : "Upload"}
              </button>
            </div>

            {state.error ? <p className="mt-3 text-xs text-rose-300">{state.error}</p> : null}
            {state.success ? <p className="mt-3 text-xs text-emerald-300">{state.success}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

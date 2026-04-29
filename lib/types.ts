export type MemeTemplate = {
  id: string;
  title: string;
  tags: string[];
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  uploader_name: string | null;
  download_count: number;
  created_at: string;
  preview_url?: string;
};

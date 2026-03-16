"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

export function DownloadDocumentButton({ documentId }: { documentId: string }) {
  const [loading, setLoading] = React.useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/download`);
      const json = await res.json();
      if (!res.ok || !json?.data?.downloadUrl) return;
      window.open(json.data.downloadUrl, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleDownload} disabled={loading}>
      {loading ? "Preparing..." : "Download"}
    </Button>
  );
}

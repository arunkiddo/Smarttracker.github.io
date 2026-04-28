import { UploadCloud } from "lucide-react";
import type { CategoryRule, ImportResult, Transaction } from "../../types";
import { parseStatementFile } from "./parser";

interface FileImporterProps {
  transactions: Transaction[];
  rules: CategoryRule[];
  onImported: (result: ImportResult) => Promise<void>;
  isImporting: boolean;
  setIsImporting: (value: boolean) => void;
}

export function FileImporter({
  transactions,
  rules,
  onImported,
  isImporting,
  setIsImporting,
}: FileImporterProps) {
  async function handleFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setIsImporting(true);
    try {
      for (const file of Array.from(files)) {
        const result = await parseStatementFile(file, transactions, rules);
        await onImported(result);
      }
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <label className="upload-card">
      <UploadCloud aria-hidden="true" />
      <span className="upload-title">Upload bank statement</span>
      <span className="upload-copy">Supports XLS, XLSX, PDF, TXT. Data stays in this browser.</span>
      <input
        accept=".xls,.xlsx,.pdf,.txt,.csv"
        disabled={isImporting}
        multiple
        onChange={(event) => void handleFiles(event.target.files)}
        type="file"
      />
      <span className="button-like">{isImporting ? "Importing..." : "Choose files"}</span>
    </label>
  );
}

import { useState } from "react";
import type { ResumeResult } from "../types";
import ResumeModal from "./ResumeModal";

interface Props {
  results: ResumeResult[];
}

export default function ResumeRanking({ results }: Props) {
  const [open, setOpen] = useState<ResumeResult | null>(null);

  return (
    <>
      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-500 mb-2">
          Top {results.length} candidates by semantic match
        </p>
        <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {results.map((r, i) => (
            <div
              key={r.ID}
              className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50"
            >
              <span className="w-6 text-right text-xs text-gray-400 shrink-0">
                {i + 1}
              </span>
              <span className="flex-1 truncate text-sm text-gray-700">
                {r.Category}
              </span>
              <button
                onClick={() => setOpen(r)}
                className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
              >
                ID {r.ID}
              </button>
              <span className="w-12 text-right text-xs tabular-nums text-gray-400 shrink-0">
                {r.score.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {open && <ResumeModal resume={open} onClose={() => setOpen(null)} />}
    </>
  );
}

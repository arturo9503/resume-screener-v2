import type { Posting } from "../types";

interface Props {
  postings: Posting[];
  selected: Posting | null;
  onSelect: (posting: Posting | null) => void;
}

export default function JobSelector({ postings, selected, onSelect }: Props) {
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = Number(e.target.value);
    onSelect(id === -1 ? null : postings.find((p) => p.job_id === id) ?? null);
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Job Posting
      </label>
      <select
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        value={selected?.job_id ?? -1}
        onChange={handleChange}
      >
        <option value={-1}>— Select a posting —</option>
        {postings.map((p) => (
          <option key={p.job_id} value={p.job_id}>
            {p.title} @ {p.company_name}
          </option>
        ))}
      </select>

      {selected && (
        <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600 space-y-1">
          {selected.location && (
            <p className="text-xs text-gray-400">{selected.location}</p>
          )}
          <details className="cursor-pointer">
            <summary className="text-xs font-medium text-gray-500 select-none">
              Job description
            </summary>
            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed">
              {selected.description}
            </p>
          </details>
        </div>
      )}
    </div>
  );
}

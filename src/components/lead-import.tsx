"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { Upload, Download } from "lucide-react";
import { DuplicateChoice, LeadImport } from "@/lib/domain";
import {
  ParsedFile,
  Mapping,
  importFields,
  suggestMapping,
  mappingErrors,
  validateRows,
  MAX_BYTES,
  templateRow,
} from "@/lib/lead-import";
import { downloadCsv, date } from "@/lib/format";
import { useData } from "./data-context";
import { Modal, Empty, Badge, Confirm } from "./ui";
const steps = [
  "Upload File",
  "Preview Data",
  "Map Fields",
  "Validate Records",
  "Handle Duplicates",
  "Confirm Import",
  "Import Results",
];
export function DownloadTemplate() {
  return (
    <button
      className="button small"
      onClick={() => downloadCsv([templateRow], "designmela-lead-template.csv")}
    >
      <Download size={15} />
      Download Template
    </button>
  );
}
export function ImportWizard({ onClose }: { onClose: () => void }) {
  const { data, provider, mutate, busy } = useData();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState("");
  const [size, setSize] = useState(0);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [allowRead, setAllowRead] = useState(false);
  const [validOnly, setValidOnly] = useState(false);
  const [strategy, setStrategy] = useState<DuplicateChoice | "review">("skip");
  const [choices, setChoices] = useState<Record<number, DuplicateChoice>>({});
  const [targets, setTargets] = useState<Record<number, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<LeadImport | null>(null);
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      worker.current?.terminate();
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const mappedErrors = mappingErrors(mapping);
  const validated = useMemo(()=>parsed && data && !mappingErrors(mapping).length ? validateRows(parsed,mapping,data.leads):[],[parsed,mapping,data]);
  if (!data) return null;
  const invalid = validated.filter((r) => r.errors.length);
  const conflicts = validated.filter(
    (r) => !r.errors.length && (r.matches.length || r.fileDuplicate),
  );
  function select(f: File | undefined) {
    setError("");
    setAllowRead(false);
    if (!f) return;
    if (!/\.(csv|xlsx|xls)$/i.test(f.name) || f.size > MAX_BYTES || !f.size) {
      setError("Choose CSV, XLSX or XLS, non-empty and no larger than 5 MB.");
      setFile(null);
      return;
    }
    setFile(f);
    setFilename(f.name);
    setSize(f.size);
  }
  async function process() {
    if (!file || !allowRead) return;
    setReading(true);
    setError("");
    try {
      const buffer = await file.arrayBuffer();
      const w = new Worker(new URL("../lib/import.worker.ts", import.meta.url));
      worker.current = w;
      const finish = () => {
        w.terminate();
        if (timer.current) clearTimeout(timer.current);
        setReading(false);
      };
      timer.current = setTimeout(() => {
        finish();
        setError("Parsing exceeded 15 seconds. Try a smaller file.");
      }, 15000);
      w.onerror = () => {
        finish();
        setError(
          "Could not parse the file. Try UTF-8 CSV or an unencrypted Excel workbook.",
        );
      };
      w.onmessage = (
        e: MessageEvent<{ result?: ParsedFile; error?: string }>,
      ) => {
        finish();
        if (e.data.error) {
          setError(e.data.error);
          return;
        }
        setParsed(e.data.result!);
        setMapping(suggestMapping(e.data.result!.headers));
        setFile(null);
        setStep(1);
      };
      w.postMessage({ buffer, filename: file.name }, [buffer]);
    } catch {
      setReading(false);
      setError("Could not read this file.");
    }
  }
  async function commit() {
    setError("");
    if (!confirmed) return;
    const success = await mutate(async () => {
      setResult(
        await provider.importLeads({
          filename,
          rows: validated,
          strategy,
          choices,
          targets,
          validOnly,
          confirmed,
        }),
      );
    }, "Import completed. Review the row report.");
    if (success) {
      setParsed(null);
      setStep(6);
    } else
      setError(
        "Import could not be committed. Review duplicate decisions and validation. No partial import was saved.",
      );
  }
  const unresolved = conflicts.some(
    (r) =>
      (strategy === "review" && !choices[r.rowNumber]) ||
      ((strategy === "update" ||
        (strategy === "review" && choices[r.rowNumber] === "update")) &&
        r.matches.length > 1 &&
        !targets[r.rowNumber]),
  );
  return (
    <Modal title="Import Leads" onClose={onClose} wide>
      <ol className="import-steps">
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={step === i ? "step" : undefined}
            className={step === i ? "current" : ""}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <p className="notice">
        Demo Mode: fictional files only. Processing is local to this browser;
        original files are never uploaded or retained. Reloading clears imports.
      </p>
      {step === 0 && (
        <>
          <div
            className="drop-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              select(e.dataTransfer.files[0]);
            }}
          >
            <Upload size={25} />
            <strong>Drop a lead spreadsheet here</strong>
            <label>
              Choose file
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => select(e.target.files?.[0])}
              />
            </label>
            <p>5 MB · 2,000 records · 60 columns · first worksheet only</p>
          </div>
          {file && (
            <p>
              {filename} · {(size / 1024).toFixed(1)} KB · record count detected
              after confirmed processing
            </p>
          )}
          <label className="check-label">
            <input
              type="checkbox"
              checked={allowRead}
              onChange={(e) => setAllowRead(e.target.checked)}
            />
            I confirm local processing of this fictional file.
          </label>
          <button
            className="button primary spaced"
            disabled={!file || !allowRead || reading}
            onClick={process}
          >
            {reading ? "Reading locally…" : "Process file locally"}
          </button>
          <p className="muted">
            <a
              href="/lead-import-instructions.txt"
              target="_blank"
              rel="noopener noreferrer"
            >
              Field instructions for Excel users ↗
            </a>
          </p>
          <DownloadTemplate />
        </>
      )}
      {parsed && step >= 1 && step <= 5 && (
        <p className="muted">
          {filename} · {(size / 1024).toFixed(1)} KB · {parsed.rows.length}{" "}
          detected records · worksheet: {parsed.sheetName}
        </p>
      )}
      {parsed && step === 1 && (
        <>
          <h3>Preview · first 10 rows</h3>
          <div className="table-scroll import-preview">
            <table>
              <thead>
                <tr>
                  {parsed.headers.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    {r.map((v, j) => (
                      <td key={j}>{v || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">
            Values are displayed as plain text. Formula cells will be rejected.
          </p>
        </>
      )}
      {parsed && step === 2 && (
        <>
          <p>
            Map Full name, or First name (Last name optional). Company and all
            other fields are optional. Empty source defaults to CSV/Excel
            Import.
          </p>
          <div className="mapping-grid">
            {parsed.headers.map((h) => (
              <label key={h}>
                {h}
                <select
                  value={mapping[h] ?? ""}
                  onChange={(e) =>
                    setMapping({
                      ...mapping,
                      [h]: e.target.value as Mapping[string],
                    })
                  }
                >
                  <option value="">Ignore</option>
                  {importFields.map((f) => (
                    <option key={f} value={f}>
                      {f.replace(/([A-Z])/g, " $1")}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {mappedErrors.map((e) => (
            <p role="alert" className="error-text" key={e}>
              {e}
            </p>
          ))}
        </>
      )}
      {step === 3 && (
        <>
          <h3>
            {validated.length - invalid.length} valid · {invalid.length} invalid
          </h3>
          {invalid.length > 0 && (
            <>
              <button
                className="button small"
                onClick={() =>
                  downloadCsv(
                    invalid.map((r) => ({
                      row: r.rowNumber,
                      ...Object.fromEntries(
                        parsed!.headers.map((h, i) => [
                          h,
                          parsed!.rows[r.rowNumber - 2][i],
                        ]),
                      ),
                      errors: r.errors.join("; "),
                    })),
                    "designmela-invalid-rows.csv",
                  )
                }
              >
                Download invalid rows CSV
              </button>
              <div className="import-errors">
                {invalid.map((r) => (
                  <p key={r.rowNumber}>
                    <strong>Row {r.rowNumber}</strong>: {r.errors.join("; ")}
                  </p>
                ))}
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={validOnly}
                  onChange={(e) => setValidOnly(e.target.checked)}
                />
                Import valid rows only; report invalid rows as failed.
              </label>
            </>
          )}
          <button className="text-button" onClick={() => setStep(2)}>
            Correct mapped fields
          </button>
          <p className="muted">
            To fix cell values, cancel, correct the original file and select it
            again.
          </p>
        </>
      )}
      {step === 4 && (
        <>
          <h3>{conflicts.length} potential duplicate rows</h3>
          <label>
            Duplicate handling
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as typeof strategy)}
            >
              <option value="skip">Skip duplicates</option>
              <option value="update">Update existing records</option>
              <option value="separate">Create as separate records</option>
              <option value="review">Review each conflict</option>
            </select>
          </label>
          <p className="notice">
            Updating changes mapped fields, including mapped blanks. Existing
            notes are preserved and incoming notes appended. Activities and
            original source attribution are never overwritten. Updates cannot be
            undone by Undo Import.
          </p>
          <div className="import-errors">
            {conflicts.map((r) => (
              <div className="conflict-row" key={r.rowNumber}>
                <strong>
                  Row {r.rowNumber} · {r.lead.name}
                </strong>
                <p>
                  {r.matches.map((m) => `${m.reason}: ${m.name}`).join(" / ")}
                  {r.fileDuplicate
                    ? ` · Matches file row ${r.fileDuplicate}`
                    : ""}
                </p>
                {strategy === "review" && (
                  <label>
                    Decision for row {r.rowNumber}
                    <select
                      value={choices[r.rowNumber] ?? ""}
                      onChange={(e) =>
                        setChoices({
                          ...choices,
                          [r.rowNumber]: e.target.value as DuplicateChoice,
                        })
                      }
                    >
                      <option value="">Choose…</option>
                      <option value="skip">Skip</option>
                      <option value="update">Update</option>
                      <option value="separate">Create separately</option>
                    </select>
                  </label>
                )}
                {r.matches.length > 1 && (
                  <label>
                    Update target for row {r.rowNumber}
                    <select
                      value={targets[r.rowNumber] ?? ""}
                      onChange={(e) =>
                        setTargets({
                          ...targets,
                          [r.rowNumber]: e.target.value,
                        })
                      }
                    >
                      <option value="">Choose target…</option>
                      {r.matches.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.reason})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            ))}
          </div>
          {unresolved && (
            <p className="error-text">
              Resolve all conflicts before continuing.
            </p>
          )}
        </>
      )}
      {step === 5 && (
        <>
          <h3>Ready to import?</h3>
          <p>
            {validated.length} total rows · {invalid.length} invalid ·{" "}
            {conflicts.length} potential duplicates · strategy: {strategy}
          </p>
          <p>
            No CRM records change until you confirm below. Results will
            distinguish created, updated, skipped and failed rows.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm this fictional import and the duplicate-handling choices.
          </label>
          <button
            className="button primary spaced"
            disabled={!confirmed || busy}
            onClick={commit}
          >
            Confirm Import
          </button>
        </>
      )}
      {step === 6 && result && <ImportReport report={result} />}{" "}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="button" onClick={onClose}>
          {step === 6 ? "Done" : "Cancel import"}
        </button>
        {step > 1 && step < 6 && (
          <button
            className="button"
            onClick={() => {
              setError("");
              setStep(step - 1);
            }}
          >
            Back
          </button>
        )}
        {step >= 1 && step < 5 && (
          <button
            className="button primary"
            disabled={
              (step === 2 && !!mappedErrors.length) ||
              (step === 3 &&
                (!validated.some((r) => !r.errors.length) ||
                  (!!invalid.length && !validOnly))) ||
              (step === 4 && unresolved)
            }
            onClick={() => setStep(step + 1)}
          >
            Continue
          </button>
        )}
      </div>
    </Modal>
  );
}
function ImportReport({ report }: { report: LeadImport }) {
  return (
    <>
      <h3>
        Import report <Badge>{report.status}</Badge>
      </h3>
      <p>
        {report.successfulRows} created · {report.updatedRows} updated ·{" "}
        {report.skippedRows} skipped · {report.failedRows} failed
      </p>
      <p className="muted">
        ID: {report.id} · {report.filename} · by {report.importedBy}
      </p>
      {report.undoSummary && <p role="status">Undo results: {report.undoSummary.deleted} deleted · {report.undoSummary.preserved} preserved · {report.undoSummary.skipped} skipped · {report.undoSummary.failed} failed. Failed undo checks preserve the lead.</p>}
      <button
        className="button small"
        onClick={() =>
          downloadCsv(
            report.rows.map(({ createdVersion: _snapshot, ...r }) => {
              void _snapshot;
              return r;
            }),
            "designmela-import-report.csv",
          )
        }
      >
        Download import report
      </button>
      <div className="import-errors">
        {report.rows.map((r) => (
          <p key={r.rowNumber}>
            <strong>
              Row {r.rowNumber}: {r.status}
            </strong>{" "}
            · {r.message}
            {r.undoOutcome && <span> · Undo: {r.undoOutcome} — {r.undoMessage}</span>}
          </p>
        ))}
      </div>
    </>
  );
}
export function ImportHistory({ onClose }: { onClose: () => void }) {
  const { data, provider, mutate, busy } = useData();
  const [id, setId] = useState<string | null>(null);
  const [undo, setUndo] = useState<string | null>(null);
  const report = data?.imports.find((r) => r.id === id);
  if (!data) return null;
  return (
    <>
      <Modal title="Import History" onClose={onClose} wide>
        {!data.imports.length ? (
          <Empty
            title="No imports yet"
            text="Confirmed imports and row reports will appear here."
          />
        ) : (
          data.imports
            .slice()
            .reverse()
            .map((r) => (
              <div className="workflow-row" key={r.id}>
                <div>
                  <strong>{r.filename}</strong>
                  <small>
                    {date(r.createdAt, data.settings.timeZone, true)} ·{" "}
                    {r.importedBy} · {r.id}
                  </small>
                  <p>
                    {r.totalRows} total · {r.successfulRows} created ·{" "}
                    {r.updatedRows} updated · {r.skippedRows} skipped ·{" "}
                    {r.failedRows} failed
                  </p>
                  <Badge>{r.status}</Badge>
                </div>
                <div className="button-group">
                  <button className="button small" onClick={() => setId(r.id)}>
                    View report
                  </button>
                  <button
                    className="button small"
                    disabled={
                      busy ||
                      ["Undone", "Partially undone"].includes(r.status) ||
                      !r.successfulRows
                    }
                    onClick={() => setUndo(r.id)}
                  >
                    Undo Import
                  </button>
                </div>
              </div>
            ))
        )}
        {report && <ImportReport report={report} />}
      </Modal>
      {undo && (
        <Confirm
          title="Undo imported creations?"
          text="Only unchanged records created by this import can be removed. Edited or connected records are retained. Updates to pre-existing records are never undone."
          busy={busy}
          onClose={() => setUndo(null)}
          onConfirm={async () => {
            if (
              await mutate(
                () => provider.undoLeadImport(undo),
                "Undo reviewed. See the import report for retained records.",
              )
            )
              setUndo(null);
          }}
        />
      )}
    </>
  );
}

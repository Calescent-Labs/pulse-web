import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, X } from "lucide-react";

/**
 * MomentPicker — small popover above the moment scrubber's timestamp.
 *
 * Lets a user jump the map to a specific date/time within the last 30 days
 * without dragging the slider. Uses a native <input type="datetime-local">
 * so the browser supplies the calendar + time picker for free (works on
 * desktop and mobile). All internal math is done in UTC to match the
 * scrubber display, but the input surface is local time because that is
 * what users think in — the display below the input previews the exact
 * UTC value that will be applied.
 *
 * Props:
 *   valueHoursAgo  number   — current scrubber value, 0…720 (h back from now)
 *   maxHoursAgo    number   — hard cap on how far back we let the user jump
 *   onCommit       (hours)  — commit picked value in hours-ago
 *   onNow          ()       — shortcut back to now (hours = 0)
 *   onClose        ()       — dismiss without change
 */
function fmtLocalForInput(date) {
  // datetime-local wants "YYYY-MM-DDTHH:mm" in *local* time, no timezone.
  const pad = (n) => String(n).padStart(2, "0");
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );
}

function fmtUtcStamp(date) {
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function MomentPicker({ valueHoursAgo, maxHoursAgo = 720, onCommit, onNow, onClose }) {
  const rootRef = useRef(null);

  // Convert the current scrubber value → the datetime it represents.
  const initialDate = useMemo(
    () => new Date(Date.now() - valueHoursAgo * 3600000),
    [valueHoursAgo],
  );
  const [inputValue, setInputValue] = useState(() => fmtLocalForInput(initialDate));

  const minDate = useMemo(() => new Date(Date.now() - maxHoursAgo * 3600000), [maxHoursAgo]);
  const maxDate = useMemo(() => new Date(), []);

  // Live preview of what the picked local datetime resolves to in UTC —
  // and whether it is within the allowed window.
  const preview = useMemo(() => {
    const picked = new Date(inputValue);
    if (Number.isNaN(picked.getTime())) {
      return { valid: false, utc: "—", hoursAgo: null, outOfRange: false };
    }
    const now = Date.now();
    const hoursAgo = (now - picked.getTime()) / 3600000;
    const outOfRange = hoursAgo < 0 || hoursAgo > maxHoursAgo;
    return {
      valid: true,
      utc: fmtUtcStamp(picked),
      hoursAgo,
      outOfRange,
    };
  }, [inputValue, maxHoursAgo]);

  // Outside-click + Escape dismiss.
  useEffect(() => {
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose && onClose();
    }
    function onKey(e) {
      if (e.key === "Escape") onClose && onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const commit = () => {
    if (!preview.valid || preview.outOfRange) return;
    const clamped = Math.max(0, Math.min(maxHoursAgo, Math.round(preview.hoursAgo)));
    onCommit(clamped);
  };

  return (
    <div
      ref={rootRef}
      data-testid="moment-picker"
      role="dialog"
      aria-label="Jump to a specific moment"
      className="absolute bottom-full right-0 mb-2 w-[280px] rounded-sm border hairline bg-background/95 p-3 shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.18em] text-[hsl(25,95%,60%)]">
          <CalendarClock className="h-3 w-3" />
          <span>jump to a moment</span>
        </div>
        <button
          type="button"
          data-testid="moment-picker-close"
          aria-label="Close"
          onClick={onClose}
          className="-mt-0.5 -mr-1 rounded-sm p-0.5 text-muted-foreground hover:bg-secondary hover:text-neutral-100"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <p className="mt-2 mono text-[10px] text-muted-foreground normal-case tracking-normal leading-relaxed">
        Pick any hour in the last {Math.round(maxHoursAgo / 24)} days. Times are entered in your local
        timezone and applied as the equivalent UTC instant.
      </p>

      <input
        type="datetime-local"
        data-testid="moment-picker-input"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        min={fmtLocalForInput(minDate)}
        max={fmtLocalForInput(maxDate)}
        step={60}
        className="mt-3 w-full rounded-sm border hairline bg-background/60 px-2 py-1.5 mono text-[11px] text-neutral-100 focus:border-[hsl(25,95%,60%)] focus:outline-none"
      />

      <div className="mt-2 mono text-[10px] text-muted-foreground normal-case tracking-normal">
        {preview.valid ? (
          <>
            <span className="text-neutral-500">applies as</span>{" "}
            <span className="text-neutral-200">{preview.utc}</span>
            {preview.outOfRange && (
              <span className="ml-1.5 text-[hsl(0,80%,60%)]">· outside window</span>
            )}
          </>
        ) : (
          <span className="text-[hsl(0,80%,60%)]">pick a valid date & time</span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          data-testid="moment-picker-now"
          onClick={() => onNow && onNow()}
          className="rounded-sm border hairline bg-background/60 px-2.5 py-1 mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-neutral-100"
          title="Return to the live map"
        >
          jump to now
        </button>
        <button
          type="button"
          data-testid="moment-picker-commit"
          onClick={commit}
          disabled={!preview.valid || preview.outOfRange}
          className="rounded-sm border hairline bg-[hsl(25,95%,60%)]/10 px-3 py-1 mono text-[10px] uppercase tracking-widest text-[hsl(25,95%,72%)] transition-colors hover:bg-[hsl(25,95%,60%)]/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          set moment
        </button>
      </div>
    </div>
  );
}

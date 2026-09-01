import { useEffect, useRef, useState } from "react";

export function MediaPreview({ file, onRemove, disabled }) {
  const [url, setUrl] = useState("");
  const dialog = useRef(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  const isVideo = file.type.startsWith("video/");
  const close = () => {
    dialog.current?.querySelector("video")?.pause();
    dialog.current?.close();
  };
  return (
    <div className="ve-media-card">
      <button
        type="button"
        className="ve-preview-button"
        disabled={disabled}
        onClick={() => dialog.current?.showModal()}
        aria-label={`Preview ${file.name}`}
      >
        {isVideo ? (
          <video src={url} preload="metadata" muted playsInline />
        ) : (
          <img src={url} alt={file.name} />
        )}
        <span>{isVideo ? "Play video" : "Enlarge photo"}</span>
      </button>
      <div className="ve-file-name" title={file.name}>
        {file.name}
      </div>
      <small>{(file.size / 1024 / 1024).toFixed(1)} MB</small>
      <button
        type="button"
        className="ve-remove"
        disabled={disabled}
        onClick={onRemove}
      >
        Remove
      </button>
      <dialog
        ref={dialog}
        className="ve-preview-dialog"
        aria-label={`Preview ${file.name}`}
        onClose={() => dialog.current?.querySelector("video")?.pause()}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
      >
        <button
          type="button"
          className="secondary-button"
          onClick={close}
          autoFocus
        >
          Close preview
        </button>
        {isVideo ? (
          <>
            <video src={url} controls playsInline preload="metadata" />
            <p>MOV playback depends on your browser. MP4 is recommended.</p>
          </>
        ) : (
          <img src={url} alt={file.name} />
        )}
      </dialog>
    </div>
  );
}

export function ExistingMediaPreview({ item, onRemove, disabled, video = false }) {
  const dialog = useRef(null);
  const close = () => {
    dialog.current?.querySelector("video")?.pause();
    dialog.current?.close();
  };
  return (
    <div className="ve-media-card ve-existing-media">
      <button
        type="button"
        className="ve-preview-button"
        disabled={disabled}
        onClick={() => dialog.current?.showModal()}
      >
        {video ? (
          <video src={item.url} preload="metadata" muted playsInline />
        ) : (
          <img src={item.url} alt={item.filename || "Existing venue media"} />
        )}
        <span>{video ? "Play existing video" : "Enlarge existing photo"}</span>
      </button>
      <div className="ve-file-name" title={item.filename}>{item.filename || "Existing media"}</div>
      <small>Currently saved</small>
      <button type="button" className="ve-remove" disabled={disabled} onClick={onRemove}>
        Remove on save
      </button>
      <dialog ref={dialog} className="ve-preview-dialog" onClick={(event) => {
        if (event.target === dialog.current) close();
      }}>
        <button type="button" className="secondary-button" onClick={close} autoFocus>
          Close preview
        </button>
        {video ? (
          <video src={item.url} controls playsInline preload="metadata" />
        ) : (
          <img src={item.url} alt={item.filename || "Existing venue media"} />
        )}
      </dialog>
    </div>
  );
}

export default function VenueMediaPicker({
  label,
  files,
  onChange,
  maxCount,
  video = false,
  disabled = false,
  onError,
}) {
  const types = video
    ? ["video/mp4", "video/webm", "video/quicktime"]
    : ["image/jpeg", "image/png", "image/webp"];
  const maxMB = video ? 35 : 8;
  function select(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length) return;
    if (
      selected.some(
        (file) => !types.includes(file.type) || file.size > maxMB * 1024 * 1024,
      )
    ) {
      onError(
        `Use ${video ? "MP4, WebM or MOV" : "JPEG, PNG or WebP"} files, at most ${maxMB} MB each.`,
      );
      return;
    }
    const next =
      maxCount === 1 ? selected.slice(0, 1) : [...files, ...selected];
    if (next.length > maxCount) {
      onError(`Select at most ${maxCount} files for ${label}.`);
      return;
    }
    onError("");
    onChange(next);
  }
  return (
    <div className="ve-media-picker">
      <label>
        <strong>{label}</strong>
        <input
          type="file"
          accept={types.join(",")}
          multiple={maxCount > 1}
          disabled={disabled}
          onChange={select}
        />
      </label>
      <p className="ve-hint">
        {files.length}/{maxCount} selected · {maxMB} MB maximum per file.{" "}
        {maxCount === 1
          ? "Choose another file to replace it."
          : "You can add files in batches."}
      </p>
      <div className="ve-media-grid">
        {files.map((file, index) => (
          <MediaPreview
            key={`${file.name}-${file.lastModified}-${index}`}
            file={file}
            disabled={disabled}
            onRemove={() => onChange(files.filter((_, i) => i !== index))}
          />
        ))}
      </div>
    </div>
  );
}

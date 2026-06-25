"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";

interface PhotoUploadProps {
  onFileChange: (file: File | null) => void;
  label?: string;
  maxSizeMB?: number;
}

export default function PhotoUpload({ onFileChange, label = "Upload Case Photo", maxSizeMB = 5 }: PhotoUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    setError(null);
    if (!file) {
      setPreviewUrl(null);
      onFileChange(null);
      return;
    }

    // Validate type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, WEBP).");
      return;
    }

    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File is too large. Max size allowed is ${maxSizeMB}MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    onFileChange(file);
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  const removePhoto = () => {
    setPreviewUrl(null);
    setError(null);
    onFileChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-semibold text-slate-300 mb-2">{label}</label>
      
      {previewUrl ? (
        <div className="relative border border-white/10 rounded-xl overflow-hidden bg-slate-900/60 p-2 flex flex-col items-center">
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-56 w-auto object-contain rounded-lg border border-white/5"
          />
          <button
            type="button"
            onClick={removePhoto}
            className="absolute top-4 right-4 bg-red-600/90 hover:bg-red-600 text-white rounded-full p-2 text-xs font-bold shadow transition"
            title="Remove Photo"
          >
            ❌
          </button>
          <div className="mt-2 text-xs text-slate-400">Selected photo ready for AI biometric matching</div>
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition ${
            dragActive
              ? "border-indigo-500 bg-indigo-500/10"
              : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleChange}
          />
          <span className="text-3xl mb-3">📸</span>
          <p className="text-sm font-medium text-slate-300 text-center">
            Drag & drop your image here, or <span className="text-indigo-400 underline">browse</span>
          </p>
          <p className="text-xs text-slate-500 mt-2">
            PNG, JPG or WEBP (Max {maxSizeMB}MB)
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 mt-2 font-medium">
          ❌ {error}
        </p>
      )}
    </div>
  );
}

"use client";

import imageCompression from "browser-image-compression";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { ActionButtons } from "@/src/components/ActionButtons";
import { Dropzone } from "@/src/components/Dropzone";
import { ToolFrame } from "@/src/components/ToolFrame";
import { downloadUrl, loadImageFile, replaceFileExtension, revokeObjectUrl, type LoadedImageFile } from "@/src/lib/image-tools";

import styles from "./FormatTool.module.css";

const formatOptions = [
  { id: "image/png", label: "PNG", extension: ".png" },
  { id: "image/jpeg", label: "JPEG", extension: ".jpg" },
  { id: "image/webp", label: "WebP", extension: ".webp" },
];

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function FormatTool() {
  const sourceUrlRef = useRef<string | null>(null);

  const [image, setImage] = useState<LoadedImageFile | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<{ width: number; height: number; name: string } | null>(null);

  useEffect(() => {
    return () => {
      revokeObjectUrl(sourceUrlRef.current);
      revokeObjectUrl(resultUrl);
    };
  }, [resultUrl]);

  async function handleFileSelect(fileList: FileList | null) {
    const file = fileList?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("请上传图片文件。");
      return;
    }

    try {
      const nextImage = await loadImageFile(file);
      revokeObjectUrl(sourceUrlRef.current);
      sourceUrlRef.current = nextImage.url;
      revokeObjectUrl(resultUrl);
      setImage(nextImage);
      setSelectedFormat(null);
      setResultUrl(null);
      setResultImage(null);
      setErrorMessage(null);
    } catch {
      setErrorMessage("图片读取失败，请换一张再试。");
    }
  }

  function resetAll() {
    revokeObjectUrl(sourceUrlRef.current);
    sourceUrlRef.current = null;
    revokeObjectUrl(resultUrl);
    setImage(null);
    setSelectedFormat(null);
    setResultUrl(null);
    setResultImage(null);
    setErrorMessage(null);
  }

  async function confirmFormatChange() {
    if (!image || !selectedFormat) {
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);

    try {
      const selected = formatOptions.find((option) => option.id === selectedFormat);
      if (!selected) {
        throw new Error("Unknown format.");
      }

      const convertedFile = await imageCompression(image.file, {
        useWebWorker: true,
        fileType: selected.id,
        initialQuality: 0.92,
      });

      const nextUrl = URL.createObjectURL(convertedFile);
      revokeObjectUrl(resultUrl);
      setResultUrl(nextUrl);
      setResultImage({
        width: image.naturalWidth,
        height: image.naturalHeight,
        name: replaceFileExtension(image.name, selected.extension),
      });
    } catch {
      setErrorMessage("格式转换失败，请重试。");
    } finally {
      setIsConverting(false);
    }
  }

  const footer = resultUrl && resultImage ? (
    <div className={styles.footerStack}>
      <button type="button" onClick={resetAll} className={styles.secondaryButton}>
        重新选择
      </button>
      <button
        type="button"
        onClick={() => downloadUrl(resultUrl, resultImage.name)}
        className={styles.primaryButton}
      >
        下载图片
      </button>
    </div>
  ) : image ? (
    <div className={styles.footerStack}>
      <div className={styles.optionGrid}>
        {formatOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSelectedFormat(option.id)}
            className={joinClasses(styles.optionButton, selectedFormat === option.id && styles.optionButtonActive)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {selectedFormat ? (
        <ActionButtons onCancel={resetAll} onConfirm={confirmFormatChange} confirmLabel={isConverting ? "转换中" : "确认"} disabled={isConverting} />
      ) : null}
    </div>
  ) : null;

  return (
    <ToolFrame title="格式" description="上传图片后选择目标格式，选中任一格式后再确认转换。" footer={footer} note="转换">
      <div className={styles.panel}>
        <div className={styles.statusRow}>
          <span>{image ? image.name : "拖入图片或点击上传"}</span>
          <span>{resultUrl ? "转换完成" : image ? "先选择格式，再点确认" : "支持 PNG / JPEG / WebP"}</span>
        </div>

        <div className={styles.stage}>
          {!image ? (
            <Dropzone
              title="拖入图片开始转换"
              description="上传后选择目标格式，只有选中格式时才会显示确认和取消按钮。"
              onFileSelect={(fileList) => {
                void handleFileSelect(fileList);
              }}
            />
          ) : null}

          {image && !resultUrl ? (
            <div className={styles.previewWrap}>
              <Image src={image.url} alt="待转换图片" width={image.naturalWidth} height={image.naturalHeight} unoptimized className={styles.previewImage} />
              <div className={styles.previewMeta}>
                <p className={styles.previewTitle}>选择输出格式</p>
                <p className={styles.previewDescription}>当前预览保持原图，仅在确认后使用转换插件导出目标格式。</p>
              </div>
            </div>
          ) : null}

          {resultUrl && resultImage ? (
            <div className={styles.previewWrap}>
              <Image src={resultUrl} alt="转换结果" width={resultImage.width} height={resultImage.height} unoptimized className={styles.previewImage} />
              <div className={styles.previewMeta}>
                <p className={styles.previewTitle}>转换完成</p>
                <p className={styles.previewDescription}>结果已经生成，可以直接下载，或回到上一轮重新选择图片。</p>
              </div>
            </div>
          ) : null}
        </div>

        {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
      </div>
    </ToolFrame>
  );
}
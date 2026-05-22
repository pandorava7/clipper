"use client";

import JSZip from "jszip";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { ActionButtons } from "@/src/components/ActionButtons";
import { Dropzone } from "@/src/components/Dropzone";
import { ToolFrame } from "@/src/components/ToolFrame";
import {
  blobFromCanvas,
  clamp,
  downloadUrl,
  loadImageFiles,
  replaceFileExtension,
  revokeLoadedImages,
  revokeObjectUrl,
  type LoadedImageFile,
} from "@/src/lib/image-tools";

import styles from "./CropTool.module.css";

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImageFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ResizeHandle = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";
type BatchArchive = {
  url: string;
  name: string;
  count: number;
};

type Interaction =
  | {
      type: "move";
      pointerId: number;
      startX: number;
      startY: number;
      crop: CropRect;
    }
  | {
      type: "resize";
      handle: ResizeHandle;
      pointerId: number;
      startX: number;
      startY: number;
      crop: CropRect;
    };

const MIN_CROP_SIZE = 64;

const ratioOptions = [
  { id: "free", label: "自由", value: undefined },
  { id: "1:1", label: "1:1", value: 1 },
  { id: "4:3", label: "4:3", value: 4 / 3 },
  { id: "3:4", label: "3:4", value: 3 / 4 },
  { id: "16:9", label: "16:9", value: 16 / 9 },
  { id: "9:16", label: "9:16", value: 9 / 16 },
];

const handleClasses: Record<ResizeHandle, string> = {
  n: styles.handleN,
  e: styles.handleE,
  s: styles.handleS,
  w: styles.handleW,
  ne: styles.handleNE,
  nw: styles.handleNW,
  se: styles.handleSE,
  sw: styles.handleSW,
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function createInitialCrop(frame: ImageFrame, aspect?: number): CropRect {
  const padding = Math.min(frame.width, frame.height) * 0.08;
  const boundsWidth = Math.max(frame.width - padding * 2, MIN_CROP_SIZE);
  const boundsHeight = Math.max(frame.height - padding * 2, MIN_CROP_SIZE);

  if (!aspect) {
    return {
      x: (frame.width - boundsWidth) / 2,
      y: (frame.height - boundsHeight) / 2,
      width: boundsWidth,
      height: boundsHeight,
    };
  }

  let width = boundsWidth;
  let height = width / aspect;

  if (height > boundsHeight) {
    height = boundsHeight;
    width = height * aspect;
  }

  return {
    x: (frame.width - width) / 2,
    y: (frame.height - height) / 2,
    width,
    height,
  };
}

function createCenteredAspectCrop(width: number, height: number, aspect: number): CropRect {
  const sourceAspect = width / height;

  if (sourceAspect > aspect) {
    const cropWidth = height * aspect;
    return {
      x: (width - cropWidth) / 2,
      y: 0,
      width: cropWidth,
      height,
    };
  }

  const cropHeight = width / aspect;
  return {
    x: 0,
    y: (height - cropHeight) / 2,
    width,
    height: cropHeight,
  };
}

function normalizeFreeCrop(crop: CropRect, frame: ImageFrame): CropRect {
  const width = clamp(crop.width, MIN_CROP_SIZE, frame.width);
  const height = clamp(crop.height, MIN_CROP_SIZE, frame.height);

  return {
    x: clamp(crop.x, 0, frame.width - width),
    y: clamp(crop.y, 0, frame.height - height),
    width,
    height,
  };
}

function normalizeAspectCrop(crop: CropRect, frame: ImageFrame, aspect: number): CropRect {
  let width = clamp(crop.width, MIN_CROP_SIZE, frame.width);
  let height = width / aspect;

  if (height < MIN_CROP_SIZE) {
    height = MIN_CROP_SIZE;
    width = height * aspect;
  }

  if (height > frame.height) {
    height = frame.height;
    width = height * aspect;
  }

  if (width > frame.width) {
    width = frame.width;
    height = width / aspect;
  }

  return {
    x: clamp(crop.x, 0, frame.width - width),
    y: clamp(crop.y, 0, frame.height - height),
    width,
    height,
  };
}

function resizeFreeCrop(crop: CropRect, handle: ResizeHandle, dx: number, dy: number, frame: ImageFrame): CropRect {
  let left = crop.x;
  let top = crop.y;
  let right = crop.x + crop.width;
  let bottom = crop.y + crop.height;

  if (handle.includes("w")) {
    left = clamp(crop.x + dx, 0, right - MIN_CROP_SIZE);
  }

  if (handle.includes("e")) {
    right = clamp(crop.x + crop.width + dx, left + MIN_CROP_SIZE, frame.width);
  }

  if (handle.includes("n")) {
    top = clamp(crop.y + dy, 0, bottom - MIN_CROP_SIZE);
  }

  if (handle.includes("s")) {
    bottom = clamp(crop.y + crop.height + dy, top + MIN_CROP_SIZE, frame.height);
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function resizeAspectCrop(crop: CropRect, handle: ResizeHandle, dx: number, dy: number, frame: ImageFrame, aspect: number): CropRect {
  if (handle === "e" || handle === "w") {
    const anchorX = handle === "e" ? crop.x : crop.x + crop.width;
    let width = handle === "e" ? crop.width + dx : crop.width - dx;
    width = clamp(width, MIN_CROP_SIZE, frame.width);

    let height = width / aspect;

    if (height > frame.height) {
      height = frame.height;
      width = height * aspect;
    }

    const centerY = crop.y + crop.height / 2;
    const x = handle === "e" ? anchorX : anchorX - width;
    const y = clamp(centerY - height / 2, 0, frame.height - height);
    return normalizeAspectCrop({ x, y, width, height }, frame, aspect);
  }

  if (handle === "n" || handle === "s") {
    const anchorY = handle === "s" ? crop.y : crop.y + crop.height;
    let height = handle === "s" ? crop.height + dy : crop.height - dy;
    height = clamp(height, MIN_CROP_SIZE, frame.height);

    let width = height * aspect;

    if (width > frame.width) {
      width = frame.width;
      height = width / aspect;
    }

    const centerX = crop.x + crop.width / 2;
    const x = clamp(centerX - width / 2, 0, frame.width - width);
    const y = handle === "s" ? anchorY : anchorY - height;
    return normalizeAspectCrop({ x, y, width, height }, frame, aspect);
  }

  const leftAnchor = handle.includes("w") ? crop.x + crop.width : crop.x;
  const topAnchor = handle.includes("n") ? crop.y + crop.height : crop.y;
  const nextWidthByDx = handle.includes("w") ? crop.width - dx : crop.width + dx;
  const nextHeightByDy = handle.includes("n") ? crop.height - dy : crop.height + dy;

  let width = nextWidthByDx;
  let height = width / aspect;

  if (height < MIN_CROP_SIZE || Math.abs(nextHeightByDy - height) < Math.abs(nextWidthByDx - nextHeightByDy * aspect)) {
    height = clamp(nextHeightByDy, MIN_CROP_SIZE, frame.height);
    width = height * aspect;
  }

  if (width > frame.width) {
    width = frame.width;
    height = width / aspect;
  }

  if (height > frame.height) {
    height = frame.height;
    width = height * aspect;
  }

  const x = handle.includes("w") ? leftAnchor - width : leftAnchor;
  const y = handle.includes("n") ? topAnchor - height : topAnchor;
  return normalizeAspectCrop({ x, y, width, height }, frame, aspect);
}

function resizeCrop(crop: CropRect, handle: ResizeHandle, dx: number, dy: number, frame: ImageFrame, aspect?: number) {
  return aspect ? resizeAspectCrop(crop, handle, dx, dy, frame, aspect) : resizeFreeCrop(crop, handle, dx, dy, frame);
}

function createArchiveName(prefix: string) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  return `${prefix}-${stamp}.zip`;
}

async function loadCanvasSource(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = url;
  });
}

async function cropImageToBlob(image: LoadedImageFile, sourceCrop: CropRect) {
  const source = await loadCanvasSource(image.url);
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(sourceCrop.width));
  canvas.height = Math.max(1, Math.round(sourceCrop.height));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas unavailable.");
  }

  context.drawImage(
    source,
    sourceCrop.x,
    sourceCrop.y,
    sourceCrop.width,
    sourceCrop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return {
    blob: await blobFromCanvas(canvas, "image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}

export function CropTool() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const interactionRef = useRef<Interaction | null>(null);

  const [images, setImages] = useState<LoadedImageFile[]>([]);
  const [frame, setFrame] = useState<ImageFrame | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [ratioId, setRatioId] = useState("free");
  const [isDragging, setIsDragging] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [archive, setArchive] = useState<BatchArchive | null>(null);
  const [resultSize, setResultSize] = useState<{ width: number; height: number } | null>(null);
  const [resultName, setResultName] = useState("cropped-image.png");

  const image = images[0] ?? null;
  const isBatch = images.length > 1;

  const selectedAspect = useMemo(
    () => ratioOptions.find((option) => option.id === ratioId)?.value,
    [ratioId],
  );

  const visibleRatioOptions = useMemo(
    () => (isBatch ? ratioOptions.filter((option) => option.value) : ratioOptions),
    [isBatch],
  );

  const displayCrop = useMemo(() => {
    if (!frame) {
      return null;
    }

    if (isBatch) {
      return selectedAspect ? createCenteredAspectCrop(frame.width, frame.height, selectedAspect) : null;
    }

    return crop;
  }, [crop, frame, isBatch, selectedAspect]);

  useEffect(() => {
    return () => {
      revokeLoadedImages(images);
      revokeObjectUrl(resultUrl);
      revokeObjectUrl(archive?.url);
    };
  }, [archive?.url, images, resultUrl]);

  useEffect(() => {
    if (!frame || isBatch) {
      return;
    }

    const currentFrame: ImageFrame = frame;
    const active = interactionRef.current;

    if (!active) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const interaction = interactionRef.current;

      if (!interaction || event.pointerId !== interaction.pointerId) {
        return;
      }

      event.preventDefault();

      const dx = event.clientX - interaction.startX;
      const dy = event.clientY - interaction.startY;

      if (interaction.type === "move") {
        setCrop(
          normalizeFreeCrop(
            {
              ...interaction.crop,
              x: interaction.crop.x + dx,
              y: interaction.crop.y + dy,
            },
            currentFrame,
          ),
        );
        return;
      }

      setCrop(resizeCrop(interaction.crop, interaction.handle, dx, dy, currentFrame, selectedAspect));
    }

    function handlePointerEnd(event: PointerEvent) {
      const interaction = interactionRef.current;

      if (!interaction || interaction.pointerId !== event.pointerId) {
        return;
      }

      interactionRef.current = null;
      setIsDragging(false);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [frame, isBatch, selectedAspect]);

  useEffect(() => {
    function syncImageFrame() {
      if (!stageRef.current || !imageRef.current || !image) {
        return;
      }

      const stageBounds = stageRef.current.getBoundingClientRect();
      const imageBounds = imageRef.current.getBoundingClientRect();
      const nextFrame = {
        left: imageBounds.left - stageBounds.left,
        top: imageBounds.top - stageBounds.top,
        width: imageBounds.width,
        height: imageBounds.height,
      };

      setFrame((previousFrame) => {
        if (isBatch) {
          return nextFrame;
        }

        if (!previousFrame || previousFrame.width === 0 || previousFrame.height === 0) {
          setCrop((currentCrop) => currentCrop ?? createInitialCrop(nextFrame, selectedAspect));
          return nextFrame;
        }

        setCrop((currentCrop) => {
          if (!currentCrop) {
            return createInitialCrop(nextFrame, selectedAspect);
          }

          const scaledCrop = {
            x: (currentCrop.x / previousFrame.width) * nextFrame.width,
            y: (currentCrop.y / previousFrame.height) * nextFrame.height,
            width: (currentCrop.width / previousFrame.width) * nextFrame.width,
            height: (currentCrop.height / previousFrame.height) * nextFrame.height,
          };

          return selectedAspect ? normalizeAspectCrop(scaledCrop, nextFrame, selectedAspect) : normalizeFreeCrop(scaledCrop, nextFrame);
        });

        return nextFrame;
      });
    }

    syncImageFrame();
    window.addEventListener("resize", syncImageFrame);
    return () => window.removeEventListener("resize", syncImageFrame);
  }, [image, isBatch, selectedAspect]);

  async function handleFileSelect(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    const files = Array.from(fileList);

    if (files.some((file) => !file.type.startsWith("image/"))) {
      setErrorMessage("请上传图片文件。");
      return;
    }

    try {
      const nextImages = await loadImageFiles(files);
      revokeLoadedImages(images);
      revokeObjectUrl(resultUrl);
      revokeObjectUrl(archive?.url);
      setImages(nextImages);
      setFrame(null);
      setCrop(null);
      setResultUrl(null);
      setArchive(null);
      setResultSize(null);
      setErrorMessage(null);
      setResultName(replaceFileExtension(files[0].name, "-cropped.png"));
      setRatioId(nextImages.length > 1 ? "1:1" : "free");
    } catch {
      setErrorMessage("图片读取失败，请换一张再试。");
    }
  }

  function resetAll() {
    revokeLoadedImages(images);
    revokeObjectUrl(resultUrl);
    revokeObjectUrl(archive?.url);
    setImages([]);
    setFrame(null);
    setCrop(null);
    setResultUrl(null);
    setArchive(null);
    setResultSize(null);
    setResultName("cropped-image.png");
    setRatioId("free");
    setErrorMessage(null);
  }

  function handleRatioChange(nextRatioId: string) {
    if (isBatch && nextRatioId === "free") {
      return;
    }

    setRatioId(nextRatioId);

    if (!frame || isBatch) {
      return;
    }

    const nextAspect = ratioOptions.find((option) => option.id === nextRatioId)?.value;

    setCrop((currentCrop) => {
      if (!currentCrop) {
        return createInitialCrop(frame, nextAspect);
      }

      return nextAspect ? normalizeAspectCrop(currentCrop, frame, nextAspect) : normalizeFreeCrop(currentCrop, frame);
    });
  }

  function beginMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!crop || isBatch) {
      return;
    }

    event.preventDefault();
    interactionRef.current = {
      type: "move",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      crop,
    };
    setIsDragging(true);
  }

  function beginResize(event: React.PointerEvent<HTMLButtonElement>) {
    if (!crop || isBatch) {
      return;
    }

    const handle = event.currentTarget.dataset.handle as ResizeHandle | undefined;
    if (!handle) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = {
      type: "resize",
      handle,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      crop,
    };
    setIsDragging(true);
  }

  async function confirmCrop() {
    if (!image) {
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);

    try {
      if (isBatch) {
        if (!selectedAspect) {
          throw new Error("Batch crop requires aspect.");
        }

        const zip = new JSZip();

        for (const item of images) {
          const sourceCrop = createCenteredAspectCrop(item.naturalWidth, item.naturalHeight, selectedAspect);
          const { blob } = await cropImageToBlob(item, sourceCrop);
          zip.file(replaceFileExtension(item.name, "-cropped.png"), blob);
        }

        const archiveBlob = await zip.generateAsync({ type: "blob" });
        const nextArchiveUrl = URL.createObjectURL(archiveBlob);
        revokeObjectUrl(resultUrl);
        revokeObjectUrl(archive?.url);
        setResultUrl(null);
        setResultSize(null);
        setArchive({
          url: nextArchiveUrl,
          name: createArchiveName("cropped-images"),
          count: images.length,
        });
        return;
      }

      if (!crop || !frame) {
        return;
      }

      const sourceCrop = {
        x: (crop.x / frame.width) * image.naturalWidth,
        y: (crop.y / frame.height) * image.naturalHeight,
        width: (crop.width / frame.width) * image.naturalWidth,
        height: (crop.height / frame.height) * image.naturalHeight,
      };

      const { blob, width, height } = await cropImageToBlob(image, sourceCrop);
      const nextUrl = URL.createObjectURL(blob);
      revokeObjectUrl(resultUrl);
      revokeObjectUrl(archive?.url);
      setArchive(null);
      setResultUrl(nextUrl);
      setResultSize({ width, height });
    } catch {
      setErrorMessage("裁剪失败，请重试。");
    } finally {
      setIsExporting(false);
    }
  }

  const footer = resultUrl ? (
    <div className={styles.footerStack}>
      <button type="button" onClick={resetAll} className={styles.secondaryButton}>
        新建裁剪
      </button>
      <button
        type="button"
        onClick={() => {
          if (resultUrl) {
            downloadUrl(resultUrl, resultName);
          }
        }}
        className={styles.primaryButton}
      >
        下载图片
      </button>
    </div>
  ) : archive ? (
    <div className={styles.footerStack}>
      <button type="button" onClick={resetAll} className={styles.secondaryButton}>
        重新选择
      </button>
      <button type="button" onClick={() => downloadUrl(archive.url, archive.name)} className={styles.primaryButton}>
        下载 zip
      </button>
    </div>
  ) : image ? (
    <div className={styles.footerStack}>
      <div className={styles.ratioRow}>
        {visibleRatioOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => handleRatioChange(option.id)}
            className={joinClasses(styles.ratioButton, ratioId === option.id && styles.ratioButtonActive)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <ActionButtons
        onCancel={resetAll}
        onConfirm={confirmCrop}
        confirmLabel={isExporting ? "处理中" : isBatch ? "批量裁剪" : "确认"}
        disabled={isExporting || (isBatch && !selectedAspect)}
      />
    </div>
  ) : (
    <button type="button" onClick={resetAll} className={styles.primaryButton}>
      重新上传
    </button>
  );

  return (
    <ToolFrame
      title="裁剪"
      description="单张图片支持自由拖动，多张图片会按所选比例自动居中批量裁剪并打包下载。"
      footer={footer}
      note="裁切"
    >
      <div className={styles.panel}>
        <div className={styles.statusRow}>
          <span>{image ? (isBatch ? `已选择 ${images.length} 张图片` : image.name) : "拖入图片或点击上传"}</span>
          <span>
            {resultUrl
              ? "裁剪完成"
              : archive
                ? `已打包 ${archive.count} 张图片`
                : image
                  ? isBatch
                    ? "选择比例后自动居中批量裁剪"
                    : "拖动边缘或移动裁剪框"
                  : "支持手机安装使用"}
          </span>
        </div>

        <div ref={stageRef} className={styles.stage}>
          {!image ? (
            <Dropzone
              title="拖入图片开始裁剪"
              description="单张图片可手动裁剪，多张图片会按所选比例自动批量裁剪。"
              multiple
              onFileSelect={(fileList) => {
                void handleFileSelect(fileList);
              }}
            />
          ) : null}

          {image && !resultUrl && !archive ? (
            <>
              <Image
                ref={imageRef}
                src={image.url}
                alt="待裁剪图片"
                width={image.naturalWidth}
                height={image.naturalHeight}
                sizes="100vw"
                unoptimized
                className={styles.previewImage}
              />

              {displayCrop && frame ? (
                <div
                  className={joinClasses(styles.cropBox, isDragging && styles.cropBoxDragging, isBatch && styles.cropBoxStatic)}
                  style={{ left: frame.left + displayCrop.x, top: frame.top + displayCrop.y, width: displayCrop.width, height: displayCrop.height }}
                  onPointerDown={isBatch ? undefined : beginMove}
                >
                  <div className={styles.cropOutline} />
                  <div className={styles.cropGlow} />
                  <div className={styles.cropShade} />
                  {!isBatch
                    ? (Object.keys(handleClasses) as ResizeHandle[]).map((handle) => (
                        <button
                          key={handle}
                          type="button"
                          data-handle={handle}
                          aria-label={`调整裁剪框 ${handle}`}
                          onPointerDown={beginResize}
                          className={joinClasses(styles.handle, handleClasses[handle])}
                        />
                      ))
                    : null}
                </div>
              ) : null}

              {isBatch ? (
                <div className={styles.helperCard}>
                  <p className={styles.helperTitle}>批量模式预览首张图片</p>
                  <p className={styles.helperDescription}>系统会按所选尺寸比例，对全部图片执行无留白、水平垂直居中的最佳裁剪，并统一打包为 zip。</p>
                </div>
              ) : null}
            </>
          ) : null}

          {resultUrl && resultSize ? (
            <div className={styles.resultWrap}>
              <Image src={resultUrl} alt="裁剪结果" width={resultSize.width} height={resultSize.height} unoptimized className={styles.resultImage} />
              <div className={styles.resultMeta}>
                <p className={styles.resultTitle}>裁剪完成</p>
                <p className={styles.resultDescription}>结果已生成，可以直接下载，或返回重新选择另一张图片。</p>
              </div>
            </div>
          ) : null}

          {archive ? (
            <div className={styles.resultWrap}>
              <div className={styles.archiveBadge}>{archive.count}</div>
              <div className={styles.resultMeta}>
                <p className={styles.resultTitle}>批量裁剪完成</p>
                <p className={styles.resultDescription}>全部图片已按当前比例居中裁切，并打包为一个 zip 文件供下载。</p>
              </div>
            </div>
          ) : null}
        </div>

        {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
      </div>
    </ToolFrame>
  );
}
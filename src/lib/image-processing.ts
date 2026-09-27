import "server-only";
import sharp from "sharp";
import { IMAGE_SPECS, IMAGE_TYPES, formatMB, ratioDeviation, type ImageKind } from "./media-rules";

export class ImageError extends Error {}

export type ProcessedImage = { data: Buffer; width: number; height: number; ext: "webp" | "jpg"; mime: string; warning?: string };

/** Valida e converte a imagem conforme IMAGE_SPECS (WebP/JPEG, redimensionada, EXIF aplicado). */
export async function processImage(file: File, kind: ImageKind): Promise<ProcessedImage> {
  const spec = IMAGE_SPECS[kind];
  if (!IMAGE_TYPES.includes(file.type)) throw new ImageError(`Formato não aceito. Use ${spec.formats}.`);
  if (file.size > spec.maxBytes) throw new ImageError(`A imagem tem ${formatMB(file.size)}; o limite é ${formatMB(spec.maxBytes)}.`);

  const input = Buffer.from(await file.arrayBuffer());
  let meta;
  try {
    meta = await sharp(input).rotate().metadata();
  } catch {
    throw new ImageError("Não foi possível ler a imagem.");
  }
  // metadata() não aplica o rotate; com EXIF 5–8 largura e altura se invertem.
  const swap = (meta.orientation ?? 1) >= 5;
  const srcW = (swap ? meta.height : meta.width) ?? 0;
  const srcH = (swap ? meta.width : meta.height) ?? 0;

  let warning: string | undefined;
  if (kind === "logo") {
    if (srcH < 120) warning = `O logo tem ${srcH} px de altura; abaixo de 120 px ele pode ficar borrado em telas retina.`;
    if (meta.format === "jpeg") warning = [warning, "JPG não tem transparência: o fundo do logo vai aparecer."].filter(Boolean).join(" ");
  } else if (spec.ratio && ratioDeviation(srcW, srcH, spec.ratio) > 0.1) {
    warning =
      spec.output.fit === "cover"
        ? `A imagem tem ${srcW} × ${srcH} px; o recomendado é ${spec.size}. As bordas serão cortadas para caber.`
        : `A imagem tem ${srcW} × ${srcH} px; o recomendado é ${spec.size}. Ela aparece inteira, com faixas de cor em volta.`;
  } else if (spec.output.width && srcW < spec.output.width * 0.6) {
    warning = `A imagem tem só ${srcW} px de largura; o recomendado é ${spec.size}. Pode ficar borrada em telas grandes.`;
  }

  const o = spec.output;
  let pipeline = sharp(input)
    .rotate()
    .resize({ width: o.width, height: o.height, fit: o.fit, withoutEnlargement: o.fit === "inside", position: "attention" });
  pipeline = o.format === "jpeg" ? pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 85, mozjpeg: true }) : pipeline.webp({ quality: 82 });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  return {
    data,
    width: info.width,
    height: info.height,
    ext: o.format === "jpeg" ? "jpg" : "webp",
    mime: o.format === "jpeg" ? "image/jpeg" : "image/webp",
    warning,
  };
}

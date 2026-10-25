import type { DownloadDetails } from './search-index';

interface DownloadArtwork extends Omit<DownloadDetails, 'pdfColorSpace'> {
  pdfColorSpace?: string;
  published: boolean;
  indexable: boolean;
  licenseStatus: string;
  reviewStatus: string;
  pdf?: string;
}

/** Only approved originals receive a downloadable catalog record. */
export function downloadDetails(item: DownloadArtwork): DownloadDetails | undefined {
  if (
    !item.published ||
    !item.indexable ||
    item.licenseStatus !== 'OWNER_APPROVED_PERSONAL_EDUCATIONAL_ONLY' ||
    item.reviewStatus !== 'FORMAT_AND_PAIR_REVIEW_PASSED'
  )
    return undefined;
  return {
    width: item.width,
    height: item.height,
    alpha: item.alpha,
    pdfPage: item.pdfPage,
    pdfColorSpace: item.pdfColorSpace || 'CMYK',
    files: {
      webp: { bytes: item.files.webp.bytes, sha256: item.files.webp.sha256 },
      ...(item.pdf && item.files.pdf
        ? { pdf: { bytes: item.files.pdf.bytes, sha256: item.files.pdf.sha256 } }
        : {}),
    },
  };
}

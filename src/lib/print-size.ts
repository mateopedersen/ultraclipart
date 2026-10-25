export const PRINT_UNITS = {
  in: { scale: 1, label: 'inches', short: 'in' },
  mm: { scale: 25.4, label: 'millimeters', short: 'mm' },
  cm: { scale: 2.54, label: 'centimeters', short: 'cm' },
} as const;
export type PrintUnit = keyof typeof PRINT_UNITS;

/** ISO sizes use exact millimeters; US and photo sizes use exact inches. */
export const PAPER_SIZES = {
  letter: { name: 'US Letter', width: 8.5, height: 11 },
  a4: { name: 'A4', width: 210 / 25.4, height: 297 / 25.4 },
  a5: { name: 'A5', width: 148 / 25.4, height: 210 / 25.4 },
  a3: { name: 'A3', width: 297 / 25.4, height: 420 / 25.4 },
  legal: { name: 'US Legal', width: 8.5, height: 14 },
  photo4x6: { name: '4 × 6 photo', width: 4, height: 6 },
  photo5x7: { name: '5 × 7 photo', width: 5, height: 7 },
  photo8x10: { name: '8 × 10 photo', width: 8, height: 10 },
} as const;
export type PrintInput = {
  pixelsWide: number;
  pixelsHigh: number;
  widthInches: number;
  paper: keyof typeof PAPER_SIZES;
  landscape: boolean;
  marginInches: number;
};
/** Pure geometry, not a print-quality rating. Transparent canvas padding is included. */
export function calculatePrintSize(input: PrintInput) {
  const { pixelsWide, pixelsHigh, widthInches, paper, landscape, marginInches } = input;
  if (
    ![pixelsWide, pixelsHigh].every(
      (value) => Number.isInteger(value) && value >= 1 && value <= 100000,
    )
  )
    throw new RangeError('Enter whole pixel dimensions between 1 and 100,000.');
  if (!Number.isFinite(widthInches) || widthInches <= 0 || widthInches > 500)
    throw new RangeError('Enter a print width greater than zero and at most 500 inches.');
  if (!Number.isFinite(marginInches) || marginInches < 0 || marginInches > 2)
    throw new RangeError('Enter margins from 0 to 2 inches (50.8 mm).');
  if (!Object.hasOwn(PAPER_SIZES, paper))
    throw new RangeError('Choose a paper size from the list.');
  const size = PAPER_SIZES[paper];
  const [pageWidth, pageHeight] = landscape ? [size.height, size.width] : [size.width, size.height];
  const usableWidth = pageWidth - 2 * marginInches;
  const usableHeight = pageHeight - 2 * marginInches;
  if (usableWidth <= 0 || usableHeight <= 0)
    throw new RangeError('These margins leave no printable area. Choose smaller margins.');
  const heightInches = (widthInches * pixelsHigh) / pixelsWide;
  if (heightInches > 500)
    throw new RangeError('The calculated height exceeds 500 inches. Choose a smaller print size.');
  const ppi = pixelsWide / widthInches;
  const fitWidth = Math.min(usableWidth, (usableHeight * pixelsWide) / pixelsHigh);
  return {
    widthInches,
    heightInches,
    ppi,
    pageWidth,
    pageHeight,
    usableWidth,
    usableHeight,
    fitWidth,
    fitHeight: (fitWidth * pixelsHigh) / pixelsWide,
    fits: widthInches <= usableWidth + 1e-9 && heightInches <= usableHeight + 1e-9,
  };
}

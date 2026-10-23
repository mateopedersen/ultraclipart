export type PrintInput = {
  pixelsWide: number;
  pixelsHigh: number;
  widthInches: number;
  paper: 'letter' | 'a4';
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
    throw new RangeError('Enter margins from 0 to 2 inches.');
  if (paper !== 'letter' && paper !== 'a4') throw new RangeError('Choose US Letter or A4.');
  const portrait = paper === 'letter' ? [8.5, 11] : [210 / 25.4, 297 / 25.4];
  const [pageWidth, pageHeight] = landscape ? [...portrait].reverse() : portrait;
  const usableWidth = pageWidth - 2 * marginInches;
  const usableHeight = pageHeight - 2 * marginInches;
  const heightInches = (widthInches * pixelsHigh) / pixelsWide;
  const ppi = pixelsWide / widthInches;
  const fitWidth = Math.min(usableWidth, (usableHeight * pixelsWide) / pixelsHigh);
  return {
    widthInches,
    heightInches,
    ppi,
    usableWidth,
    usableHeight,
    fitWidth,
    fitHeight: (fitWidth * pixelsHigh) / pixelsWide,
    fits: widthInches <= usableWidth + 1e-9 && heightInches <= usableHeight + 1e-9,
  };
}

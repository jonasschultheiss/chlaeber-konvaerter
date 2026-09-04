export type NudgeBox = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export function clampItemToLabel(
  item: NudgeBox,
  labelWidthMm: number,
  labelHeightMm: number,
): { xMm: number; yMm: number } {
  const maxX = Math.max(0, labelWidthMm - item.widthMm);
  const maxY = Math.max(0, labelHeightMm - item.heightMm);
  return {
    xMm: roundMm(clamp(item.xMm, 0, maxX)),
    yMm: roundMm(clamp(item.yMm, 0, maxY)),
  };
}

export function nudgeItem(
  item: NudgeBox,
  dxMm: number,
  dyMm: number,
  labelWidthMm: number,
  labelHeightMm: number,
): { xMm: number; yMm: number } {
  return clampItemToLabel(
    {
      ...item,
      xMm: item.xMm + dxMm,
      yMm: item.yMm + dyMm,
    },
    labelWidthMm,
    labelHeightMm,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundMm(value: number): number {
  return Math.round(value * 100) / 100;
}

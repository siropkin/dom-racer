export interface ParsedColor {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

export interface HslResult {
  lightness: number;
  saturation: number;
}

export function parseCssColor(value: string): ParsedColor | null {
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (!match) {
    return null;
  }

  const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  return {
    r: parts[0],
    g: parts[1],
    b: parts[2],
    alpha: parts[3] ?? 1,
  };
}

export function rgbToHsl(r: number, g: number, b: number): HslResult {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { lightness, saturation: 0 };
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / Math.max(0.0001, max + min);
  return { lightness, saturation };
}

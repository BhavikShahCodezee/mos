declare module 'react-native-canvas' {
  export class Canvas {
    constructor(width?: number, height?: number);
    width: number;
    height: number;
    getContext(contextType: '2d'): any;
    toDataURL(type?: string, quality?: number): Promise<string>;
  }

  export class Image {
    constructor(canvas: Canvas, height?: number, width?: number);
    onload: (() => void) | null;
    onerror: ((err: unknown) => void) | null;
    src: string;
  }
}


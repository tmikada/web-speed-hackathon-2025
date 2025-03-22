declare module '*.png' {
  const value: string;
  export = value;
}

declare module '*?raw' {
  const value: string;
  export = value;
}

declare module '*?arraybuffer' {
  const value: ArrayBuffer;
  export = value;
}

declare module '@videojs/http-streaming' {
  const content: any;
  export default content;
}

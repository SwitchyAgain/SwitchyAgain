declare var OmegaPac: unknown;

declare module 'bluebird' {
  const value: any;
  export default value;
}

declare module 'limiter' {
  export class TokenBucket {
    clear?: () => unknown;
    content: number;
    constructor(bucketSize: number, tokensPerInterval: number, interval: string, parentBucket: unknown);
    removeTokens(count: number, callback: () => unknown): unknown;
    tryRemoveTokens(count: number): boolean;
  }
}

declare module 'omega-pac' {
  const value: unknown;
  export default value;
}

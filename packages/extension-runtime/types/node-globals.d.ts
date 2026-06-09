declare var OmegaPac: unknown;

declare module 'bluebird' {
  const value: any;
  export default value;
}

declare module 'limiter' {
  type Interval = number | 'second' | 'sec' | 'minute' | 'min' | 'hour' | 'hr' | 'day';
  type TokenBucketOptions = {
    bucketSize: number;
    tokensPerInterval: number;
    interval: Interval;
    parentBucket?: TokenBucket;
  };

  export class TokenBucket {
    clear?: () => unknown;
    content: number;
    constructor(options: TokenBucketOptions);
    removeTokens(count: number): Promise<number>;
    tryRemoveTokens(count: number): boolean;
  }
}

declare module '@switchyagain/proxy-engine' {
  const value: unknown;
  export default value;
}

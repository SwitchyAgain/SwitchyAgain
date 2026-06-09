export type ErrorCause = {
  statusCode?: number | string;
  [key: string]: unknown;
};

export class NetworkError extends Error {
  cause?: ErrorCause;

  constructor(err?: ErrorCause) {
    super();
    this.cause = err;
    this.name = 'NetworkError';
  }
}

export class HttpError extends NetworkError {
  statusCode?: number | string;

  constructor(err?: ErrorCause) {
    super(err);
    this.statusCode = this.cause != null ? this.cause.statusCode : void 0;
    this.name = 'HttpError';
  }
}

export class HttpNotFoundError extends HttpError {
  constructor(err?: ErrorCause) {
    super(err);
    this.name = 'HttpNotFoundError';
  }
}

export class HttpServerError extends HttpError {
  constructor(err?: ErrorCause) {
    super(err);
    this.name = 'HttpServerError';
  }
}

export class ContentTypeRejectedError extends Error {
  constructor() {
    super();
    this.name = 'ContentTypeRejectedError';
  }
}

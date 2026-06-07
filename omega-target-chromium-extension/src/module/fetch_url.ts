import OmegaTargetModule = require('omega-target');
import Url = require('url');
import xhrModule = require('xhr');

const OmegaTarget = OmegaTargetModule;
const OmegaPromise = OmegaTarget.Promise;
const ContentTypeRejectedError = OmegaTarget.ContentTypeRejectedError;

type XhrOptions = string | {
  url: string;
  [key: string]: unknown;
};

type XhrOperationalError = Error & {
  isOperational?: boolean;
  statusCode?: number;
};

type XhrResponse = {
  headers: Record<string, string | undefined>;
};

type HintContext = {
  contentType?: string;
  hint: string;
};

type HintHandler = (response: XhrResponse, body: string, context: HintContext) => string | undefined | void;

type XhrResult = [response: XhrResponse, body: string];
type XhrFunction = (options: XhrOptions) => OmegaPromise<XhrResult>;

const xhr = OmegaPromise.promisify(xhrModule) as unknown as XhrFunction;

function xhrWrapper(options: XhrOptions): Promise<XhrResult> {
  return xhr(options).catch((err: XhrOperationalError) => {
    if (!err.isOperational) {
      throw err;
    }
    if (!err.statusCode) {
      throw new OmegaTarget.NetworkError(err);
    }
    if (err.statusCode === 404) {
      throw new OmegaTarget.HttpNotFoundError(err);
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      throw new OmegaTarget.HttpServerError(err);
    }
    throw new OmegaTarget.HttpError(err);
  });
}

function defaultHintHandler(_response: XhrResponse, body: string, {contentType, hint}: HintContext) {
  if (`!${contentType}` === hint) {
    throw new ContentTypeRejectedError(`Response Content-Type blacklisted: ${contentType}`);
  }
  if (contentType === hint) {
    return body;
  }
}

const hintHandlers: Record<string, HintHandler> = {
  '*': (_response, body) => body,
  '!text/html': (_response, body, {contentType, hint}) => {
    if (contentType === hint) {
      let looksLikeHtml = false;
      if (body.indexOf('<!DOCTYPE') >= 0 || body.indexOf('<!doctype') >= 0) {
        looksLikeHtml = true;
      } else if (body.indexOf('</html>') >= 0) {
        looksLikeHtml = true;
      } else if (body.indexOf('</body>') >= 0) {
        looksLikeHtml = true;
      }
      if (looksLikeHtml) {
        throw new ContentTypeRejectedError('Response must not be HTML.');
      }
    }
  },
  '!application/xhtml+xml': (response, body, context) => {
    return hintHandlers['!text/html'](response, body, context);
  },
  'application/x-ns-proxy-autoconfig': (_response, body, {contentType, hint}) => {
    if (contentType === hint) {
      return body;
    }
    if (body.indexOf('FindProxyForURL') >= 0) {
      return body;
    }
  }
};

function fetchUrl(destUrl: string, optBypassCache?: boolean, optTypeHints?: string[]) {
  const getResBody = ([response, body]: XhrResult) => {
    if (!optTypeHints) {
      return body;
    }
    const contentType = response.headers['content-type']?.toLowerCase();
    for (const hint of optTypeHints) {
      const handler = hintHandlers[hint] || defaultHintHandler;
      const result = handler(response, body, {
        contentType,
        hint
      });
      if (result != null) {
        return result;
      }
    }
    throw new ContentTypeRejectedError(`Unrecognized Content-Type: ${contentType}`);
  };

  if (optBypassCache && destUrl.indexOf('?') < 0) {
    const parsed = Url.parse(destUrl, true);
    parsed.search = undefined;
    parsed.query['_'] = Date.now();
    const destUrlNoCache = Url.format(parsed);
    return xhrWrapper(destUrlNoCache).then(getResBody).catch(() => {
      return xhrWrapper(destUrl).then(getResBody);
    });
  }
  return xhrWrapper(destUrl).then(getResBody);
}

export = fetchUrl;

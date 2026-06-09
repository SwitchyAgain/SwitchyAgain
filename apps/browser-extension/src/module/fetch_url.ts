import OmegaTarget from '@switchyagain/extension-runtime';

const ContentTypeRejectedError = OmegaTarget.ContentTypeRejectedError;

type FetchResponse = {
  headers: Record<string, string | undefined>;
};

type HintContext = {
  contentType?: string;
  hint: string;
};

type HintHandler = (response: FetchResponse, body: string, context: HintContext) => string | undefined | void;

type FetchResult = [response: FetchResponse, body: string];

function errorForStatus(statusCode: number) {
  const err = {statusCode};
  if (statusCode === 404) {
    return new OmegaTarget.HttpNotFoundError(err);
  }
  if (statusCode >= 500 && statusCode < 600) {
    return new OmegaTarget.HttpServerError(err);
  }
  return new OmegaTarget.HttpError(err);
}

function responseHeaders(headers: Headers): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

function fetchWrapper(url: string): Promise<FetchResult> {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw errorForStatus(response.status);
    }
    return response.text().then((body): FetchResult => {
      return [{
        headers: responseHeaders(response.headers)
      }, body];
    });
  }).catch((err: Error) => {
    if (err instanceof OmegaTarget.HttpError) {
      throw err;
    }
    throw new OmegaTarget.NetworkError(err);
  });
}

function defaultHintHandler(_response: FetchResponse, body: string, {contentType, hint}: HintContext) {
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
  const getResBody = ([response, body]: FetchResult) => {
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
    const parsed = new URL(destUrl);
    parsed.searchParams.set('_', Date.now().toString());
    const destUrlNoCache = parsed.href;
    return fetchWrapper(destUrlNoCache).then(getResBody).catch(() => {
      return fetchWrapper(destUrl).then(getResBody);
    });
  }
  return fetchWrapper(destUrl).then(getResBody);
}

export default fetchUrl;

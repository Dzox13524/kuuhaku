// src/chatgpt-api.ts
import ExpiryMap from "expiry-map";
import pTimeout from "p-timeout";
import { v4 as uuidv4 } from "uuid";

// src/types.ts
var ChatGPTError = class extends Error {
};

// src/chatgpt-conversation.ts
var ChatGPTConversation = class {
  constructor(api, opts = {}) {
    this.conversationId = void 0;
    this.parentMessageId = void 0;
    this.api = api;
    this.conversationId = opts.conversationId;
    this.parentMessageId = opts.parentMessageId;
  }
  async sendMessage(message, opts = {}) {
    const { onConversationResponse, ...rest } = opts;
    return this.api.sendMessage(message, {
      ...rest,
      conversationId: this.conversationId,
      parentMessageId: this.parentMessageId,
      onConversationResponse: (response) => {
        var _a;
        if (response.conversation_id) {
          this.conversationId = response.conversation_id;
        }
        if ((_a = response.message) == null ? void 0 : _a.id) {
          this.parentMessageId = response.message.id;
        }
        if (onConversationResponse) {
          return onConversationResponse(response);
        }
      }
    });
  }
};

// src/fetch.ts
var _undici;
var fetch = globalThis.fetch ?? async function undiciFetchWrapper(...args) {
  if (!_undici) {
    _undici = await import("undici");
  }
  if (typeof (_undici == null ? void 0 : _undici.fetch) !== "function") {
    throw new Error(
      "Invalid undici installation; please make sure undici is installed correctly in your node_modules. Note that this package requires Node.js >= 16.8"
    );
  }
  return _undici.fetch(...args);
};

// src/fetch-sse.ts
import { createParser } from "eventsource-parser";

// src/stream-async-iterable.ts
async function* streamAsyncIterable(stream) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

// src/fetch-sse.ts
async function fetchSSE(url, options) {
  const { onMessage, ...fetchOptions } = options;
  const res = await fetch(url, fetchOptions);
  if (!res.ok) {
    const msg = `ChatGPTAPI error ${res.status || res.statusText}`;
    const error = new ChatGPTError(msg);
    error.statusCode = res.status;
    error.statusText = res.statusText;
    error.response = res;
    throw error;
  }
  const parser = createParser((event) => {
    if (event.type === "event") {
      onMessage(event.data);
    }
  });
  if (!res.body.getReader) {
    const body = res.body;
    if (!body.on || !body.read) {
      throw new ChatGPTError('unsupported "fetch" implementation');
    }
    body.on("readable", () => {
      let chunk;
      while (null !== (chunk = body.read())) {
        parser.feed(chunk.toString());
      }
    });
  } else {
    for await (const chunk of streamAsyncIterable(res.body)) {
      const str = new TextDecoder().decode(chunk);
      parser.feed(str);
    }
  }
}

// src/utils.ts
import { remark } from "remark";
import stripMarkdown from "strip-markdown";
function markdownToText(markdown) {
  return remark().use(stripMarkdown).processSync(markdown ?? "").toString();
}

// src/chatgpt-api.ts
var KEY_ACCESS_TOKEN = "accessToken";
var USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36";
var ChatGPTAPI = class {
  constructor(opts) {
    this._user = null;
    const {
      sessionToken,
      markdown = true,
      apiBaseUrl = "https://chat.openai.com/api",
      backendApiBaseUrl = "https://chat.openai.com/backend-api",
      userAgent = USER_AGENT,
      accessTokenTTL = 6e4
    } = opts;
    this._sessionToken = sessionToken;
    this._markdown = !!markdown;
    this._apiBaseUrl = apiBaseUrl;
    this._backendApiBaseUrl = backendApiBaseUrl;
    this._userAgent = userAgent;
    this._headers = {
      "User-Agent": this._userAgent,
      "x-openai-assistant-app-id": "",
      "accept-language": "en-US,en;q=0.9",
      origin: "https://chat.openai.com",
      referer: "https://chat.openai.com/chat"
    };
    this._accessTokenCache = new ExpiryMap(accessTokenTTL);
    if (!this._sessionToken) {
      throw new ChatGPTError("ChatGPT invalid session token");
    }
  }
  get user() {
    return this._user;
  }
  async sendMessage(message, opts = {}) {
    const {
      conversationId,
      parentMessageId = uuidv4(),
      timeoutMs,
      onProgress,
      onConversationResponse
    } = opts;
    let { abortSignal } = opts;
    let abortController = null;
    if (timeoutMs && !abortSignal) {
      abortController = new AbortController();
      abortSignal = abortController.signal;
    }
    const accessToken = await this.refreshAccessToken();
    const body = {
      action: "next",
      messages: [
        {
          id: uuidv4(),
          role: "user",
          content: {
            content_type: "text",
            parts: [message]
          }
        }
      ],
      model: "text-davinci-002-render",
      parent_message_id: parentMessageId
    };
    if (conversationId) {
      body.conversation_id = conversationId;
    }
    const url = `${this._backendApiBaseUrl}/conversation`;
    let response = "";
    const responseP = new Promise((resolve, reject) => {
      fetchSSE(url, {
        method: "POST",
        headers: {
          ...this._headers,
          Authorization: `Bearer ${accessToken}`,
          Accept: "text/event-stream",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: abortSignal,
        onMessage: (data) => {
          var _a, _b;
          if (data === "[DONE]") {
            return resolve(response);
          }
          try {
            const parsedData = JSON.parse(data);
            if (onConversationResponse) {
              onConversationResponse(parsedData);
            }
            const message2 = parsedData.message;
            if (message2) {
              let text = (_b = (_a = message2 == null ? void 0 : message2.content) == null ? void 0 : _a.parts) == null ? void 0 : _b[0];
              if (text) {
                if (!this._markdown) {
                  text = markdownToText(text);
                }
                response = text;
                if (onProgress) {
                  onProgress(text);
                }
              }
            }
          } catch (err) {
            console.warn("fetchSSE onMessage unexpected error", err);
            reject(err);
          }
        }
      }).catch(reject);
    });
    if (timeoutMs) {
      if (abortController) {
        ;
        responseP.cancel = () => {
          abortController.abort();
        };
      }
      return pTimeout(responseP, {
        milliseconds: timeoutMs,
        message: "ChatGPT timed out waiting for response"
      });
    } else {
      return responseP;
    }
  }
  async getIsAuthenticated() {
    try {
      void await this.refreshAccessToken();
      return true;
    } catch (err) {
      return false;
    }
  }
  async ensureAuth() {
    return await this.refreshAccessToken();
  }
  async refreshAccessToken() {
    const cachedAccessToken = this._accessTokenCache.get(KEY_ACCESS_TOKEN);
    if (cachedAccessToken) {
      return cachedAccessToken;
    }
    let response;
    try {
      const res = await fetch(`${this._apiBaseUrl}/auth/session`, {
        headers: {
          ...this._headers,
          cookie: `__Secure-next-auth.session-token=${this._sessionToken}`
        }
      }).then((r) => {
        response = r;
        if (!r.ok) {
          const error = new ChatGPTError(`${r.status} ${r.statusText}`);
          error.response = r;
          error.statusCode = r.status;
          error.statusText = r.statusText;
          throw error;
        }
        return r.json();
      });
      const accessToken = res == null ? void 0 : res.accessToken;
      if (!accessToken) {
        const error = new ChatGPTError("Unauthorized");
        error.response = response;
        error.statusCode = response == null ? void 0 : response.status;
        error.statusText = response == null ? void 0 : response.statusText;
        throw error;
      }
      const appError = res == null ? void 0 : res.error;
      if (appError) {
        if (appError === "RefreshAccessTokenError") {
          const error = new ChatGPTError("session token may have expired");
          error.response = response;
          error.statusCode = response == null ? void 0 : response.status;
          error.statusText = response == null ? void 0 : response.statusText;
          throw error;
        } else {
          const error = new ChatGPTError(appError);
          error.response = response;
          error.statusCode = response == null ? void 0 : response.status;
          error.statusText = response == null ? void 0 : response.statusText;
          throw error;
        }
      }
      if (res.user) {
        this._user = res.user;
      }
      this._accessTokenCache.set(KEY_ACCESS_TOKEN, accessToken);
      return accessToken;
    } catch (err) {
      const error = new ChatGPTError(
        `ChatGPT failed to refresh auth token. ${err.toString()}`
      );
      error.response = response;
      error.statusCode = response == null ? void 0 : response.status;
      error.statusText = response == null ? void 0 : response.statusText;
      error.originalError = err;
      throw error;
    }
  }
  getConversation(opts = {}) {
    return new ChatGPTConversation(this, opts);
  }
};
export {
  ChatGPTAPI,
  ChatGPTConversation,
  ChatGPTError,
  markdownToText
};
//# sourceMappingURL=index.js.map
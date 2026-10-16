const IMAGE_SOURCES = [
  { id: 1, pattern: "^https://img[0-9]\\.doubanio\\.com/view/", referer: "https://www.douban.com/" },
  { id: 2, pattern: "^https://cdnfile\\.sspai\\.com/", referer: "https://sspai.com/" },
];

export const isPlatformImageUrl = (url: string) => IMAGE_SOURCES.some(source => new RegExp(source.pattern).test(url));

/** Affect only this extension's own image GETs. Session rules disappear when
 * the browser closes and are installed again as needed. */
export const configurePlatformImageRequests = async () => {
  const initiator = new URL(chrome.runtime.getURL("/")).hostname;
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: IMAGE_SOURCES.map(source => source.id),
    addRules: IMAGE_SOURCES.map(source => ({
      id: source.id, priority: 1,
      action: { type: "modifyHeaders", requestHeaders: [{ header: "Referer", operation: "set", value: source.referer }] },
      condition: {
        regexFilter: source.pattern,
        initiatorDomains: [initiator],
        resourceTypes: ["xmlhttprequest"],
        requestMethods: ["get"],
      },
    })),
  });
};

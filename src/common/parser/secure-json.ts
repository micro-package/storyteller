export const buildReplacementString = (reason: "SECURE" | "CIRCULAR", key: string, value: unknown) =>
  `_${reason}_<${typeof value}>${key}_`;

//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value
export const getCircularReplacer = (seen: WeakSet<object>) => (key: string, value: unknown) => {
  if (typeof value === "object" && value !== null) {
    if (seen.has(value)) {
      return buildReplacementString("CIRCULAR", key, value);
    }
    seen.add(value);
  }
  return value;
};

const securedKeys: string[] = [];

export const getSecureReplacer = (keys: string[]) => (key: string, value: any) =>
  keys.includes(key) ? buildReplacementString("SECURE", key, value) : value;

export const js2SecureJson = (secureReplacer: any, circularReplacer: any) => (object: any) => {
  if (typeof object === "string") {
    return object;
  }
  try {
    // eslint-disable-next-line no-restricted-globals
    const result = JSON.stringify(object, secureReplacer);
    return result;
  } catch {
    // eslint-disable-next-line no-restricted-globals
    return JSON.stringify(object, (key, value) =>
      [circularReplacer, secureReplacer].reduce((acc, replacer) => replacer(key, acc), value),
    );
  }
};

export const secureJsonStringify = js2SecureJson(getSecureReplacer(securedKeys), getCircularReplacer(new WeakSet()));

// eslint-disable-next-line no-restricted-globals
export const secureJsonParse = JSON.parse;

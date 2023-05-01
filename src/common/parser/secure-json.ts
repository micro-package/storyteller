export const buildReplacementString = (reason: "SECURE" | "CIRCULAR", key: string, value: unknown) =>
  `_${reason}_<${typeof value}>${key}_`;

//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value
export function getCircularReplacer() {
  const ancestors: any[] = [];
  return function (key: any, value: any) {
    if (typeof value !== "object" || value === null) {
      return value;
    }
    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
      ancestors.pop();
    }
    if (ancestors.includes(value)) {
      return buildReplacementString("CIRCULAR", key, value);
    }
    ancestors.push(value);
    return value;
  };
}

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
    const result = JSON.stringify(object, function (key, value) {
      return [circularReplacer, secureReplacer].reduce((acc, replacer) => replacer.bind(this)(key, acc), value);
    });
    return result;
  }
};

export const secureJsonStringify = js2SecureJson(getSecureReplacer(securedKeys), getCircularReplacer());

// eslint-disable-next-line no-restricted-globals
export const secureJsonParse = JSON.parse;

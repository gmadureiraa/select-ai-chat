type LoggerArgs = unknown[];

function isDev() {
  return import.meta.env.DEV;
}

export const logger = {
  debug: (...args: LoggerArgs) => {
    if (isDev()) console.debug(...args);
  },
  info: (...args: LoggerArgs) => {
    if (isDev()) console.info(...args);
  },
  warn: (...args: LoggerArgs) => {
    console.warn(...args);
  },
  error: (...args: LoggerArgs) => {
    console.error(...args);
  },
};


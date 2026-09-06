const levels = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger(context = {}) {
  const threshold = levels[process.env.LOG_LEVEL ?? 'info'] ?? levels.info;
  const write = (level, message, meta = {}) => {
    if (levels[level] < threshold) return;
    const record = { timestamp: new Date().toISOString(), level, message, ...context, ...meta };
    const output = JSON.stringify(record);
    if (level === 'error') console.error(output);
    else if (level === 'warn') console.warn(output);
    else console.log(output);
  };
  return {
    debug: (message, meta) => write('debug', message, meta),
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
  };
}

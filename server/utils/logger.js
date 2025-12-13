// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Text colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
};

// Status indicators
const STATUS = {
  SUCCESS: `${colors.green}✓${colors.reset}`,
  ERROR: `${colors.red}✗${colors.reset}`,
  WARNING: `${colors.yellow}⚠${colors.reset}`,
  INFO: `${colors.blue}ℹ${colors.reset}`,
  PENDING: `${colors.yellow}◌${colors.reset}`,
};

// HTTP method colors
const methodColors = {
  GET: colors.green,
  POST: colors.blue,
  PUT: colors.yellow,
  PATCH: colors.cyan,
  DELETE: colors.red,
  OPTIONS: colors.dim,
};

// Status code colors
const getStatusColor = (statusCode) => {
  if (statusCode >= 500) return colors.red;
  if (statusCode >= 400) return colors.yellow;
  if (statusCode >= 300) return colors.cyan;
  if (statusCode >= 200) return colors.green;
  return colors.white;
};

// Timestamp formatter
const getTimestamp = () => {
  const now = new Date();
  return `${colors.dim}[${now.toLocaleTimeString()}]${colors.reset}`;
};

// Logger functions
const logger = {
  // Server startup banner
  banner: (port, env) => {
    console.log(`
${colors.cyan}╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ${colors.bright}${colors.white}🚨 QuickAlert API Server${colors.reset}${colors.cyan}                               ║
║                                                            ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║   ${colors.white}Port:${colors.reset}        ${colors.green}${port}${colors.reset}${colors.cyan}                                        ║
║   ${colors.white}Environment:${colors.reset} ${colors.yellow}${env}${colors.reset}${colors.cyan}                              ║
║   ${colors.white}Time:${colors.reset}        ${colors.dim}${new Date().toLocaleString()}${colors.reset}${colors.cyan}       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝${colors.reset}
    `);
  },

  // Connection status
  connection: (service, status, message = '') => {
    const icon = status === 'success' ? STATUS.SUCCESS : 
                 status === 'error' ? STATUS.ERROR : 
                 status === 'pending' ? STATUS.PENDING : 
                 status === 'warning' ? STATUS.WARNING : STATUS.INFO;
    const color = status === 'success' ? colors.green : 
                  status === 'error' ? colors.red : 
                  status === 'warning' ? colors.yellow : colors.yellow;
    
    console.log(`${getTimestamp()} ${icon} ${color}${service}${colors.reset}${message ? `: ${message}` : ''}`);
  },

  // Service status table
  statusTable: (services) => {
    console.log(`\n${colors.cyan}┌─────────────────────────────────────────────────┐${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset} ${colors.bright}Service Status${colors.reset}                                ${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}├─────────────────────────────────────────────────┤${colors.reset}`);
    
    services.forEach(({ name, status, detail }) => {
      const icon = status === 'connected' ? STATUS.SUCCESS :
                   status === 'error' ? STATUS.ERROR :
                   status === 'pending' ? STATUS.PENDING : STATUS.WARNING;
      const statusText = status === 'connected' ? `${colors.green}Connected${colors.reset}` :
                         status === 'error' ? `${colors.red}Error${colors.reset}` :
                         status === 'pending' ? `${colors.yellow}Pending${colors.reset}` :
                         `${colors.yellow}${status}${colors.reset}`;
      
      const paddedName = name.padEnd(15);
      const paddedStatus = statusText.padEnd(20);
      console.log(`${colors.cyan}│${colors.reset} ${icon} ${paddedName} ${paddedStatus} ${colors.dim}${detail || ''}${colors.reset}`);
    });
    
    console.log(`${colors.cyan}└─────────────────────────────────────────────────┘${colors.reset}\n`);
  },

  // HTTP request logging
  request: (req, res, duration) => {
    const method = req.method;
    const url = req.originalUrl || req.url;
    const status = res.statusCode;
    const methodColor = methodColors[method] || colors.white;
    const statusColor = getStatusColor(status);
    
    const methodStr = `${methodColor}${method.padEnd(7)}${colors.reset}`;
    const statusStr = `${statusColor}${status}${colors.reset}`;
    const durationStr = `${colors.dim}${duration}ms${colors.reset}`;
    
    console.log(`${getTimestamp()} ${methodStr} ${url} ${statusStr} ${durationStr}`);
  },

  // Info log
  info: (message) => {
    console.log(`${getTimestamp()} ${STATUS.INFO} ${message}`);
  },

  // Success log
  success: (message) => {
    console.log(`${getTimestamp()} ${STATUS.SUCCESS} ${colors.green}${message}${colors.reset}`);
  },

  // Warning log
  warn: (message) => {
    console.log(`${getTimestamp()} ${STATUS.WARNING} ${colors.yellow}${message}${colors.reset}`);
  },

  // Error log
  error: (message, err = null) => {
    console.log(`${getTimestamp()} ${STATUS.ERROR} ${colors.red}${message}${colors.reset}`);
    if (err && process.env.NODE_ENV !== 'production') {
      console.log(`${colors.dim}${err.stack || err}${colors.reset}`);
    }
  },

  // Socket event log
  socket: (event, socketId, data = '') => {
    console.log(`${getTimestamp()} ${colors.magenta}⚡${colors.reset} ${colors.magenta}Socket${colors.reset} ${event} ${colors.dim}[${socketId}]${colors.reset} ${data}`);
  },

  // API endpoint hit
  endpoint: (method, path, status, duration) => {
    const methodColor = methodColors[method] || colors.white;
    const statusColor = getStatusColor(status);
    console.log(`${getTimestamp()} ${methodColor}${method}${colors.reset} ${path} → ${statusColor}${status}${colors.reset} ${colors.dim}(${duration}ms)${colors.reset}`);
  },

  // Divider line
  divider: () => {
    console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);
  },
};

// Request logger middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function to log after response
  res.end = function(...args) {
    const duration = Date.now() - start;
    logger.request(req, res, duration);
    originalEnd.apply(res, args);
  };
  
  next();
};

module.exports = { logger, requestLogger, colors, STATUS };

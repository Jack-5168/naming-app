"use strict";
/**
 * Persona Lab Server
 * Main entry point
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.prisma = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const winston_1 = __importDefault(require("winston"));
const client_1 = require("@prisma/client");
const path_1 = __importDefault(require("path"));
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const tests_1 = __importDefault(require("./routes/tests"));
const reports_1 = __importDefault(require("./routes/reports"));
const memberships_1 = __importDefault(require("./routes/memberships"));
const payments_1 = __importDefault(require("./routes/payments"));
const growth_1 = __importDefault(require("./routes/growth"));
// Initialize Prisma
const prisma = new client_1.PrismaClient();
exports.prisma = prisma;
// Initialize logger
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston_1.default.transports.File({ filename: 'logs/combined.log' }),
    ],
});
exports.logger = logger;
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.simple(),
    }));
}
const app = (0, express_1.default)();
exports.app = app;
const PORT = process.env.PORT || 3000;
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: parseInt(process.env.RATE_LIMIT_USER || '100'), // per user
    keyGenerator: (req) => req.user?.id?.toString() || req.ip || 'unknown',
});
app.use('/api/', limiter);
const ipLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.RATE_LIMIT_IP || '500'), // per IP
    keyGenerator: (req) => req.ip || 'unknown',
});
app.use('/api/', ipLimiter);
// Body parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });
    next();
});
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
    });
});
// API Documentation (Swagger placeholder)
app.get('/api', (req, res) => {
    res.json({
        name: 'Persona Lab API',
        version: '1.0.0',
        documentation: '/api/docs',
        endpoints: {
            auth: '/api/v1/auth',
            users: '/api/v1/users',
            tests: '/api/v1/tests',
            reports: '/api/v1/reports',
            memberships: '/api/v1/memberships',
            payments: '/api/v1/payments',
            growth: '/api/v1/growth',
        },
    });
});
// API routes
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/users', users_1.default);
app.use('/api/v1/tests', tests_1.default);
app.use('/api/v1/reports', reports_1.default);
app.use('/api/v1/memberships', memberships_1.default);
app.use('/api/v1/payments', payments_1.default);
app.use('/api/v1/growth', growth_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
        path: req.path,
    });
});
// Error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
});
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger.info('SIGINT received. Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});
// Create logs directory if it doesn't exist
const fs_1 = __importDefault(require("fs"));
const logsDir = path_1.default.join(__dirname, '../../logs');
if (!fs_1.default.existsSync(logsDir)) {
    fs_1.default.mkdirSync(logsDir, { recursive: true });
}
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
//# sourceMappingURL=index.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const session = require('express-session');
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:5174'];
    app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (origin && allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,Authorization');
        }
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
            return;
        }
        next();
    });
    app.use(session({
        secret: process.env.JWT_SECRET ?? 'eduflow-secret',
        resave: false,
        saveUninitialized: true,
        cookie: {
            maxAge: 60 * 60 * 1000,
        },
    }));
    await app.listen(3001);
    console.log('Backend rodando em http://localhost:3001');
}
bootstrap();
//# sourceMappingURL=main.js.map
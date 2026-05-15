"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const session = require('express-session');
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: ['http://localhost:5173', 'http://localhost:4173'],
        credentials: true,
    });
    app.use(session({
        secret: process.env.JWT_SECRET ?? 'eduflow-secret',
        resave: false,
        saveUninitialized: true,
        cookie: {
            maxAge: 60 * 60 * 1000,
        },
    }));
    await app.listen(3000);
    console.log('Backend rodando em http://localhost:3000');
}
bootstrap();
//# sourceMappingURL=main.js.map
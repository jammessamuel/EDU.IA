"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimulatorController = void 0;
const common_1 = require("@nestjs/common");
const simulator_service_1 = require("./simulator.service");
const require_permission_decorator_1 = require("../common/decorators/require-permission.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let SimulatorController = class SimulatorController {
    simulatorService;
    constructor(simulatorService) {
        this.simulatorService = simulatorService;
    }
    send(body, session, user) {
        if (!session.messages)
            session.messages = [];
        return this.simulatorService.chat(body.text, session.messages, user.schoolId);
    }
    reset(session) {
        session.messages = [];
        return { ok: true };
    }
    leads(user) {
        return this.simulatorService.getAllLeads(user.schoolId);
    }
};
exports.SimulatorController = SimulatorController;
__decorate([
    (0, common_1.Post)('messages'),
    (0, require_permission_decorator_1.RequirePermission)('leads:create:school'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Session)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], SimulatorController.prototype, "send", null);
__decorate([
    (0, common_1.Delete)('session'),
    (0, require_permission_decorator_1.RequirePermission)('leads:create:school'),
    __param(0, (0, common_1.Session)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SimulatorController.prototype, "reset", null);
__decorate([
    (0, common_1.Get)('leads'),
    (0, require_permission_decorator_1.RequirePermission)('leads:read:school'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SimulatorController.prototype, "leads", null);
exports.SimulatorController = SimulatorController = __decorate([
    (0, common_1.Controller)('simulator'),
    __metadata("design:paramtypes", [simulator_service_1.SimulatorService])
], SimulatorController);
//# sourceMappingURL=simulator.controller.js.map
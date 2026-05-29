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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimulatorService = void 0;
const common_1 = require("@nestjs/common");
const openai_1 = __importDefault(require("openai"));
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
const SCHOOL_NAME = 'Colégio Exemplo';
const COURSES = ['Enfermagem', 'Administração', 'Direito', 'Pedagogia'];
const UNITS = ['Centro', 'Norte', 'Sul'];
const SYSTEM_PROMPT = `
Você é o atendente virtual do ${SCHOOL_NAME}, uma instituição de ensino.
Seu objetivo é qualificar o interesse do aluno coletando as seguintes informações, UMA POR VEZ:
1. Qual curso tem interesse (opções: ${COURSES.join(', ')})
2. Qual unidade prefere (opções: ${UNITS.join(', ')})
3. Qual turno prefere (manhã, tarde ou noite)
4. Nome completo
5. Se é maior de 18 anos

REGRAS:
- Seja cordial e objetivo, em português brasileiro
- Faça APENAS UMA pergunta por mensagem
- Não peça todas as informações de uma vez
- Quando tiver todas as informações (curso + unidade + turno + nome), agradeça e diga que um atendente vai entrar em contato em breve
- Se o aluno pedir para falar com um humano, diga que vai transferir e encerre cordialmente
`.trim();
let SimulatorService = class SimulatorService {
    config;
    prisma;
    client;
    constructor(config, prisma) {
        this.config = config;
        this.prisma = prisma;
        this.client = new openai_1.default({ apiKey: config.get('OPENAI_API_KEY') });
    }
    async chat(text, history, schoolId) {
        history.push({ role: 'user', content: text });
        const response = await this.client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                ...history.slice(-12),
            ],
            temperature: 0.4,
            max_tokens: 300,
        });
        const reply = response.choices[0].message.content ?? '';
        history.push({ role: 'assistant', content: reply });
        const lead = await this.tryExtractAndSaveLead(history, schoolId);
        return { reply, lead };
    }
    async tryExtractAndSaveLead(history, schoolId) {
        if (history.length < 8)
            return null;
        const extraction = await this.client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `Analise a conversa e extraia os dados do lead em JSON.
Retorne null se ainda não tiver: nome + curso + unidade + turno.
Se tiver todos, retorne: {"name":"...","course":"...","unit":"...","shift":"...","qualified":true}
Retorne APENAS o JSON, sem explicação.`,
                },
                {
                    role: 'user',
                    content: history
                        .map((m) => `${m.role === 'user' ? 'Aluno' : 'Atendente'}: ${m.content}`)
                        .join('\n'),
                },
            ],
            response_format: { type: 'json_object' },
            temperature: 0,
            max_tokens: 200,
        });
        try {
            const data = JSON.parse(extraction.choices[0].message.content ?? '{}');
            if (!data.qualified)
                return null;
            const existing = await this.prisma.lead.findFirst({
                where: { schoolId, name: data.name, course: data.course },
                orderBy: { createdAt: 'desc' },
            });
            if (existing)
                return existing;
            return await this.prisma.lead.create({
                data: {
                    schoolId,
                    name: data.name,
                    course: data.course,
                    unit: data.unit,
                    shift: data.shift,
                    qualified: true,
                },
            });
        }
        catch {
            return null;
        }
    }
    async getAllLeads(schoolId) {
        return this.prisma.lead.findMany({
            where: { schoolId },
            orderBy: { createdAt: 'desc' },
        });
    }
};
exports.SimulatorService = SimulatorService;
exports.SimulatorService = SimulatorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], SimulatorService);
//# sourceMappingURL=simulator.service.js.map
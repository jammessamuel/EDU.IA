import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}
export declare class SimulatorService {
    private config;
    private prisma;
    private client;
    constructor(config: ConfigService, prisma: PrismaService);
    chat(text: string, history: ChatMessage[]): Promise<{
        reply: string;
        lead: {
            name: string;
            id: string;
            phone: string | null;
            course: string;
            unit: string;
            shift: string;
            qualified: boolean;
            createdAt: Date;
        } | null;
    }>;
    private tryExtractAndSaveLead;
    getAllLeads(): Promise<{
        name: string;
        id: string;
        phone: string | null;
        course: string;
        unit: string;
        shift: string;
        qualified: boolean;
        createdAt: Date;
    }[]>;
}

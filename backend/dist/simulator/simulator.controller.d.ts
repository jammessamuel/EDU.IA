import { SimulatorService } from './simulator.service';
export declare class SimulatorController {
    private readonly simulatorService;
    constructor(simulatorService: SimulatorService);
    send(body: {
        text: string;
    }, session: Record<string, any>): Promise<{
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
    reset(session: Record<string, any>): {
        ok: boolean;
    };
    leads(): Promise<{
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

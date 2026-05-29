import { SimulatorService } from './simulator.service';
export declare class SimulatorController {
    private readonly simulatorService;
    constructor(simulatorService: SimulatorService);
    send(body: {
        text: string;
    }, session: Record<string, any>, user: {
        id: string;
        schoolId: string;
    }): Promise<{
        reply: string;
        lead: {
            name: string;
            id: string;
            schoolId: string;
            phone: string | null;
            course: string;
            unit: string;
            shift: string;
            qualified: boolean;
            status: string;
            createdAt: Date;
        } | null;
    }>;
    reset(session: Record<string, any>): {
        ok: boolean;
    };
    leads(user: {
        id: string;
        schoolId: string;
    }): Promise<{
        name: string;
        id: string;
        schoolId: string;
        phone: string | null;
        course: string;
        unit: string;
        shift: string;
        qualified: boolean;
        status: string;
        createdAt: Date;
    }[]>;
}

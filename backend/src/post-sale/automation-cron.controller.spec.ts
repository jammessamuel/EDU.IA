/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { UnauthorizedException } from '@nestjs/common';
import { AutomationCronController } from './automation-cron.controller';
import { PostSaleService } from './post-sale.service';

describe('AutomationCronController', () => {
  const originalSecret = process.env.CRON_SECRET;
  let postSale: { runScheduledAutomation: jest.Mock };
  let controller: AutomationCronController;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret-test';
    postSale = { runScheduledAutomation: jest.fn() };
    controller = new AutomationCronController(
      postSale as unknown as PostSaleService,
    );
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it('rejeita chamadas sem o segredo do cron', async () => {
    await expect(controller.run()).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(postSale.runScheduledAutomation).not.toHaveBeenCalled();
  });

  it('rejeita chamadas com segredo incorreto', async () => {
    await expect(controller.run('Bearer incorreto')).rejects.toThrow(
      'Cron não autorizado.',
    );
    expect(postSale.runScheduledAutomation).not.toHaveBeenCalled();
  });

  it('executa a continuidade e registra um resumo estruturado', async () => {
    const result = {
      ok: true,
      processedAt: new Date('2026-07-21T11:00:00Z'),
      schools: [
        {
          schoolId: 'school-a',
          repairedCases: 2,
          createdTasks: 1,
          escalatedTasks: 3,
        },
      ],
    };
    postSale.runScheduledAutomation.mockResolvedValue(result);

    await expect(
      controller.run('Bearer cron-secret-test', 'gru1::cron-request'),
    ).resolves.toBe(result);

    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(logSpy.mock.calls[0][0]))).toMatchObject({
      event: 'daily_continuity.started',
      executionId: 'gru1::cron-request',
    });
    expect(JSON.parse(String(logSpy.mock.calls[1][0]))).toMatchObject({
      event: 'daily_continuity.completed',
      schoolsProcessed: 1,
      repairedCases: 2,
      createdTasks: 1,
      escalatedTasks: 3,
    });
  });

  it('registra a falha e preserva o erro original', async () => {
    postSale.runScheduledAutomation.mockRejectedValue(
      new Error('banco indisponível'),
    );

    await expect(
      controller.run('Bearer cron-secret-test', 'cron-failed'),
    ).rejects.toThrow('banco indisponível');

    expect(JSON.parse(String(errorSpy.mock.calls[0][0]))).toMatchObject({
      level: 'error',
      event: 'daily_continuity.failed',
      executionId: 'cron-failed',
      error: 'banco indisponível',
    });
  });
});

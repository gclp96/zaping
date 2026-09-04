import { PrismaService } from './prisma.service';

describe('PrismaService lifecycle', () => {
  it('disconnects Prisma during module destruction', async () => {
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const service = {
      $disconnect: disconnect,
    } as unknown as PrismaService;

    await PrismaService.prototype.onModuleDestroy.call(service);

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

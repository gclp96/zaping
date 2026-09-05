import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class CompanySequenceAllocatorService {
  async allocateNext(
    tx: Prisma.TransactionClient,
    companyId: string,
    key: string,
  ): Promise<number> {
    await tx.companySequence.createMany({
      data: [
        {
          companyId,
          key,
          nextValue: 1,
        },
      ],
      skipDuplicates: true,
    });

    const sequence = await tx.companySequence.update({
      where: {
        companyId_key: {
          companyId,
          key,
        },
      },
      data: {
        nextValue: {
          increment: 1,
        },
      },
      select: {
        nextValue: true,
      },
    });

    return sequence.nextValue - 1;
  }
}

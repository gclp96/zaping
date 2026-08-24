import { Module } from '@nestjs/common';

import { CompanySequenceAllocatorService } from './company-sequence-allocator.service';

@Module({
  providers: [CompanySequenceAllocatorService],
  exports: [CompanySequenceAllocatorService],
})
export class CompanySequencesModule {}

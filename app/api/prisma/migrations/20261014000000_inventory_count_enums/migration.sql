-- Separate migration commits enum values before shape validation uses them.
ALTER TYPE "InventoryPhysicalEffectKind" ADD VALUE 'COUNT_CORRECTION';
ALTER TYPE "IdempotencyScope" ADD VALUE 'INVENTORY_MANUAL_PHYSICAL_MUTATION';
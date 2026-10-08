// No imports of Prisma/Nest/configuration on the disabled path. In particular,
// describe.skip still evaluates its callback, so all setup belongs in the test.
const c5bEnabled = process.env.RUN_HC_C5B_POSTGRES_TESTS === '1';

(c5bEnabled ? describe : describe.skip)(
  'HC-NEXT-03C5-B0 safe integrated harness',
  () => {
    it('preflights, authenticates one owned actor and removes its fixtures', async () => {
      const { runC5bHarnessSmoke } =
        await import('./helpers/healthcare-c5b-harness');
      await runC5bHarnessSmoke();
    }, 120_000);
  },
);

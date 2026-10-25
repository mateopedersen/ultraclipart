/** One uploader and one ordered verifier; failures drain the active upload. */
export async function runPackagePipeline(topics, upload, verify) {
  let failure;
  const signals = [];
  const ready = topics.map(
    (_, index) =>
      new Promise((accept) => {
        signals[index] = accept;
      }),
  );
  const uploads = async () => {
    try {
      for (let index = 0; index < topics.length; index++) {
        if (failure) break;
        await upload(topics[index]);
        signals[index]();
      }
    } catch (error) {
      failure ??= error;
      throw error;
    } finally {
      // Resolve waiters on failure too; no rejected promises can go unobserved.
      for (const signal of signals) signal();
    }
  };
  const verification = async () => {
    try {
      for (let index = 0; index < topics.length; index++) {
        await ready[index];
        if (failure) throw failure;
        await verify(topics[index]);
      }
    } catch (error) {
      failure ??= error;
      throw error;
    }
  };
  const results = await Promise.allSettled([uploads(), verification()]);
  const failed = results.find((result) => result.status === 'rejected');
  if (failed) throw failed.reason;
}

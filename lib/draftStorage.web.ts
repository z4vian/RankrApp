// Web drafts stay in the composer's React state, not persistent shared storage.
export const draftStorage = {
  async getItem(_key: string): Promise<string | null> { return null; },
  async setItem(_key: string, _value: string): Promise<void> {},
  async removeItem(_key: string): Promise<void> {},
};

/** Only internal-test APK/AAB profiles render simulated banking UI. */
export const isInternalBankingSandboxBuild = process.env.EXPO_PUBLIC_BANKING_SANDBOX_UI === 'true';

import { create } from 'zustand';
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';

interface BillingState {
  offering: PurchasesOffering | null;
  homePackage: PurchasesPackage | null;
  familyPackage: PurchasesPackage | null;

  customerInfo: CustomerInfo | null;

  hasHome: boolean;
  hasFamily: boolean;

  loading: boolean;
  purchasing: boolean;
  restoring: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  applyCustomerInfo: (customerInfo: CustomerInfo) => void;
  reset: () => void;
  clearError: () => void;
}

const entitlementState = (info: CustomerInfo | null) => ({
  hasHome: !!info?.entitlements.active.home,
  hasFamily: !!info?.entitlements.active.family,
});

export const useBillingStore = create<BillingState>((set) => ({
  offering: null,
  homePackage: null,
  familyPackage: null,

  customerInfo: null,

  hasHome: false,
  hasFamily: false,

  loading: false,
  purchasing: false,
  restoring: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });

    try {
      const [offerings, customerInfo] = await Promise.all([
        Purchases.getOfferings(),
        Purchases.getCustomerInfo(),
      ]);

      const offering = offerings.current ?? null;

      const homePackage =
        offering?.availablePackages.find(
          (pkg) => pkg.identifier === 'home_monthly'
        ) ?? null;

      const familyPackage =
        offering?.availablePackages.find(
          (pkg) => pkg.identifier === 'family_monthly'
        ) ?? null;

      set({
        offering,
        homePackage,
        familyPackage,
        customerInfo,
        ...entitlementState(customerInfo),
      });
    } catch (error: any) {
      set({
        error:
          error?.message ||
          'Could not load subscription information.',
      });
    } finally {
      set({ loading: false });
    }
  },

  purchase: async (pkg) => {
    set({ purchasing: true, error: null });

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);

      set({
        customerInfo,
        ...entitlementState(customerInfo),
      });

      return true;
    } catch (error: any) {
      if (!error?.userCancelled) {
        set({
          error:
            error?.message ||
            'Could not complete the purchase.',
        });
      }

      return false;
    } finally {
      set({ purchasing: false });
    }
  },

  restore: async () => {
    set({ restoring: true, error: null });

    try {
      const customerInfo = await Purchases.restorePurchases();

      set({
        customerInfo,
        ...entitlementState(customerInfo),
      });

      return true;
    } catch (error: any) {
      set({
        error:
          error?.message ||
          'Could not restore purchases.',
      });

      return false;
    } finally {
      set({ restoring: false });
    }
  },

  applyCustomerInfo: (customerInfo) =>
    set({
      customerInfo,
      ...entitlementState(customerInfo),
    }),

  reset: () =>
    set({
      offering: null,
      homePackage: null,
      familyPackage: null,
      customerInfo: null,
      hasHome: false,
      hasFamily: false,
      loading: false,
      purchasing: false,
      restoring: false,
      error: null,
    }),

  clearError: () => set({ error: null }),
}));

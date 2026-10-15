import { revenueCatService } from '../services/revenuecat';
import api from '../services/api';
import { useAuthStore } from './authStore';
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
      const userId = useAuthStore.getState().user?.id;
      const ready = await revenueCatService.configure(userId ? String(userId) : undefined);
      if (!ready) {
        set({ offering: null, homePackage: null, familyPackage: null, error: 'Subscriptions are temporarily unavailable. Please try again later.' });
        return;
      }
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
        error: 'Could not load subscription information. Please try again.',
      });
    } finally {
      set({ loading: false });
    }
  },

  purchase: async (pkg) => {
    set({ purchasing: true, error: null });

    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId || !(await revenueCatService.configure(String(userId)))) throw new Error('Billing unavailable');
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      // Never trust a purchase claim from the phone: refresh the server's
      // short cached lookup against RevenueCat for the authenticated user.
      await api.post('/api/billing/refresh').catch(() => undefined);

      set({
        customerInfo,
        ...entitlementState(customerInfo),
      });

      return true;
    } catch (error: any) {
      if (!error?.userCancelled) {
        set({
          error: 'Could not complete the purchase. Please try again.',
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
      const userId = useAuthStore.getState().user?.id;
      if (!userId || !(await revenueCatService.configure(String(userId)))) throw new Error('Billing unavailable');
      const customerInfo = await Purchases.restorePurchases();
      await api.post('/api/billing/refresh').catch(() => undefined);

      set({
        customerInfo,
        ...entitlementState(customerInfo),
      });

      return true;
    } catch (error: any) {
      set({
        error: 'Could not restore purchases. Please try again.',
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

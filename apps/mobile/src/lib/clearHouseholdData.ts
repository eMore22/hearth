import { useChiefOfStaffStore } from '../stores/chiefOfStaffStore';
import { useHouseholdStore } from '../stores/householdStore';
import { useDocumentStore } from '../stores/documentStore';
import { useBillStore } from '../stores/billStore';
import { useGroceryStore } from '../stores/groceryStore';
import { useMaintenanceStore } from '../stores/maintenanceStore';
import { useHealthStore } from '../stores/healthStore';
import { useTaskStore } from '../stores/taskStore';
import { useAutomationStore } from '../stores/automationStore';

export function clearLocalHouseholdData() {
  const stores = [
    useChiefOfStaffStore,
    useHouseholdStore,
    useDocumentStore,
    useBillStore,
    useGroceryStore,
    useMaintenanceStore,
    useHealthStore,
    useTaskStore,
    useAutomationStore,
  ] as const;
  for (const store of stores) store.setState(store.getInitialState());
}

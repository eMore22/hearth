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
  useChiefOfStaffStore.setState(useChiefOfStaffStore.getInitialState());
  useHouseholdStore.setState(useHouseholdStore.getInitialState());
  useDocumentStore.setState(useDocumentStore.getInitialState());
  useBillStore.setState(useBillStore.getInitialState());
  useGroceryStore.setState(useGroceryStore.getInitialState());
  useMaintenanceStore.setState(useMaintenanceStore.getInitialState());
  useHealthStore.setState(useHealthStore.getInitialState());
  useTaskStore.setState(useTaskStore.getInitialState());
  useAutomationStore.setState(useAutomationStore.getInitialState());
}

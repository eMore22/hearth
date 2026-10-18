import React from 'react';
import { Redirect } from 'expo-router';

// Kept only for old bookmarks and internal test navigation.
// Nigerian banking now lives inside Banks & Household Finance.
export default function NigeriaBankingRedirect() {
  return <Redirect href="/(tabs)/finance" />;
}

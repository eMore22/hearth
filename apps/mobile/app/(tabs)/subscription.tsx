import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../src/components/ui/PremiumKit';
import { H, HearthDesign } from '../../src/theme/hearthDesign';
import { useBillingStore } from '../../src/stores/billingStore';

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();

  const {
    homePackage,
    familyPackage,
    hasHome,
    hasFamily,
    loading,
    purchasing,
    restoring,
    error,
    refresh,
    purchase,
    restore,
    clearError,
  } = useBillingStore();

  useEffect(() => {
    refresh();
  }, []);

  const currentPlan = hasFamily
    ? 'Hearth Family'
    : hasHome
      ? 'Hearth Home'
      : 'No active plan';

  const purchasePlan = async (
    pkg: typeof homePackage,
    planName: string,
  ) => {
    if (!pkg || purchasing) return;

    clearError();

    const success = await purchase(pkg);

    if (success) {
      Alert.alert(
        'Subscription active',
        `${planName} is now active on your Hearth account.`,
      );
    }
  };

  const restorePurchases = async () => {
    if (restoring) return;

    clearError();

    const success = await restore();

    if (success) {
      const state = useBillingStore.getState();

      Alert.alert(
        'Purchases restored',
        state.hasFamily
          ? 'Your Hearth Family subscription has been restored.'
          : state.hasHome
            ? 'Your Hearth Home subscription has been restored.'
            : 'No active Hearth subscription was found for this Google Play account.',
      );
    }
  };

  const manageSubscription = async () => {
    try {
      await Linking.openURL(
        'https://play.google.com/store/account/subscriptions',
      );
    } catch {
      Alert.alert(
        'Could not open Google Play',
        'Open Google Play → Payments & subscriptions → Subscriptions to manage your Hearth plan.',
      );
    }
  };

  const homePrice = homePackage?.product.priceString || 'Loading price…';
  const familyPrice = familyPackage?.product.priceString || 'Loading price…';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: Math.max(insets.bottom, 24) + 24,
        }}
      >
        <ScreenHeader
          title="Subscription"
          subtitle="Choose the Hearth plan that fits your household."
        />

        <View style={styles.body}>
          <View style={styles.currentCard}>
            <View style={styles.currentIcon}>
              <Ionicons name="sparkles-outline" size={21} color={H.purple} />
            </View>

            <View style={styles.flex}>
              <Text style={styles.currentLabel}>CURRENT PLAN</Text>
              <Text style={styles.currentTitle}>{currentPlan}</Text>
              <Text style={styles.currentSub}>
                {hasFamily
                  ? 'Family includes all Hearth Home access.'
                  : hasHome
                    ? 'Your core Hearth household tools are active.'
                    : 'Choose a plan below to unlock Hearth subscription features.'}
              </Text>
            </View>

            {(hasHome || hasFamily) && (
              <View style={styles.activePill}>
                <Text style={styles.activeText}>Active</Text>
              </View>
            )}
          </View>

          {loading && !homePackage && !familyPackage ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={H.purple} />
              <Text style={styles.loadingText}>Loading Hearth plans…</Text>
            </View>
          ) : (
            <>
              <View style={styles.planCard}>
                <View style={styles.planTop}>
                  <View>
                    <Text style={styles.planEyebrow}>HEARTH HOME</Text>
                    <Text style={styles.planPrice}>
                      {homePrice}
                      <Text style={styles.perMonth}> / month</Text>
                    </Text>
                  </View>

                  {hasHome && !hasFamily && (
                    <View style={styles.currentPill}>
                      <Text style={styles.currentPillText}>Current</Text>
                    </View>
                  )}

                  {hasFamily && (
                    <View style={styles.includedPill}>
                      <Text style={styles.includedText}>Included</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.planDescription}>
                  Core household management, organization and Hearth AI tools
                  for your home.
                </Text>

                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={17} color={H.green} />
                  <Text style={styles.featureText}>
                    Household organization and planning
                  </Text>
                </View>

                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={17} color={H.green} />
                  <Text style={styles.featureText}>
                    Bills, documents, grocery and maintenance tools
                  </Text>
                </View>

                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={17} color={H.green} />
                  <Text style={styles.featureText}>
                    Hearth AI household assistance
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    (hasHome || purchasing || !homePackage) &&
                      styles.buttonDisabled,
                  ]}
                  disabled={hasHome || purchasing || !homePackage}
                  onPress={() => purchasePlan(homePackage, 'Hearth Home')}
                  activeOpacity={0.8}
                >
                  {purchasing ? (
                    <ActivityIndicator color={H.purple} />
                  ) : (
                    <Text style={styles.secondaryButtonText}>
                      {hasFamily
                        ? 'Included with Family'
                        : hasHome
                          ? 'Current plan'
                          : 'Choose Hearth Home'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={[styles.planCard, styles.familyCard]}>
                <View style={styles.recommended}>
                  <Ionicons name="star" size={12} color={H.purple} />
                  <Text style={styles.recommendedText}>FULL HEARTH ACCESS</Text>
                </View>

                <View style={styles.planTop}>
                  <View>
                    <Text style={styles.planEyebrow}>HEARTH FAMILY</Text>
                    <Text style={styles.planPrice}>
                      {familyPrice}
                      <Text style={styles.perMonth}> / month</Text>
                    </Text>
                  </View>

                  {hasFamily && (
                    <View style={styles.currentPill}>
                      <Text style={styles.currentPillText}>Current</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.planDescription}>
                  Everything in Hearth Home, with expanded access for the
                  household and family experience.
                </Text>

                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={17} color={H.green} />
                  <Text style={styles.featureText}>
                    Everything included in Hearth Home
                  </Text>
                </View>

                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={17} color={H.green} />
                  <Text style={styles.featureText}>
                    Family-level Hearth access
                  </Text>
                </View>

                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={17} color={H.green} />
                  <Text style={styles.featureText}>
                    Built for households managing more together
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (hasFamily || purchasing || !familyPackage) &&
                      styles.buttonDisabled,
                  ]}
                  disabled={hasFamily || purchasing || !familyPackage}
                  onPress={() =>
                    purchasePlan(familyPackage, 'Hearth Family')
                  }
                  activeOpacity={0.82}
                >
                  {purchasing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {hasFamily
                        ? 'Current plan'
                        : hasHome
                          ? 'Upgrade to Hearth Family'
                          : 'Choose Hearth Family'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {!!error && (
            <View style={styles.errorCard}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={H.red}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.restoreButton}
            onPress={restorePurchases}
            disabled={restoring}
            activeOpacity={0.75}
          >
            {restoring ? (
              <ActivityIndicator color={H.navy} />
            ) : (
              <>
                <Ionicons
                  name="refresh-outline"
                  size={18}
                  color={H.navy}
                />
                <Text style={styles.restoreText}>Restore purchases</Text>
              </>
            )}
          </TouchableOpacity>

          {(hasHome || hasFamily) && (
            <TouchableOpacity
              style={styles.manageButton}
              onPress={manageSubscription}
              activeOpacity={0.75}
            >
              <Text style={styles.manageText}>
                Manage subscription in Google Play
              </Text>
              <Ionicons
                name="open-outline"
                size={16}
                color={H.muted}
              />
            </TouchableOpacity>
          )}

          <Text style={styles.disclaimer}>
            Prices and billing currency are provided by Google Play for your
            region. Subscriptions renew automatically unless cancelled in
            Google Play.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: H.paper,
  },
  body: {
    paddingHorizontal: 18,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },

  currentCard: {
    borderRadius: 22,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: H.lineSoft,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...HearthDesign.shadow.card,
  },
  currentIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: H.violetBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLabel: {
    color: H.muted2,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  currentTitle: {
    color: H.navy,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },
  currentSub: {
    color: H.muted,
    fontSize: 10.8,
    lineHeight: 16,
    marginTop: 3,
  },
  activePill: {
    backgroundColor: H.greenBg,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activeText: {
    color: H.green,
    fontSize: 9,
    fontWeight: '900',
  },

  loadingWrap: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: H.muted,
    fontSize: 12,
  },

  planCard: {
    marginTop: 14,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: H.lineSoft,
    padding: 18,
    ...HearthDesign.shadow.card,
  },
  familyCard: {
    borderColor: '#DCD2FF',
    backgroundColor: '#FCFBFF',
  },
  planTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  planEyebrow: {
    color: H.purple,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  planPrice: {
    color: H.navy,
    fontSize: 25,
    fontWeight: '900',
    marginTop: 4,
  },
  perMonth: {
    color: H.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  planDescription: {
    color: H.muted,
    fontSize: 11.5,
    lineHeight: 18,
    marginTop: 11,
    marginBottom: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  featureText: {
    flex: 1,
    color: H.navy,
    fontSize: 11.5,
    lineHeight: 17,
  },

  recommended: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: H.violetBg,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 13,
  },
  recommendedText: {
    color: H.purple,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  currentPill: {
    backgroundColor: H.greenBg,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  currentPillText: {
    color: H.green,
    fontSize: 9,
    fontWeight: '900',
  },
  includedPill: {
    backgroundColor: H.violetBg,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  includedText: {
    color: H.purple,
    fontSize: 9,
    fontWeight: '900',
  },

  primaryButton: {
    height: 50,
    borderRadius: 16,
    marginTop: 19,
    backgroundColor: H.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryButton: {
    height: 50,
    borderRadius: 16,
    marginTop: 19,
    backgroundColor: H.violetBg,
    borderWidth: 1,
    borderColor: '#DED6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: H.purple,
    fontSize: 13,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.55,
  },

  errorCard: {
    marginTop: 14,
    borderRadius: 16,
    padding: 13,
    backgroundColor: H.redBg,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  errorText: {
    flex: 1,
    color: H.red,
    fontSize: 11,
    lineHeight: 16,
  },

  restoreButton: {
    height: 50,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: H.lineSoft,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  restoreText: {
    color: H.navy,
    fontSize: 12.5,
    fontWeight: '800',
  },
  manageButton: {
    marginTop: 13,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  manageText: {
    color: H.muted,
    fontSize: 11.5,
    fontWeight: '700',
  },
  disclaimer: {
    color: H.muted2,
    fontSize: 9.5,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 10,
  },
});

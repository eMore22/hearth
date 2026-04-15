import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, TYPOGRAPHY, SPACING } from '../../src/utils/theme'

interface Member {
  name: string
  relation: string
}

export default function AddMembersScreen() {
  const [members, setMembers] = useState<Member[]>([])
  const [newName, setNewName] = useState('')
  const [newRelation, setNewRelation] = useState('')

  const addMember = () => {
    if (!newName.trim()) {
      Alert.alert('Missing Info', 'Please enter a name')
      return
    }
    setMembers([...members, { name: newName.trim(), relation: newRelation.trim() || 'Family' }])
    setNewName('')
    setNewRelation('')
  }

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index))
  }

  const handleContinue = () => {
    // In production, save members to backend
    router.push('/onboarding/permissions')
  }

  const handleSkip = () => {
    router.push('/onboarding/permissions')
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.stepIndicator}>Step 2 of 3</Text>
          <Text style={styles.title}>Add family members</Text>
          <Text style={styles.description}>
            Add the people who live in your household. You can always add more later.
          </Text>
        </View>

        {/* Add new member form */}
        <View style={styles.addSection}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Jane Smith"
            value={newName}
            onChangeText={setNewName}
            autoCapitalize="words"
          />
          <Text style={styles.label}>Relationship (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Partner, Child"
            value={newRelation}
            onChangeText={setNewRelation}
            autoCapitalize="words"
          />
          <TouchableOpacity style={styles.addButton} onPress={addMember}>
            <Ionicons name="add-circle" size={20} color={COLORS.primary} />
            <Text style={styles.addButtonText}>Add member</Text>
          </TouchableOpacity>
        </View>

        {/* Member list */}
        {members.length > 0 && (
          <View style={styles.membersList}>
            <Text style={styles.sectionTitle}>Household members</Text>
            {members.map((member, index) => (
              <View key={index} style={styles.memberCard}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberRelation}>{member.relation}</Text>
                </View>
                <TouchableOpacity onPress={() => removeMember(index)}>
                  <Ionicons name="close-circle" size={24} color={COLORS.muted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  stepIndicator: {
    ...TYPOGRAPHY.caption,
    color: COLORS.muted,
    marginBottom: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.heading2,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  description: {
    ...TYPOGRAPHY.body,
    color: COLORS.muted,
  },
  addSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  label: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    ...TYPOGRAPHY.body,
    marginBottom: SPACING.md,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  addButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  membersList: {
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...TYPOGRAPHY.body,
    fontWeight: '500',
    color: COLORS.text,
  },
  memberRelation: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.muted,
  },
  footer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  buttonText: {
    ...TYPOGRAPHY.body,
    color: '#fff',
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  skipButtonText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.muted,
  },
})